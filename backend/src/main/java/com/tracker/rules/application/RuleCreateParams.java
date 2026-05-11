package com.tracker.rules.application;

import com.tracker.rules.domain.RuleType;
import com.tracker.rules.domain.TargetField;

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
