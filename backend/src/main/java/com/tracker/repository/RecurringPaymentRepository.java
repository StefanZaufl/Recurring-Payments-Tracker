package com.tracker.repository;

import com.tracker.model.entity.PaymentType;
import com.tracker.model.entity.RecurringPayment;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface RecurringPaymentRepository extends JpaRepository<RecurringPayment, UUID> {

    @EntityGraph(attributePaths = "rules")
    List<RecurringPayment> findByIsActiveTrue();

    @Override
    @EntityGraph(attributePaths = {"rules", "category"})
    List<RecurringPayment> findAll();

    @EntityGraph(attributePaths = {"rules", "category"})
    List<RecurringPayment> findByUserIdAndIsActiveTrue(UUID userId);

    @EntityGraph(attributePaths = {"rules", "category"})
    List<RecurringPayment> findByUserId(UUID userId);

    @EntityGraph(attributePaths = {"rules", "category"})
    Optional<RecurringPayment> findByIdAndUserId(UUID id, UUID userId);

    @EntityGraph(attributePaths = {"rules", "category"})
    List<RecurringPayment> findByUserIdAndIsActiveTrueAndPaymentType(UUID userId, PaymentType paymentType);
}
