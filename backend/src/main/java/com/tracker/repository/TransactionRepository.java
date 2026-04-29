package com.tracker.repository;

import com.tracker.model.entity.Transaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface TransactionRepository extends JpaRepository<Transaction, UUID>, JpaSpecificationExecutor<Transaction>, TransactionRepositoryCustom {

    @Override
    @EntityGraph(attributePaths = "upload")
    Page<Transaction> findAll(Specification<Transaction> spec, Pageable pageable);

    @Override
    @EntityGraph(attributePaths = "upload")
    Optional<Transaction> findById(UUID id);

    List<Transaction> findByBookingDateBetween(LocalDate from, LocalDate to);

    List<Transaction> findByUserIdAndBookingDateBetween(UUID userId, LocalDate from, LocalDate to);

    List<Transaction> findByUserIdAndBookingDateBetweenAndIsInterAccountFalse(UUID userId, LocalDate from, LocalDate to);

    List<Transaction> findByUserIdAndBookingDateGreaterThanEqualAndIsInterAccountFalse(UUID userId, LocalDate cutoff);

    List<Transaction> findByUserId(UUID userId);

    @Query("SELECT t FROM Transaction t WHERE t.bookingDate >= :cutoff AND t.user.id = :userId AND t.isInterAccount = false AND t.id NOT IN " +
           "(SELECT trl.transaction.id FROM TransactionRecurringLink trl)")
    @EntityGraph(attributePaths = "upload")
    List<Transaction> findUnlinkedTransactionsAfterForUser(@Param("cutoff") LocalDate cutoff, @Param("userId") UUID userId);

    @Query("SELECT t FROM Transaction t WHERE t.bookingDate >= :cutoff AND t.user.id = :userId AND t.isInterAccount = false AND t.id NOT IN " +
           "(SELECT trl.transaction.id FROM TransactionRecurringLink trl)")
    @EntityGraph(attributePaths = "upload")
    Page<Transaction> findUnlinkedTransactionsAfterForUserPaged(@Param("cutoff") LocalDate cutoff, @Param("userId") UUID userId, Pageable pageable);

    @Query("SELECT t FROM Transaction t WHERE t.bookingDate BETWEEN :from AND :to AND t.user.id = :userId AND t.isInterAccount = false AND t.id NOT IN " +
           "(SELECT trl.transaction.id FROM TransactionRecurringLink trl)")
    List<Transaction> findUnlinkedTransactionsBetweenForUser(@Param("from") LocalDate from, @Param("to") LocalDate to, @Param("userId") UUID userId);
}
