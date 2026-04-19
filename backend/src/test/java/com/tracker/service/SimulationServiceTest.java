package com.tracker.service;

import com.tracker.model.entity.RecurringPayment;
import com.tracker.model.entity.Rule;
import com.tracker.model.entity.Transaction;
import com.tracker.model.entity.TransactionRecurringLink;
import com.tracker.repository.RecurringPaymentRepository;
import com.tracker.repository.TransactionRecurringLinkRepository;
import com.tracker.repository.TransactionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SimulationServiceTest {

    @Mock
    private TransactionRepository transactionRepository;
    @Mock
    private RecurringPaymentRepository recurringPaymentRepository;
    @Mock
    private TransactionRecurringLinkRepository linkRepository;
    @Mock
    private RuleEvaluationService ruleEvaluationService;
    @Mock
    private UserContextService userContextService;
    @Mock
    private AdditionalMatchingService additionalMatchingService;

    private SimulationService service;
    private UUID userId;

    @BeforeEach
    void setUp() {
        service = new SimulationService(
                transactionRepository,
                recurringPaymentRepository,
                linkRepository,
                ruleEvaluationService,
                userContextService,
                additionalMatchingService
        );
        userId = UUID.randomUUID();
        when(userContextService.getCurrentUserId()).thenReturn(userId);
        when(additionalMatchingService.matchGroups(anyList(), any())).thenReturn(java.util.Map.of());
        when(additionalMatchingService.sortNewestFirst(any())).thenAnswer(invocation -> ((java.util.Collection<Transaction>) invocation.getArgument(0)).stream().toList());
    }

    @Test
    void simulate_returnsMatchesAndDetectsOverlapViaExistingRulesAndLinkedTransactions() {
        Rule simulatedRule = new Rule();
        Rule existingRule = new Rule();
        Transaction unlinked = transaction("Gym");
        Transaction linked = transaction("Spotify");
        RecurringPayment first = payment("Gym Membership", existingRule);
        RecurringPayment second = payment("Spotify", new Rule());

        when(transactionRepository.findUnlinkedTransactionsAfterForUser(any(), org.mockito.ArgumentMatchers.eq(userId)))
                .thenReturn(List.of(unlinked));
        when(recurringPaymentRepository.findByUserIdAndIsActiveTrue(userId)).thenReturn(List.of(first, second));
        when(linkRepository.findWithTransactionByRecurringPaymentId(second.getId())).thenReturn(List.of(link(linked)));
        when(ruleEvaluationService.findMatchingTransactions(anyList(), anyList())).thenAnswer(invocation -> {
            List<Rule> rules = invocation.getArgument(0);
            List<Transaction> transactions = invocation.getArgument(1);
            if (rules.contains(existingRule) && transactions.contains(unlinked)) {
                return List.of(unlinked);
            }
            if (rules.contains(simulatedRule) && transactions.contains(linked)) {
                return List.of(linked);
            }
            if (rules.contains(simulatedRule) && transactions.contains(unlinked)) {
                return List.of(unlinked);
            }
            return List.of();
        });

        SimulationService.SimulationResult result = service.simulate(List.of(simulatedRule));

        assertThat(result.matchingTransactions()).containsExactly(unlinked);
        assertThat(result.overlappingPayments())
                .extracting(SimulationService.OverlappingPayment::name)
                .containsExactlyInAnyOrder("Gym Membership", "Spotify");
    }

    @Test
    void simulate_returnsNoOverlapsWhenRulesAndLinkedTransactionsDoNotMatch() {
        Rule simulatedRule = new Rule();
        Transaction unlinked = transaction("Rent");
        RecurringPayment paymentWithNoRules = payment("Utilities", List.of());
        RecurringPayment paymentWithUnrelatedLinks = payment("Insurance", List.of(new Rule()));
        Transaction linked = transaction("Groceries");

        when(transactionRepository.findUnlinkedTransactionsAfterForUser(any(), org.mockito.ArgumentMatchers.eq(userId)))
                .thenReturn(List.of(unlinked));
        when(recurringPaymentRepository.findByUserIdAndIsActiveTrue(userId))
                .thenReturn(List.of(paymentWithNoRules, paymentWithUnrelatedLinks));
        when(linkRepository.findWithTransactionByRecurringPaymentId(paymentWithNoRules.getId())).thenReturn(List.of());
        when(linkRepository.findWithTransactionByRecurringPaymentId(paymentWithUnrelatedLinks.getId()))
                .thenReturn(List.of(link(linked)));
        when(ruleEvaluationService.findMatchingTransactions(anyList(), anyList())).thenReturn(List.of());

        SimulationService.SimulationResult result = service.simulate(List.of(simulatedRule));

        assertThat(result.matchingTransactions()).isEmpty();
        assertThat(result.overlappingPayments()).isEmpty();
    }

    private RecurringPayment payment(String name, Rule rule) {
        return payment(name, List.of(rule));
    }

    private RecurringPayment payment(String name, List<Rule> rules) {
        RecurringPayment payment = new RecurringPayment();
        payment.setId(UUID.randomUUID());
        payment.setName(name);
        payment.setRules(rules);
        return payment;
    }

    private Transaction transaction(String partnerName) {
        Transaction transaction = new Transaction();
        transaction.setId(UUID.randomUUID());
        transaction.setPartnerName(partnerName);
        transaction.setBookingDate(LocalDate.now());
        return transaction;
    }

    private TransactionRecurringLink link(Transaction transaction) {
        TransactionRecurringLink link = new TransactionRecurringLink();
        link.setTransaction(transaction);
        return link;
    }
}
