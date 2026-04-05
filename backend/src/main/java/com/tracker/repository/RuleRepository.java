package com.tracker.repository;

import com.tracker.model.entity.Rule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface RuleRepository extends JpaRepository<Rule, UUID> {

    List<Rule> findByRecurringPaymentId(UUID recurringPaymentId);

    Optional<Rule> findByIdAndRecurringPaymentId(UUID id, UUID recurringPaymentId);

    void deleteByIdAndRecurringPaymentId(UUID id, UUID recurringPaymentId);

    List<Rule> findByRecurringPaymentIdAndUserId(UUID recurringPaymentId, UUID userId);

    Optional<Rule> findByIdAndRecurringPaymentIdAndUserId(UUID id, UUID recurringPaymentId, UUID userId);

    void deleteByIdAndRecurringPaymentIdAndUserId(UUID id, UUID recurringPaymentId, UUID userId);
}
