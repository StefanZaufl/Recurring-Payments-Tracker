package com.tracker.service;

import com.tracker.model.entity.RecurringPayment;
import com.tracker.model.entity.Transaction;
import com.tracker.model.entity.TransactionRecurringLink;
import com.tracker.repository.CategoryRepository;
import com.tracker.repository.RecurringPaymentRepository;
import com.tracker.repository.TransactionRecurringLinkRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class RecurringPaymentService {

    private final RecurringPaymentRepository recurringPaymentRepository;
    private final TransactionRecurringLinkRepository linkRepository;
    private final CategoryRepository categoryRepository;

    public RecurringPaymentService(RecurringPaymentRepository recurringPaymentRepository,
                                   TransactionRecurringLinkRepository linkRepository,
                                   CategoryRepository categoryRepository) {
        this.recurringPaymentRepository = recurringPaymentRepository;
        this.linkRepository = linkRepository;
        this.categoryRepository = categoryRepository;
    }

    @Transactional(readOnly = true)
    public List<RecurringPayment> getAllRecurringPayments() {
        return recurringPaymentRepository.findAll();
    }

    @Transactional(readOnly = true)
    public Optional<RecurringPayment> getById(UUID id) {
        return recurringPaymentRepository.findById(id);
    }

    @Transactional
    public Optional<RecurringPayment> update(UUID id, String name, UUID categoryId, Boolean isActive) {
        return recurringPaymentRepository.findById(id).map(payment -> {
            if (name != null) {
                payment.setName(name);
            }
            if (categoryId != null) {
                categoryRepository.findById(categoryId).ifPresent(payment::setCategory);
            }
            if (isActive != null) {
                payment.setIsActive(isActive);
            }
            return recurringPaymentRepository.save(payment);
        });
    }

    @Transactional(readOnly = true)
    public List<Transaction> getTransactionsForPayment(UUID recurringPaymentId) {
        return linkRepository.findByRecurringPaymentId(recurringPaymentId).stream()
                .map(TransactionRecurringLink::getTransaction)
                .toList();
    }
}
