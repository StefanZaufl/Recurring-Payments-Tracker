package com.tracker.repository;

import com.tracker.model.entity.PaymentPeriodHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PaymentPeriodHistoryRepository extends JpaRepository<PaymentPeriodHistory, UUID> {

    List<PaymentPeriodHistory> findByRecurringPaymentIdAndUserIdOrderByPeriodStartAsc(UUID recurringPaymentId, UUID userId);

    Optional<PaymentPeriodHistory> findByRecurringPaymentIdAndPeriodStart(UUID recurringPaymentId, LocalDate periodStart);

    List<PaymentPeriodHistory> findTop4ByRecurringPaymentIdOrderByPeriodStartDesc(UUID recurringPaymentId);

    void deleteByRecurringPaymentId(UUID recurringPaymentId);

    long countByRecurringPaymentId(UUID recurringPaymentId);
}
