package com.tracker.service;

import com.tracker.model.entity.*;
import com.tracker.repository.RecurringPaymentRepository;
import com.tracker.repository.RuleRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import com.tracker.controller.ResourceNotFoundException;
import java.util.Optional;
import java.util.UUID;

@Service
public class RuleService {

    private final RuleRepository ruleRepository;
    private final RecurringPaymentRepository recurringPaymentRepository;
    private final UserContextService userContextService;
    private final RuleValidationService ruleValidationService;

    public RuleService(RuleRepository ruleRepository, RecurringPaymentRepository recurringPaymentRepository,
                       UserContextService userContextService, RuleValidationService ruleValidationService) {
        this.ruleRepository = ruleRepository;
        this.recurringPaymentRepository = recurringPaymentRepository;
        this.userContextService = userContextService;
        this.ruleValidationService = ruleValidationService;
    }

    @Transactional(readOnly = true)
    public List<Rule> getRulesForPayment(UUID recurringPaymentId) {
        requirePaymentExists(recurringPaymentId);
        return ruleRepository.findByRecurringPaymentIdAndUserId(recurringPaymentId, userContextService.getCurrentUserId());
    }

    @Transactional
    public Rule createRule(UUID recurringPaymentId, RuleType ruleType, TargetField targetField,
                           String text, Boolean strict, Double threshold,
                           BigDecimal amount, BigDecimal fluctuationRange) {
        RecurringPayment payment = requirePaymentExists(recurringPaymentId);

        RuleValidationService.NormalizedRule normalized = ruleValidationService.normalizeAndValidate(
                ruleType, targetField, text, strict, threshold, amount, fluctuationRange);
        List<RuleValidationService.NormalizedRule> existing = ruleRepository
                .findByRecurringPaymentIdAndUserId(recurringPaymentId, userContextService.getCurrentUserId())
                .stream()
                .map(ruleValidationService::normalizeExisting)
                .toList();
        ruleValidationService.validateNoDuplicates(
                java.util.stream.Stream.concat(existing.stream(), java.util.stream.Stream.of(normalized)).toList());

        Rule rule = new Rule();
        rule.setRecurringPayment(payment);
        ruleValidationService.apply(rule, normalized);
        rule.setUser(userContextService.getCurrentUser());
        return ruleRepository.save(rule);
    }

    @Transactional
    public Optional<Rule> updateRule(UUID recurringPaymentId, UUID ruleId, TargetField targetField,
                                     String text, Boolean strict, Double threshold,
                                     BigDecimal amount, BigDecimal fluctuationRange) {
        requirePaymentExists(recurringPaymentId);
        UUID currentUserId = userContextService.getCurrentUserId();
        return ruleRepository.findByIdAndRecurringPaymentIdAndUserId(ruleId, recurringPaymentId, currentUserId)
                .map(rule -> {
                    RuleValidationService.NormalizedRule normalized = ruleValidationService.normalizeAndValidate(
                            rule.getRuleType(),
                            targetField != null ? targetField : rule.getTargetField(),
                            text != null ? text : rule.getText(),
                            strict != null ? strict : rule.getStrict(),
                            threshold != null ? threshold : rule.getThreshold(),
                            amount != null ? amount : rule.getAmount(),
                            fluctuationRange != null ? fluctuationRange : rule.getFluctuationRange());

                    List<RuleValidationService.NormalizedRule> siblings = ruleRepository
                            .findByRecurringPaymentIdAndUserId(recurringPaymentId, currentUserId)
                            .stream()
                            .filter(existing -> !existing.getId().equals(ruleId))
                            .map(ruleValidationService::normalizeExisting)
                            .toList();
                    ruleValidationService.validateNoDuplicates(
                            java.util.stream.Stream.concat(siblings.stream(), java.util.stream.Stream.of(normalized)).toList());
                    ruleValidationService.apply(rule, normalized);

                    return ruleRepository.save(rule);
                });
    }

    @Transactional
    public boolean deleteRule(UUID recurringPaymentId, UUID ruleId) {
        RecurringPayment payment = requirePaymentExists(recurringPaymentId);
        UUID currentUserId = userContextService.getCurrentUserId();
        return ruleRepository.findByIdAndRecurringPaymentIdAndUserId(ruleId, recurringPaymentId, currentUserId)
                .map(rule -> {
                    payment.getRules().removeIf(existingRule -> existingRule.getId().equals(rule.getId()));
                    rule.setRecurringPayment(null);
                    ruleRepository.delete(rule);
                    ruleRepository.flush();
                    return true;
                })
                .orElse(false);
    }

    private RecurringPayment requirePaymentExists(UUID recurringPaymentId) {
        return recurringPaymentRepository.findByIdAndUserId(recurringPaymentId, userContextService.getCurrentUserId())
                .orElseThrow(() -> new ResourceNotFoundException("Recurring payment not found: " + recurringPaymentId));
    }

}
