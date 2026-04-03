package com.tracker.repository;

import com.tracker.model.entity.RecurringPayment;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface RecurringPaymentRepository extends JpaRepository<RecurringPayment, UUID> {

    @EntityGraph(attributePaths = "rules")
    List<RecurringPayment> findByIsActiveTrue();

    @Override
    @EntityGraph(attributePaths = "rules")
    List<RecurringPayment> findAll();
}
