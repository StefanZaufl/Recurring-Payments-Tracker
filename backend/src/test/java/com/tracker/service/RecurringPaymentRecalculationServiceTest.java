package com.tracker.service;

import com.tracker.model.entity.PaymentType;
import com.tracker.model.entity.RecurringPayment;
import com.tracker.model.entity.Rule;
import com.tracker.model.entity.RuleType;
import com.tracker.model.entity.Transaction;
import com.tracker.model.entity.TransactionRecurringLink;
import com.tracker.model.entity.User;
import com.tracker.repository.PaymentPeriodHistoryRepository;
import com.tracker.repository.RecurringPaymentRepository;
import com.tracker.repository.RuleRepository;
import com.tracker.repository.TransactionRecurringLinkRepository;
import com.tracker.repository.TransactionRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RecurringPaymentRecalculationServiceTest {

    @Mock
    private InterAccountService interAccountService;
    @Mock
    private TransactionRepository transactionRepository;
    @Mock
    private TransactionRecurringLinkRepository linkRepository;
    @Mock
    private RecurringPaymentRepository recurringPaymentRepository;
    @Mock
    private PaymentPeriodHistoryRepository paymentPeriodHistoryRepository;
    @Mock
    private PaymentPeriodHistoryService paymentPeriodHistoryService;
    @Mock
    private RuleEvaluationService ruleEvaluationService;
    @Mock
    private RecurringPaymentDetectionService detectionService;
    @Mock
    private UserContextService userContextService;
    @Mock
    private EntityManager entityManager;
    @Mock
    private AdditionalMatchingService additionalMatchingService;
    @Mock
    private RuleRepository ruleRepository;

    private RecurringPaymentRecalculationService service;
    private UUID userId;
    private User user;

    @BeforeEach
    void setUp() {
        service = new RecurringPaymentRecalculationService(
                interAccountService,
                transactionRepository,
                linkRepository,
                recurringPaymentRepository,
                paymentPeriodHistoryRepository,
                paymentPeriodHistoryService,
                ruleEvaluationService,
                detectionService,
                userContextService,
                entityManager,
                additionalMatchingService,
                ruleRepository
        );
        userId = UUID.randomUUID();
        user = new User();
        user.setId(userId);
        when(userContextService.getCurrentUserId()).thenReturn(userId);
        lenient().when(userContextService.getCurrentUser()).thenReturn(user);
        lenient().when(additionalMatchingService.filterExcluded(any())).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void recalculateReturnsZeroesWhenThereIsNothingToProcess() {
        when(interAccountService.remarkCurrentUserTransactions()).thenReturn(0);
        when(linkRepository.findByUserId(userId)).thenReturn(List.of(), List.of());
        when(recurringPaymentRepository.findByUserId(userId)).thenReturn(List.of());
        when(transactionRepository.findByUserIdAndBookingDateGreaterThanEqualAndIsInterAccountFalse(any(), any())).thenReturn(List.of());
        when(detectionService.detectRecurringPayments(List.of())).thenReturn(List.of());

        RecurringPaymentRecalculationService.RecalculationResult result = service.recalculateCurrentUserRecurringPayments();

        assertThat(result.transactionsMarkedInterAccount()).isZero();
        assertThat(result.transactionLinksRemoved()).isZero();
        assertThat(result.recurringPaymentsDeleted()).isZero();
        assertThat(result.recurringPaymentsDetected()).isZero();
    }

    @Test
    void recalculateDeletesPaymentsWithoutMatchesAndCountsRemovedLinks() {
        Transaction tx = transaction(UUID.randomUUID(), LocalDate.of(2025, 1, 10));
        RecurringPayment payment = payment("Savings", true, PaymentType.RECURRING, List.of(rule()));
        when(interAccountService.remarkCurrentUserTransactions()).thenReturn(3);
        when(linkRepository.findByUserId(userId)).thenReturn(
                List.of(link(tx, payment)),
                List.of()
        );
        when(recurringPaymentRepository.findByUserId(userId)).thenReturn(List.of(payment));
        when(transactionRepository.findByUserIdAndBookingDateGreaterThanEqualAndIsInterAccountFalse(any(), any()))
                .thenReturn(List.of(tx));
        when(ruleEvaluationService.findMatchingTransactions(payment.getRules(), List.of(tx))).thenReturn(List.of());
        when(detectionService.detectRecurringPayments(List.of(tx))).thenReturn(List.of());

        RecurringPaymentRecalculationService.RecalculationResult result = service.recalculateCurrentUserRecurringPayments();

        assertThat(result.transactionsMarkedInterAccount()).isEqualTo(3);
        assertThat(result.transactionLinksRemoved()).isEqualTo(1);
        assertThat(result.recurringPaymentsDeleted()).isEqualTo(1);
        assertThat(result.recurringPaymentsDetected()).isZero();
        verify(linkRepository).deleteByRecurringPaymentId(payment.getId());
        verify(paymentPeriodHistoryRepository).deleteByRecurringPaymentId(payment.getId());
        verify(recurringPaymentRepository).delete(payment);
        verify(detectionService, never()).rebuildRecurringPayment(any(), any());
    }

    @Test
    void recalculateRebuildsMatchingPaymentsAndCountsOnlyNewDetectedPayments() {
        Transaction matched = transaction(UUID.randomUUID(), LocalDate.of(2025, 1, 10));
        Transaction candidate = transaction(UUID.randomUUID(), LocalDate.of(2025, 2, 10));
        RecurringPayment existing = payment("Netflix", false, PaymentType.RECURRING, List.of(rule()));
        RecurringPayment newlyDetected = payment("Spotify", true, PaymentType.RECURRING, List.of(rule()));
        when(interAccountService.remarkCurrentUserTransactions()).thenReturn(1);
        when(linkRepository.findByUserId(userId)).thenReturn(List.of(), List.of());
        when(recurringPaymentRepository.findByUserId(userId)).thenReturn(List.of(existing));
        when(transactionRepository.findByUserIdAndBookingDateGreaterThanEqualAndIsInterAccountFalse(any(), any()))
                .thenReturn(List.of(matched, candidate));
        when(ruleEvaluationService.findMatchingTransactions(existing.getRules(), List.of(matched, candidate)))
                .thenReturn(List.of(matched));
        when(detectionService.detectRecurringPayments(List.of(candidate))).thenReturn(List.of(existing, newlyDetected));

        RecurringPaymentRecalculationService.RecalculationResult result = service.recalculateCurrentUserRecurringPayments();

        assertThat(result.transactionsMarkedInterAccount()).isEqualTo(1);
        assertThat(result.transactionLinksRemoved()).isZero();
        assertThat(result.recurringPaymentsDeleted()).isZero();
        assertThat(result.recurringPaymentsDetected()).isEqualTo(1);
        verify(detectionService).rebuildRecurringPayment(existing, List.of(matched));
        verify(recurringPaymentRepository, never()).delete(existing);
    }

    @Test
    void targetedRecalculationRemovesStaleLinksAndAddsNewMatches() {
        Rule rule = rule();
        Transaction stale = transaction(UUID.randomUUID(), LocalDate.of(2025, 1, 10), "-20.00");
        Transaction retained = transaction(UUID.randomUUID(), LocalDate.of(2025, 2, 10), "-20.00");
        Transaction newlyMatched = transaction(UUID.randomUUID(), LocalDate.of(2025, 3, 10), "-20.00");
        RecurringPayment payment = payment("Streaming", true, PaymentType.RECURRING, List.of(rule));
        TransactionRecurringLink staleLink = link(stale, payment);
        TransactionRecurringLink retainedLink = link(retained, payment);

        when(recurringPaymentRepository.findByIdAndUserId(payment.getId(), userId)).thenReturn(Optional.of(payment));
        when(ruleRepository.findByRecurringPaymentIdAndUserId(payment.getId(), userId)).thenReturn(List.of(rule));
        when(linkRepository.findWithTransactionByRecurringPaymentIdAndUserId(payment.getId(), userId))
                .thenReturn(List.of(staleLink, retainedLink));
        when(transactionRepository.findUnlinkedTransactionsAfterForUser(any(), any())).thenReturn(List.of(newlyMatched));
        when(ruleEvaluationService.findMatchingTransactions(List.of(rule), List.of(stale, retained, newlyMatched)))
                .thenReturn(List.of(retained, newlyMatched));
        when(detectionService.detectFrequency(List.of(retained, newlyMatched))).thenReturn(com.tracker.model.entity.Frequency.MONTHLY);
        when(paymentPeriodHistoryService.getRollingAverage(payment.getId(), 4)).thenReturn(new BigDecimal("-20.00"));

        service.recalculateRecurringPaymentLinks(payment.getId());

        verify(linkRepository).delete(staleLink);
        verify(linkRepository, never()).delete(retainedLink);
        verify(linkRepository).save(any(TransactionRecurringLink.class));
        verify(paymentPeriodHistoryService).recomputeHistory(payment);
        verify(recurringPaymentRepository).save(payment);
        assertThat(payment.getAverageAmount()).isEqualByComparingTo("-20.00");
        assertThat(payment.getIsIncome()).isFalse();
    }

    @Test
    void targetedRecalculationKeepsPaymentButDisablesItWhenNoTransactionsMatch() {
        Rule rule = rule();
        Transaction stale = transaction(UUID.randomUUID(), LocalDate.of(2025, 1, 10), "-20.00");
        RecurringPayment payment = payment("Streaming", true, PaymentType.RECURRING, List.of(rule));
        TransactionRecurringLink staleLink = link(stale, payment);

        when(recurringPaymentRepository.findByIdAndUserId(payment.getId(), userId)).thenReturn(Optional.of(payment));
        when(ruleRepository.findByRecurringPaymentIdAndUserId(payment.getId(), userId)).thenReturn(List.of(rule));
        when(linkRepository.findWithTransactionByRecurringPaymentIdAndUserId(payment.getId(), userId))
                .thenReturn(List.of(staleLink));
        when(transactionRepository.findUnlinkedTransactionsAfterForUser(any(), any())).thenReturn(List.of());
        when(ruleEvaluationService.findMatchingTransactions(List.of(rule), List.of(stale))).thenReturn(List.of());

        service.recalculateRecurringPaymentLinks(payment.getId());

        verify(linkRepository).delete(staleLink);
        verify(recurringPaymentRepository, never()).delete(payment);
        verify(paymentPeriodHistoryService).recomputeHistory(payment);
        verify(recurringPaymentRepository).save(payment);
        assertThat(payment.getIsActive()).isFalse();
        assertThat(payment.getAverageAmount()).isEqualByComparingTo("0.00");
    }

    private RecurringPayment payment(String name, boolean active, PaymentType type, List<Rule> rules) {
        RecurringPayment payment = new RecurringPayment();
        payment.setId(UUID.randomUUID());
        payment.setName(name);
        payment.setIsActive(active);
        payment.setPaymentType(type);
        payment.setCreatedAt(LocalDateTime.now());
        payment.setRules(rules);
        return payment;
    }

    private Rule rule() {
        Rule rule = new Rule();
        rule.setId(UUID.randomUUID());
        rule.setRuleType(RuleType.JARO_WINKLER);
        return rule;
    }

    private Transaction transaction(UUID id, LocalDate bookingDate) {
        return transaction(id, bookingDate, "0.00");
    }

    private Transaction transaction(UUID id, LocalDate bookingDate, String amount) {
        Transaction transaction = new Transaction();
        transaction.setId(id);
        transaction.setBookingDate(bookingDate);
        transaction.setAmount(new BigDecimal(amount));
        return transaction;
    }

    private TransactionRecurringLink link(Transaction transaction, RecurringPayment payment) {
        TransactionRecurringLink link = new TransactionRecurringLink();
        link.setTransaction(transaction);
        link.setRecurringPayment(payment);
        return link;
    }
}
