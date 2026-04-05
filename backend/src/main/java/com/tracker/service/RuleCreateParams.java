package com.tracker.service;

import com.tracker.model.entity.RuleType;
import com.tracker.model.entity.TargetField;

import java.math.BigDecimal;

public record RuleCreateParams(
        RuleType ruleType,
        TargetField targetField,
        String text,
        Boolean strict,
        Double threshold,
        BigDecimal amount,
        BigDecimal fluctuationRange
) {
}
