package com.tracker.repository;

import com.tracker.model.entity.Transaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Repository
public interface TransactionRepository extends JpaRepository<Transaction, UUID> {

    @Query("SELECT t FROM Transaction t WHERE " +
           "(:from IS NULL OR t.bookingDate >= :from) AND " +
           "(:to IS NULL OR t.bookingDate <= :to) AND " +
           "(:text IS NULL OR LOWER(t.partnerName) LIKE LOWER(CONCAT('%', :text, '%')) " +
           "OR LOWER(t.details) LIKE LOWER(CONCAT('%', :text, '%')))")
    Page<Transaction> findFiltered(
            @Param("from") LocalDate from,
            @Param("to") LocalDate to,
            @Param("text") String text,
            Pageable pageable);

    List<Transaction> findByBookingDateBetween(LocalDate from, LocalDate to);
}
