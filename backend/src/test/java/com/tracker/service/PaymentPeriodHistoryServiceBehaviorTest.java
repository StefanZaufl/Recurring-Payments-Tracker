package com.tracker.service;

import com.tracker.model.entity.Frequency;
import com.tracker.model.entity.PaymentPeriodHistory;
import com.tracker.model.entity.RecurringPayment;
import com.tracker.model.entity.Transaction;
import com.tracker.model.entity.TransactionRecurringLink;
import com.tracker.model.entity.User;
import com.tracker.repository.PaymentPeriodHistoryRepository;
import com.tracker.repository.RecurringPaymentRepository;
import com.tracker.repository.TransactionRecurringLinkRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PaymentPeriodHistoryServiceBehaviorTest {

    @Mock
    private PaymentPeriodHistoryRepository historyRepository;
    @Mock
    private TransactionRecurringLinkRepository linkRepository;
    @Mock
    private RecurringPaymentRepository recurringPaymentRepository;
    @Mock
    private UserContextService userContextService;

    private PaymentPeriodHistoryService service;

    @BeforeEach
    void setUp() {
        service = new PaymentPeriodHistoryService(
                historyRepository,
                linkRepository,
                recurringPaymentRepository,
                userContextService
        );
    }

    @Test
    void recomputeHistory_deletesExistingEntriesAndStopsWhenNoLinksExist() {
        RecurringPayment payment = payment(Frequency.MONTHLY);
        when(linkRepository.findWithTransactionByRecurringPaymentId(payment.getId())).thenReturn(List.of());

        service.recomputeHistory(payment);

        verify(historyRepository).deleteByRecurringPaymentId(payment.getId());
        verify(historyRepository).flush();
        verify(historyRepository, never()).save(any(PaymentPeriodHistory.class));
    }

    @Test
    void recomputeHistory_groupsTransactionsIntoPeriodsAndRoundsAmounts() {
        RecurringPayment payment = payment(Frequency.QUARTERLY);
        when(linkRepository.findWithTransactionByRecurringPaymentId(payment.getId())).thenReturn(List.of(
                link(LocalDate.of(2025, 1, 10), "-10.105"),
                link(LocalDate.of(2025, 3, 5), "-4.105"),
                link(LocalDate.of(2025, 4, 1), "-7.00")
        ));

        service.recomputeHistory(payment);

        ArgumentCaptor<PaymentPeriodHistory> captor = ArgumentCaptor.forClass(PaymentPeriodHistory.class);
        verify(historyRepository, times(2)).save(captor.capture());
        List<PaymentPeriodHistory> savedEntries = captor.getAllValues();
        assertThat(savedEntries)
                .extracting(PaymentPeriodHistory::getPeriodStart)
                .containsExactlyInAnyOrder(LocalDate.of(2025, 1, 1), LocalDate.of(2025, 4, 1));
        assertThat(savedEntries)
                .extracting(PaymentPeriodHistory::getPeriodEnd)
                .containsExactlyInAnyOrder(LocalDate.of(2025, 3, 31), LocalDate.of(2025, 6, 30));
        assertThat(savedEntries)
                .extracting(PaymentPeriodHistory::getAmount)
                .containsExactlyInAnyOrder(new BigDecimal("-14.21"), new BigDecimal("-7.00"));
    }

    @Test
    void getRollingAverage_returnsNullWhenNoHistoryAndUsesMinRequestedPeriods() {
        UUID recurringPaymentId = UUID.randomUUID();
        when(historyRepository.findTop4ByRecurringPaymentIdOrderByPeriodStartDesc(recurringPaymentId))
                .thenReturn(List.of());

        assertThat(service.getRollingAverage(recurringPaymentId, 4)).isNull();

        when(historyRepository.findTop4ByRecurringPaymentIdOrderByPeriodStartDesc(recurringPaymentId))
                .thenReturn(List.of(history("10.00"), history("20.00")));

        assertThat(service.getRollingAverage(recurringPaymentId, 4)).isEqualByComparingTo("15.00");
    }

    @Test
    void getHistory_usesCurrentUserScope() {
        UUID recurringPaymentId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        List<PaymentPeriodHistory> history = List.of(history("5.00"));
        when(userContextService.getCurrentUserId()).thenReturn(userId);
        when(historyRepository.findByRecurringPaymentIdAndUserIdOrderByPeriodStartAsc(recurringPaymentId, userId))
                .thenReturn(history);

        assertThat(service.getHistory(recurringPaymentId)).isEqualTo(history);
    }

    @Test
    void getHistory_filtersByPeriodOverlapWhenRangeIsProvided() {
        UUID recurringPaymentId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        LocalDate from = LocalDate.of(2025, 1, 1);
        LocalDate to = LocalDate.of(2025, 12, 31);
        List<PaymentPeriodHistory> history = List.of(history("100.00"));
        when(userContextService.getCurrentUserId()).thenReturn(userId);
        when(historyRepository.findByRecurringPaymentIdAndUserIdAndPeriodStartLessThanEqualAndPeriodEndGreaterThanEqualOrderByPeriodStartAsc(
                recurringPaymentId,
                userId,
                to,
                from))
                .thenReturn(history);

        assertThat(service.getHistory(recurringPaymentId, from, to)).isEqualTo(history);
    }

    @Test
    void backfillHistory_skipsWhenDataAlreadyExistsOrNoPaymentsExistAndProcessesAllPaymentsOtherwise() {
        when(historyRepository.count()).thenReturn(1L);
        service.backfillHistoryOnStartup();
        verify(recurringPaymentRepository, never()).findAll();

        when(historyRepository.count()).thenReturn(0L);
        when(recurringPaymentRepository.findAll()).thenReturn(List.of());
        service.backfillHistoryOnStartup();
        verify(linkRepository, never()).findWithTransactionByRecurringPaymentId(any());

        RecurringPayment first = payment(Frequency.MONTHLY);
        RecurringPayment second = payment(Frequency.YEARLY);
        when(recurringPaymentRepository.findAll()).thenReturn(List.of(first, second));
        when(linkRepository.findWithTransactionByRecurringPaymentId(first.getId())).thenReturn(List.of(link(LocalDate.of(2025, 1, 1), "-10.00")));
        when(linkRepository.findWithTransactionByRecurringPaymentId(second.getId())).thenReturn(List.of(link(LocalDate.of(2025, 2, 1), "-20.00")));

        service.backfillHistoryOnStartup();

        verify(historyRepository, times(2)).deleteByRecurringPaymentId(any(UUID.class));
    }

    private RecurringPayment payment(Frequency frequency) {
        User user = new User();
        user.setId(UUID.randomUUID());

        RecurringPayment payment = new RecurringPayment();
        payment.setId(UUID.randomUUID());
        payment.setFrequency(frequency);
        payment.setUser(user);
        return payment;
    }

    private TransactionRecurringLink link(LocalDate bookingDate, String amount) {
        Transaction transaction = new Transaction();
        transaction.setBookingDate(bookingDate);
        transaction.setAmount(new BigDecimal(amount));

        TransactionRecurringLink link = new TransactionRecurringLink();
        link.setTransaction(transaction);
        return link;
    }

    private PaymentPeriodHistory history(String amount) {
        PaymentPeriodHistory history = new PaymentPeriodHistory();
        history.setAmount(new BigDecimal(amount));
        return history;
    }
}
