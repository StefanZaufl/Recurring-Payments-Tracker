package com.tracker.service;

import com.tracker.model.entity.Rule;
import com.tracker.model.entity.RuleType;
import com.tracker.model.entity.TargetField;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.regex.PatternSyntaxException;

@Service
public class RuleValidationService {

    public NormalizedRule normalizeAndValidate(RuleType ruleType, TargetField targetField, String text,
                                               Boolean strict, Double threshold,
                                               BigDecimal amount, BigDecimal fluctuationRange) {
        if (ruleType == null) {
            throw new IllegalArgumentException("ruleType is required");
        }
        return switch (ruleType) {
            case REGEX -> normalizeRegex(targetField, text, strict);
            case JARO_WINKLER -> normalizeJaroWinkler(targetField, text, strict, threshold);
            case AMOUNT -> normalizeAmount(amount, fluctuationRange);
        };
    }

    public NormalizedRule normalizeExisting(Rule rule) {
        return normalizeAndValidate(rule.getRuleType(), rule.getTargetField(), rule.getText(), rule.getStrict(),
                rule.getThreshold(), rule.getAmount(), rule.getFluctuationRange());
    }

    public void apply(Rule rule, NormalizedRule normalized) {
        rule.setRuleType(normalized.ruleType());
        rule.setTargetField(normalized.targetField());
        rule.setText(normalized.text());
        rule.setStrict(normalized.strict());
        rule.setThreshold(normalized.threshold());
        rule.setAmount(normalized.amount());
        rule.setFluctuationRange(normalized.fluctuationRange());
    }

    public void validateNoDuplicates(List<NormalizedRule> rules) {
        Set<RuleKey> seen = new HashSet<>();
        for (NormalizedRule rule : rules) {
            if (!seen.add(RuleKey.from(rule))) {
                throw new IllegalArgumentException("Duplicate rules are not allowed");
            }
        }
    }

    private NormalizedRule normalizeRegex(TargetField targetField, String text, Boolean strict) {
        if (targetField == null) throw new IllegalArgumentException("targetField is required for REGEX rules");
        String trimmedText = trimRequiredText(text, "REGEX");
        try {
            Pattern.compile(trimmedText);
        } catch (PatternSyntaxException e) {
            throw new IllegalArgumentException("Invalid regex pattern: " + e.getMessage(), e);
        }
        return new NormalizedRule(RuleType.REGEX, targetField, trimmedText, strict != null ? strict : true,
                null, null, null);
    }

    private NormalizedRule normalizeJaroWinkler(TargetField targetField, String text, Boolean strict, Double threshold) {
        if (targetField == null) throw new IllegalArgumentException("targetField is required for JARO_WINKLER rules");
        String trimmedText = trimRequiredText(text, "JARO_WINKLER");
        if (threshold == null || threshold < 0 || threshold > 1) {
            throw new IllegalArgumentException("threshold must be between 0 and 1 for JARO_WINKLER rules");
        }
        return new NormalizedRule(RuleType.JARO_WINKLER, targetField, trimmedText, strict != null ? strict : true,
                threshold, null, null);
    }

    private NormalizedRule normalizeAmount(BigDecimal amount, BigDecimal fluctuationRange) {
        if (amount == null) throw new IllegalArgumentException("amount is required for AMOUNT rules");
        if (fluctuationRange == null || fluctuationRange.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("fluctuationRange must be non-negative for AMOUNT rules");
        }
        return new NormalizedRule(RuleType.AMOUNT, null, null, null, null, amount, fluctuationRange);
    }

    private String trimRequiredText(String text, String ruleType) {
        if (text == null || text.trim().isBlank()) {
            throw new IllegalArgumentException("text is required for " + ruleType + " rules");
        }
        return text.trim();
    }

    public record NormalizedRule(RuleType ruleType,
                                 TargetField targetField,
                                 String text,
                                 Boolean strict,
                                 Double threshold,
                                 BigDecimal amount,
                                 BigDecimal fluctuationRange) {
    }

    private record RuleKey(RuleType ruleType,
                           TargetField targetField,
                           String text,
                           Boolean strict,
                           Double threshold,
                           BigDecimal amount,
                           BigDecimal fluctuationRange) {

        static RuleKey from(NormalizedRule rule) {
            return new RuleKey(
                    rule.ruleType(),
                    rule.targetField(),
                    rule.text() == null ? null : rule.text().toLowerCase(java.util.Locale.ROOT),
                    rule.strict(),
                    rule.threshold(),
                    rule.amount() == null ? null : rule.amount().stripTrailingZeros(),
                    rule.fluctuationRange() == null ? null : rule.fluctuationRange().stripTrailingZeros()
            );
        }
    }
}
