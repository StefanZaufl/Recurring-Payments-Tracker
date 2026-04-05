package com.tracker.service;

import com.tracker.controller.ResourceNotFoundException;
import com.tracker.model.entity.*;
import com.tracker.repository.CategoryRepository;
import com.tracker.repository.RecurringPaymentRepository;
import com.tracker.repository.TransactionRecurringLinkRepository;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class RecurringPaymentService {

    private final RecurringPaymentRepository recurringPaymentRepository;
    private final TransactionRecurringLinkRepository linkRepository;
    private final CategoryRepository categoryRepository;
    private final UserContextService userContextService;
    private final RuleService ruleService;
    private final RecurringPaymentDetectionService detectionService;
    private final EntityManager entityManager;

    public RecurringPaymentService(RecurringPaymentRepository recurringPaymentRepository,
                                   TransactionRecurringLinkRepository linkRepository,
                                   CategoryRepository categoryRepository,
                                   UserContextService userContextService,
                                   RuleService ruleService,
                                   RecurringPaymentDetectionService detectionService,
                                   EntityManager entityManager) {
        this.recurringPaymentRepository = recurringPaymentRepository;
        this.linkRepository = linkRepository;
        this.categoryRepository = categoryRepository;
        this.userContextService = userContextService;
        this.ruleService = ruleService;
        this.detectionService = detectionService;
        this.entityManager = entityManager;
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

    @Transactional
    public RecurringPayment create(String name, PaymentType paymentType, String frequency,
                                   List<RuleCreateParams> ruleParams) {
        User currentUser = userContextService.getCurrentUser();

        RecurringPayment payment = new RecurringPayment();
        payment.setName(name);
        payment.setNormalizedName(RecurringPaymentDetectionService.normalize(name));
        payment.setPaymentType(paymentType);
        payment.setFrequency(frequency);
        payment.setAverageAmount(BigDecimal.ZERO);
        payment.setIsActive(true);
        payment.setUser(currentUser);
        RecurringPayment savedPayment = recurringPaymentRepository.save(payment);
        UUID paymentId = savedPayment.getId();

        for (RuleCreateParams rp : ruleParams) {
            ruleService.createRule(paymentId, rp.ruleType(), rp.targetField(),
                    rp.text(), rp.strict(), rp.threshold(), rp.amount(), rp.fluctuationRange());
        }

        detectionService.reEvaluateRecurringPayment(paymentId);

        // Clear persistence context so entity graph reload fetches the newly created rules
        entityManager.flush();
        entityManager.clear();

        return recurringPaymentRepository.findByUserId(currentUser.getId()).stream()
                .filter(p -> p.getId().equals(paymentId))
                .findFirst()
                .orElse(savedPayment);
    }

    @Transactional
    public void delete(UUID id) {
        UUID currentUserId = userContextService.getCurrentUserId();
        RecurringPayment payment = recurringPaymentRepository.findByIdAndUserId(id, currentUserId)
                .orElseThrow(() -> new ResourceNotFoundException("Recurring payment not found: " + id));
        linkRepository.deleteByRecurringPaymentId(payment.getId());
        recurringPaymentRepository.delete(payment);
    }

    @Transactional(readOnly = true)
    public List<Transaction> getTransactionsForPayment(UUID recurringPaymentId) {
        UUID currentUserId = userContextService.getCurrentUserId();
        return linkRepository.findByRecurringPaymentIdAndUserId(recurringPaymentId, currentUserId).stream()
                .map(TransactionRecurringLink::getTransaction)
                .toList();
    }
}
