package com.tracker.recurringpayments.application;

import com.tracker.recurringpayments.domain.Frequency;
import com.tracker.recurringpayments.domain.RecurringPayment;
import com.tracker.transactions.domain.Transaction;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class RecurringPaymentLifecycleServiceTest {

    private final RecurringPaymentLifecycleService service = new RecurringPaymentLifecycleService();

    @Test
    void refreshLifecycleDatesUsesFirstLinkedTransactionAsStartDate() {
        RecurringPayment payment = new RecurringPayment();

        service.refreshLifecycleDates(payment, List.of(
                tx(LocalDate.of(2025, 3, 15)),
                tx(LocalDate.of(2025, 1, 15)),
                tx(LocalDate.of(2025, 2, 15))));

        assertThat(payment.getStartDate()).isEqualTo(LocalDate.of(2025, 1, 15));
    }

    @Test
    void refreshLifecycleDatesClearsEndDateWhenANewerLinkedTransactionAppears() {
        RecurringPayment payment = new RecurringPayment();
        payment.setEndDate(LocalDate.of(2025, 2, 15));

        service.refreshLifecycleDates(payment, List.of(
                tx(LocalDate.of(2025, 1, 15)),
                tx(LocalDate.of(2025, 3, 15))));

        assertThat(payment.getEndDate()).isNull();
    }

    @Test
    void refreshEndDateFromStalenessUsesLastLinkedDateWhenPaymentIsOverdue() {
        RecurringPayment payment = new RecurringPayment();
        payment.setIsActive(true);
        payment.setFrequency(Frequency.MONTHLY);

        service.refreshEndDateFromStaleness(payment, List.of(
                tx(LocalDate.of(2025, 1, 15)),
                tx(LocalDate.of(2025, 2, 15))), LocalDate.of(2025, 4, 3));

        assertThat(payment.getEndDate()).isEqualTo(LocalDate.of(2025, 2, 15));
    }

    @Test
    void refreshEndDateFromStalenessKeepsActivePaymentOpenWithinGraceWindow() {
        RecurringPayment payment = new RecurringPayment();
        payment.setIsActive(true);
        payment.setFrequency(Frequency.MONTHLY);

        service.refreshEndDateFromStaleness(payment, List.of(tx(LocalDate.of(2025, 1, 15))),
                LocalDate.of(2025, 3, 1));

        assertThat(payment.getEndDate()).isNull();
    }

    @Test
    void monthlyPaymentIsStaleOnlyAfterExpectedDateAndGraceWindow() {
        LocalDate lastLinkedDate = LocalDate.of(2025, 1, 15);

        assertThat(service.isStale(lastLinkedDate, Frequency.MONTHLY, LocalDate.of(2025, 3, 1))).isFalse();
        assertThat(service.isStale(lastLinkedDate, Frequency.MONTHLY, LocalDate.of(2025, 3, 3))).isTrue();
    }

    @Test
    void staleDeadlineUsesFrequencySpecificGraceWindows() {
        LocalDate lastLinkedDate = LocalDate.of(2025, 1, 15);

        assertThat(service.staleDeadline(lastLinkedDate, Frequency.MONTHLY)).isEqualTo(LocalDate.of(2025, 3, 2));
        assertThat(service.staleDeadline(lastLinkedDate, Frequency.QUARTERLY)).isEqualTo(LocalDate.of(2025, 5, 30));
        assertThat(service.staleDeadline(lastLinkedDate, Frequency.YEARLY)).isEqualTo(LocalDate.of(2026, 3, 16));
    }

    private Transaction tx(LocalDate bookingDate) {
        Transaction tx = new Transaction();
        tx.setBookingDate(bookingDate);
        tx.setAmount(BigDecimal.TEN);
        return tx;
    }
}
