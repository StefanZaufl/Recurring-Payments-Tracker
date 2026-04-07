package com.tracker.service;

import com.tracker.model.entity.PaymentPeriodHistory;
import com.tracker.model.entity.RecurringPayment;
import com.tracker.model.entity.Transaction;
import com.tracker.model.entity.TransactionRecurringLink;
import com.tracker.model.entity.Frequency;
import com.tracker.repository.PaymentPeriodHistoryRepository;
import com.tracker.repository.RecurringPaymentRepository;
import com.tracker.repository.TransactionRecurringLinkRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Slf4j
public class PaymentPeriodHistoryService {

    private final PaymentPeriodHistoryRepository historyRepository;
    private final TransactionRecurringLinkRepository linkRepository;
    private final RecurringPaymentRepository recurringPaymentRepository;
    private final UserContextService userContextService;

    public PaymentPeriodHistoryService(PaymentPeriodHistoryRepository historyRepository,
                                        TransactionRecurringLinkRepository linkRepository,
                                        RecurringPaymentRepository recurringPaymentRepository,
                                        UserContextService userContextService) {
        this.historyRepository = historyRepository;
        this.linkRepository = linkRepository;
        this.recurringPaymentRepository = recurringPaymentRepository;
        this.userContextService = userContextService;
    }

    @Transactional
    public void recomputeHistory(RecurringPayment payment) {
        List<TransactionRecurringLink> links = linkRepository.findWithTransactionByRecurringPaymentId(payment.getId());
        Frequency frequency = payment.getFrequency() != null ? payment.getFrequency() : Frequency.MONTHLY;

        Map<LocalDate, BigDecimal> periodTotals = links.stream()
                .map(TransactionRecurringLink::getTransaction)
                .collect(Collectors.groupingBy(
                        tx -> computePeriodStart(tx.getBookingDate(), frequency),
                        Collectors.reducing(BigDecimal.ZERO, Transaction::getAmount, BigDecimal::add)
                ));

        for (Map.Entry<LocalDate, BigDecimal> entry : periodTotals.entrySet()) {
            LocalDate periodStart = entry.getKey();
            BigDecimal amount = entry.getValue();
            LocalDate periodEnd = computePeriodEnd(periodStart, frequency);

            historyRepository.findByRecurringPaymentIdAndPeriodStart(payment.getId(), periodStart)
                    .ifPresentOrElse(
                            existing -> {
                                existing.setAmount(amount.setScale(2, RoundingMode.HALF_UP));
                                existing.setUpdatedAt(LocalDateTime.now());
                                historyRepository.save(existing);
                            },
                            () -> {
                                PaymentPeriodHistory newEntry = new PaymentPeriodHistory();
                                newEntry.setRecurringPayment(payment);
                                newEntry.setPeriodStart(periodStart);
                                newEntry.setPeriodEnd(periodEnd);
                                newEntry.setAmount(amount.setScale(2, RoundingMode.HALF_UP));
                                newEntry.setUser(payment.getUser());
                                historyRepository.save(newEntry);
                            }
                    );
        }
    }

    public BigDecimal getRollingAverage(UUID recurringPaymentId, int periods) {
        List<PaymentPeriodHistory> recent = historyRepository
                .findTop4ByRecurringPaymentIdOrderByPeriodStartDesc(recurringPaymentId);

        if (recent.isEmpty()) {
            return null;
        }

        int count = Math.min(periods, recent.size());
        BigDecimal sum = recent.stream()
                .limit(count)
                .map(PaymentPeriodHistory::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return sum.divide(BigDecimal.valueOf(count), 2, RoundingMode.HALF_UP);
    }

    @Transactional(readOnly = true)
    public List<PaymentPeriodHistory> getHistory(UUID recurringPaymentId) {
        UUID userId = userContextService.getCurrentUserId();
        return historyRepository.findByRecurringPaymentIdAndUserIdOrderByPeriodStartAsc(recurringPaymentId, userId);
    }

    public static LocalDate computePeriodStart(LocalDate date, Frequency frequency) {
        if (frequency == null) {
            frequency = Frequency.MONTHLY;
        }
        return switch (frequency) {
            case QUARTERLY -> {
                int quarterMonth = ((date.getMonthValue() - 1) / 3) * 3 + 1;
                yield LocalDate.of(date.getYear(), quarterMonth, 1);
            }
            case YEARLY -> LocalDate.of(date.getYear(), 1, 1);
            case MONTHLY -> date.withDayOfMonth(1);
        };
    }

    public static LocalDate computePeriodEnd(LocalDate periodStart, Frequency frequency) {
        if (frequency == null) {
            frequency = Frequency.MONTHLY;
        }
        return switch (frequency) {
            case QUARTERLY -> periodStart.plusMonths(3).minusDays(1);
            case YEARLY -> periodStart.plusYears(1).minusDays(1);
            case MONTHLY -> periodStart.plusMonths(1).minusDays(1);
        };
    }

    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void backfillHistoryOnStartup() {
        try {
            long historyCount = historyRepository.count();
            if (historyCount > 0) {
                log.debug("Payment period history already populated ({} entries), skipping backfill", historyCount);
                return;
            }

            List<RecurringPayment> allPayments = recurringPaymentRepository.findAll();
            if (allPayments.isEmpty()) {
                return;
            }

            log.info("Backfilling payment period history for {} payments", allPayments.size());
            int count = 0;
            for (RecurringPayment payment : allPayments) {
                recomputeHistory(payment);
                count++;
            }
            log.info("Backfill complete: processed {} payments", count);
        } catch (Exception e) {
            log.error("Failed to backfill payment period history: " + e.getMessage(), e);
        }
    }
}
