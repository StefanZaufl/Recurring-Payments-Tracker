package com.tracker.repository;

import com.tracker.model.entity.TransactionRecurringLink;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface TransactionRecurringLinkRepository extends JpaRepository<TransactionRecurringLink, TransactionRecurringLink.TransactionRecurringLinkId> {

    List<TransactionRecurringLink> findByRecurringPaymentId(UUID recurringPaymentId);

    List<TransactionRecurringLink> findByRecurringPaymentIdAndUserId(UUID recurringPaymentId, UUID userId);
}
