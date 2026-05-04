package com.tracker.service;

import com.tracker.model.entity.AppDataMigration;
import com.tracker.model.entity.RecurringPayment;
import com.tracker.model.entity.Transaction;
import com.tracker.model.entity.TransactionRecurringLink;
import com.tracker.model.entity.User;
import com.tracker.repository.AppDataMigrationRepository;
import com.tracker.repository.RecurringPaymentRepository;
import com.tracker.repository.TransactionRecurringLinkRepository;
import com.tracker.repository.TransactionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RecurringPaymentLifecycleDateBackfillServiceTest {

    @Mock
    private AppDataMigrationRepository migrationRepository;
    @Mock
    private RecurringPaymentRepository recurringPaymentRepository;
    @Mock
    private TransactionRecurringLinkRepository linkRepository;
    @Mock
    private TransactionRepository transactionRepository;
    @Mock
    private RecurringPaymentLifecycleService lifecycleService;

    private RecurringPaymentLifecycleDateBackfillService service;

    @BeforeEach
    void setUp() {
        service = new RecurringPaymentLifecycleDateBackfillService(
                migrationRepository,
                recurringPaymentRepository,
                linkRepository,
                transactionRepository,
                lifecycleService
        );
    }

    @Test
    void backfillOnceSkipsWhenMigrationMarkerExists() {
        when(migrationRepository.existsById(RecurringPaymentLifecycleDateBackfillService.MIGRATION_KEY))
                .thenReturn(true);

        int processedPayments = service.backfillOnce();

        assertThat(processedPayments).isZero();
        verify(recurringPaymentRepository, never()).findAll();
        verify(migrationRepository, never()).save(any());
    }

    @Test
    void backfillOnceRefreshesLifecycleDatesUsingSharedLifecycleService() {
        User user = new User();
        user.setId(UUID.randomUUID());
        RecurringPayment payment = new RecurringPayment();
        payment.setId(UUID.randomUUID());
        payment.setUser(user);
        Transaction first = tx(LocalDate.of(2025, 1, 15));
        Transaction second = tx(LocalDate.of(2025, 2, 15));
        List<TransactionRecurringLink> links = List.of(link(first, payment), link(second, payment));
        LocalDate referenceDate = LocalDate.of(2025, 4, 3);

        when(migrationRepository.existsById(RecurringPaymentLifecycleDateBackfillService.MIGRATION_KEY))
                .thenReturn(false);
        when(recurringPaymentRepository.findAll()).thenReturn(List.of(payment));
        when(linkRepository.findWithTransactionByRecurringPaymentId(payment.getId())).thenReturn(links);
        when(transactionRepository.findLatestNonInterAccountBookingDateByUserId(user.getId()))
                .thenReturn(Optional.of(referenceDate));

        int processedPayments = service.backfillOnce();

        assertThat(processedPayments).isEqualTo(1);
        verify(lifecycleService).refreshLifecycleDates(payment, List.of(first, second));
        verify(lifecycleService).refreshEndDateFromStaleness(payment, List.of(first, second), referenceDate);
        verify(recurringPaymentRepository).save(payment);

        ArgumentCaptor<AppDataMigration> markerCaptor = ArgumentCaptor.forClass(AppDataMigration.class);
        verify(migrationRepository).save(markerCaptor.capture());
        assertThat(markerCaptor.getValue().getMigrationKey())
                .isEqualTo(RecurringPaymentLifecycleDateBackfillService.MIGRATION_KEY);
    }

    @Test
    void backfillOnceMarksMigrationAppliedEvenWhenNoPaymentsHaveLinks() {
        RecurringPayment payment = new RecurringPayment();
        payment.setId(UUID.randomUUID());

        when(migrationRepository.existsById(RecurringPaymentLifecycleDateBackfillService.MIGRATION_KEY))
                .thenReturn(false);
        when(recurringPaymentRepository.findAll()).thenReturn(List.of(payment));
        when(linkRepository.findWithTransactionByRecurringPaymentId(payment.getId())).thenReturn(List.of());

        int processedPayments = service.backfillOnce();

        assertThat(processedPayments).isZero();
        verify(lifecycleService, never()).refreshLifecycleDates(any(), any());
        verify(recurringPaymentRepository, never()).save(any());
        verify(migrationRepository).save(any(AppDataMigration.class));
    }

    private Transaction tx(LocalDate bookingDate) {
        Transaction transaction = new Transaction();
        transaction.setId(UUID.randomUUID());
        transaction.setBookingDate(bookingDate);
        return transaction;
    }

    private TransactionRecurringLink link(Transaction transaction, RecurringPayment payment) {
        TransactionRecurringLink link = new TransactionRecurringLink();
        link.setTransaction(transaction);
        link.setRecurringPayment(payment);
        return link;
    }
}
