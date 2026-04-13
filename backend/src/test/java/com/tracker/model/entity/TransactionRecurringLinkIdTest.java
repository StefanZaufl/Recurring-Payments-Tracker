package com.tracker.model.entity;

import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class TransactionRecurringLinkIdTest {

    @Test
    void equalsAndHashCode_coverIdentityNullAndFieldComparisons() {
        UUID transactionId = UUID.randomUUID();
        UUID paymentId = UUID.randomUUID();

        TransactionRecurringLink.TransactionRecurringLinkId left = new TransactionRecurringLink.TransactionRecurringLinkId();
        left.setTransaction(transactionId);
        left.setRecurringPayment(paymentId);

        TransactionRecurringLink.TransactionRecurringLinkId same = new TransactionRecurringLink.TransactionRecurringLinkId();
        same.setTransaction(transactionId);
        same.setRecurringPayment(paymentId);

        TransactionRecurringLink.TransactionRecurringLinkId differentTransaction = new TransactionRecurringLink.TransactionRecurringLinkId();
        differentTransaction.setTransaction(UUID.randomUUID());
        differentTransaction.setRecurringPayment(paymentId);

        TransactionRecurringLink.TransactionRecurringLinkId differentPayment = new TransactionRecurringLink.TransactionRecurringLinkId();
        differentPayment.setTransaction(transactionId);
        differentPayment.setRecurringPayment(UUID.randomUUID());

        TransactionRecurringLink.TransactionRecurringLinkId allNull = new TransactionRecurringLink.TransactionRecurringLinkId();

        assertThat(left).isEqualTo(left);
        assertThat(left).isEqualTo(same);
        assertThat(left.hashCode()).isEqualTo(same.hashCode());
        assertThat(left).isNotEqualTo(differentTransaction);
        assertThat(left).isNotEqualTo(differentPayment);
        assertThat(left).isNotEqualTo(allNull);
        assertThat(left).isNotEqualTo(null);
        assertThat(left).isNotEqualTo("not-an-id");
        assertThat(allNull).isEqualTo(new TransactionRecurringLink.TransactionRecurringLinkId());
    }
}
