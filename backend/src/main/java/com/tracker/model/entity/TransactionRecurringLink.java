package com.tracker.model.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.io.Serializable;
import java.math.BigDecimal;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "transaction_recurring_link")
@IdClass(TransactionRecurringLink.TransactionRecurringLinkId.class)
@Getter
@Setter
@NoArgsConstructor
public class TransactionRecurringLink {

    @Id
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "transaction_id")
    private Transaction transaction;

    @Id
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "recurring_payment_id")
    private RecurringPayment recurringPayment;

    @Column(name = "confidence_score", precision = 3, scale = 2)
    private BigDecimal confidenceScore;

    @Getter
    @Setter
    @NoArgsConstructor
    public static class TransactionRecurringLinkId implements Serializable {
        private UUID transaction;
        private UUID recurringPayment;

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (o == null || getClass() != o.getClass()) return false;
            TransactionRecurringLinkId that = (TransactionRecurringLinkId) o;
            return Objects.equals(transaction, that.transaction) && Objects.equals(recurringPayment, that.recurringPayment);
        }

        @Override
        public int hashCode() {
            return Objects.hash(transaction, recurringPayment);
        }
    }
}
