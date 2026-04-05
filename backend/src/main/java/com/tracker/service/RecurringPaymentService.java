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
    private final UserContextService userContextService;

    public RecurringPaymentService(RecurringPaymentRepository recurringPaymentRepository,
                                   TransactionRecurringLinkRepository linkRepository,
                                   CategoryRepository categoryRepository,
                                   UserContextService userContextService) {
        this.recurringPaymentRepository = recurringPaymentRepository;
        this.linkRepository = linkRepository;
        this.categoryRepository = categoryRepository;
        this.userContextService = userContextService;
    }

    @Transactional(readOnly = true)
    public List<RecurringPayment> getAllRecurringPayments() {
        return recurringPaymentRepository.findByUserId(userContextService.getCurrentUserId());
    }

    @Transactional(readOnly = true)
    public Optional<RecurringPayment> getById(UUID id) {
        return recurringPaymentRepository.findByIdAndUserId(id, userContextService.getCurrentUserId());
    }

    @Transactional
    public Optional<RecurringPayment> update(UUID id, String name, UUID categoryId, Boolean isActive) {
        UUID currentUserId = userContextService.getCurrentUserId();
        return recurringPaymentRepository.findByIdAndUserId(id, currentUserId).map(payment -> {
            if (name != null) {
                payment.setName(name);
            }
            if (categoryId != null) {
                categoryRepository.findByIdAndUserId(categoryId, currentUserId).ifPresent(payment::setCategory);
            }
            if (isActive != null) {
                payment.setIsActive(isActive);
            }
            return recurringPaymentRepository.save(payment);
        });
    }

    @Transactional(readOnly = true)
    public List<Transaction> getTransactionsForPayment(UUID recurringPaymentId) {
        UUID currentUserId = userContextService.getCurrentUserId();
        return linkRepository.findByRecurringPaymentIdAndUserId(recurringPaymentId, currentUserId).stream()
                .map(TransactionRecurringLink::getTransaction)
                .toList();
    }
}
