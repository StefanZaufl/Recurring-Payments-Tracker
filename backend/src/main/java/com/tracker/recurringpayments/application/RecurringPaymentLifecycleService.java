package com.tracker.recurringpayments.application;

import com.tracker.recurringpayments.domain.Frequency;
import com.tracker.recurringpayments.domain.RecurringPayment;
import com.tracker.transactions.domain.Transaction;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;

@Service
public class RecurringPaymentLifecycleService {

    static final int MONTHLY_STALE_GRACE_DAYS = 15;
    static final int QUARTERLY_STALE_GRACE_DAYS = 45;
    static final int YEARLY_STALE_GRACE_DAYS = 60;

    public void refreshLifecycleDates(RecurringPayment payment, List<Transaction> transactions) {
        if (transactions.isEmpty()) {
            return;
        }
        LocalDate firstLinkedDate = transactions.stream()
                .map(Transaction::getBookingDate)
                .min(LocalDate::compareTo)
                .orElse(null);
        LocalDate lastLinkedDate = transactions.stream()
                .map(Transaction::getBookingDate)
                .max(LocalDate::compareTo)
                .orElse(null);

        payment.setStartDate(firstLinkedDate);
        if (payment.getEndDate() != null && lastLinkedDate != null && lastLinkedDate.isAfter(payment.getEndDate())) {
            payment.setEndDate(null);
        }
    }

    public void refreshEndDateFromStaleness(RecurringPayment payment, List<Transaction> linkedTransactions,
                                            LocalDate referenceDate) {
        if (referenceDate == null
                || !Boolean.TRUE.equals(payment.getIsActive())
                || payment.getEndDate() != null
                || payment.getFrequency() == null
                || linkedTransactions.isEmpty()) {
            return;
        }

        LocalDate lastLinkedDate = linkedTransactions.stream()
                .map(Transaction::getBookingDate)
                .max(LocalDate::compareTo)
                .orElse(null);
        if (isStale(lastLinkedDate, payment.getFrequency(), referenceDate)) {
            payment.setEndDate(lastLinkedDate);
        }
    }

    boolean isStale(LocalDate lastLinkedDate, Frequency frequency, LocalDate referenceDate) {
        if (lastLinkedDate == null || frequency == null || referenceDate == null) {
            return false;
        }
        return referenceDate.isAfter(staleDeadline(lastLinkedDate, frequency));
    }

    LocalDate staleDeadline(LocalDate lastLinkedDate, Frequency frequency) {
        return switch (frequency) {
            case MONTHLY -> lastLinkedDate.plusMonths(1).plusDays(MONTHLY_STALE_GRACE_DAYS);
            case QUARTERLY -> lastLinkedDate.plusMonths(3).plusDays(QUARTERLY_STALE_GRACE_DAYS);
            case YEARLY -> lastLinkedDate.plusYears(1).plusDays(YEARLY_STALE_GRACE_DAYS);
        };
    }
}
