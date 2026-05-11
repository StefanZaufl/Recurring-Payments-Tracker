package com.tracker.recurringpayments.application;

import com.tracker.shared.migration.AppDataMigration;
import com.tracker.recurringpayments.domain.RecurringPayment;
import com.tracker.transactions.domain.Transaction;
import com.tracker.recurringpayments.domain.TransactionRecurringLink;
import com.tracker.shared.migration.AppDataMigrationRepository;
import com.tracker.recurringpayments.persistence.RecurringPaymentRepository;
import com.tracker.recurringpayments.persistence.TransactionRecurringLinkRepository;
import com.tracker.transactions.persistence.TransactionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class RecurringPaymentLifecycleDateBackfillService {

    static final String MIGRATION_KEY = "recurring-payment-lifecycle-dates-v1";

    private final AppDataMigrationRepository migrationRepository;
    private final RecurringPaymentRepository recurringPaymentRepository;
    private final TransactionRecurringLinkRepository linkRepository;
    private final TransactionRepository transactionRepository;
    private final RecurringPaymentLifecycleService lifecycleService;

    public RecurringPaymentLifecycleDateBackfillService(AppDataMigrationRepository migrationRepository,
                                                       RecurringPaymentRepository recurringPaymentRepository,
                                                       TransactionRecurringLinkRepository linkRepository,
                                                       TransactionRepository transactionRepository,
                                                       RecurringPaymentLifecycleService lifecycleService) {
        this.migrationRepository = migrationRepository;
        this.recurringPaymentRepository = recurringPaymentRepository;
        this.linkRepository = linkRepository;
        this.transactionRepository = transactionRepository;
        this.lifecycleService = lifecycleService;
    }

    @Transactional
    public int backfillOnce() {
        if (migrationRepository.existsById(MIGRATION_KEY)) {
            return 0;
        }

        int processedPayments = 0;
        for (RecurringPayment payment : recurringPaymentRepository.findAll()) {
            List<Transaction> linkedTransactions = linkRepository
                    .findWithTransactionByRecurringPaymentId(payment.getId())
                    .stream()
                    .map(TransactionRecurringLink::getTransaction)
                    .toList();

            if (linkedTransactions.isEmpty()) {
                continue;
            }

            lifecycleService.refreshLifecycleDates(payment, linkedTransactions);
            referenceDateFor(payment)
                    .ifPresent(referenceDate -> lifecycleService.refreshEndDateFromStaleness(
                            payment, linkedTransactions, referenceDate));
            recurringPaymentRepository.save(payment);
            processedPayments++;
        }

        migrationRepository.save(new AppDataMigration(MIGRATION_KEY));
        return processedPayments;
    }

    private Optional<LocalDate> referenceDateFor(RecurringPayment payment) {
        if (payment.getUser() == null) {
            return Optional.empty();
        }
        UUID userId = payment.getUser().getId();
        return transactionRepository.findLatestNonInterAccountBookingDateByUserId(userId);
    }
}
