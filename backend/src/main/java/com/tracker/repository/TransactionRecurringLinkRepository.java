package com.tracker.repository;

import com.tracker.model.entity.TransactionRecurringLink;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Repository
public interface TransactionRecurringLinkRepository extends JpaRepository<TransactionRecurringLink, TransactionRecurringLink.TransactionRecurringLinkId> {

    List<TransactionRecurringLink> findByRecurringPaymentId(UUID recurringPaymentId);

    List<TransactionRecurringLink> findByRecurringPaymentIdAndUserId(UUID recurringPaymentId, UUID userId);

    @EntityGraph(attributePaths = {"transaction", "transaction.upload"})
    List<TransactionRecurringLink> findWithTransactionByRecurringPaymentId(UUID recurringPaymentId);

    @EntityGraph(attributePaths = {"transaction", "transaction.upload"})
    List<TransactionRecurringLink> findWithTransactionByRecurringPaymentIdAndTransactionBookingDateBetween(
            UUID recurringPaymentId,
            LocalDate startDate,
            LocalDate endDate
    );

    @EntityGraph(attributePaths = {"transaction", "transaction.upload"})
    List<TransactionRecurringLink> findWithTransactionByRecurringPaymentIdAndUserId(UUID recurringPaymentId, UUID userId);

    @EntityGraph(attributePaths = {"transaction", "recurringPayment"})
    List<TransactionRecurringLink> findByUserId(UUID userId);

    @Query("SELECT link FROM TransactionRecurringLink link JOIN FETCH link.recurringPayment " +
           "WHERE link.transaction.id = :transactionId AND link.user.id = :userId")
    List<TransactionRecurringLink> findWithRecurringPaymentByTransactionIdAndUserId(@Param("transactionId") UUID transactionId,
                                                                                    @Param("userId") UUID userId);

    @Query("SELECT link FROM TransactionRecurringLink link JOIN FETCH link.recurringPayment " +
           "WHERE link.transaction.id IN :transactionIds AND link.user.id = :userId")
    List<TransactionRecurringLink> findWithRecurringPaymentByTransactionIdInAndUserId(
            @Param("transactionIds") List<UUID> transactionIds,
            @Param("userId") UUID userId);

    void deleteByRecurringPaymentId(UUID recurringPaymentId);
}
