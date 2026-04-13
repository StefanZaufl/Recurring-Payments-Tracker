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
import java.util.regex.Pattern;
import java.util.regex.PatternSyntaxException;

@Service
public class RuleService {

    private final RuleRepository ruleRepository;
    private final RecurringPaymentRepository recurringPaymentRepository;
    private final UserContextService userContextService;

    public RuleService(RuleRepository ruleRepository, RecurringPaymentRepository recurringPaymentRepository,
                       UserContextService userContextService) {
        this.ruleRepository = ruleRepository;
        this.recurringPaymentRepository = recurringPaymentRepository;
        this.userContextService = userContextService;
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

        validateRule(ruleType, targetField, text, threshold, amount, fluctuationRange);

        Rule rule = new Rule();
        rule.setRecurringPayment(payment);
        rule.setRuleType(ruleType);
        rule.setTargetField(targetField);
        rule.setText(text);
        rule.setStrict(strict != null ? strict : true);
        rule.setThreshold(threshold);
        rule.setAmount(amount);
        rule.setFluctuationRange(fluctuationRange);
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
                    if (targetField != null) rule.setTargetField(targetField);
                    if (text != null) rule.setText(text);
                    if (strict != null) rule.setStrict(strict);
                    if (threshold != null) rule.setThreshold(threshold);
                    if (amount != null) rule.setAmount(amount);
                    if (fluctuationRange != null) rule.setFluctuationRange(fluctuationRange);

                    validateRule(rule.getRuleType(), rule.getTargetField(), rule.getText(),
                            rule.getThreshold(), rule.getAmount(), rule.getFluctuationRange());

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

    private void validateRule(RuleType ruleType, TargetField targetField, String text,
                              Double threshold, BigDecimal amount, BigDecimal fluctuationRange) {
        switch (ruleType) {
            case REGEX -> {
                if (targetField == null) throw new IllegalArgumentException("targetField is required for REGEX rules");
                if (text == null || text.isBlank()) throw new IllegalArgumentException("text is required for REGEX rules");
                try {
                    Pattern.compile(text);
                } catch (PatternSyntaxException e) {
                    throw new IllegalArgumentException("Invalid regex pattern: " + e.getMessage(), e);
                }
            }
            case JARO_WINKLER -> {
                if (targetField == null) throw new IllegalArgumentException("targetField is required for JARO_WINKLER rules");
                if (text == null || text.isBlank()) throw new IllegalArgumentException("text is required for JARO_WINKLER rules");
                if (threshold == null || threshold < 0 || threshold > 1) throw new IllegalArgumentException("threshold must be between 0 and 1 for JARO_WINKLER rules");
            }
            case AMOUNT -> {
                if (amount == null) throw new IllegalArgumentException("amount is required for AMOUNT rules");
                if (fluctuationRange == null || fluctuationRange.compareTo(BigDecimal.ZERO) < 0) throw new IllegalArgumentException("fluctuationRange must be non-negative for AMOUNT rules");
            }
        }
    }
}
