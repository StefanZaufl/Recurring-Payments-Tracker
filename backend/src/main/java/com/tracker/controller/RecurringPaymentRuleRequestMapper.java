package com.tracker.controller;

import com.tracker.api.model.CreateRuleRequest;
import com.tracker.model.entity.Rule;
import com.tracker.model.entity.RuleType;
import com.tracker.model.entity.TargetField;
import com.tracker.service.RuleCreateParams;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.List;

@Component
public class RecurringPaymentRuleRequestMapper {

    public List<RuleCreateParams> toCreateParams(List<CreateRuleRequest> requests) {
        return requests.stream()
                .map(this::normalize)
                .map(NormalizedRuleRequest::toCreateParams)
                .toList();
    }

    public List<Rule> toSimulationRules(List<CreateRuleRequest> requests) {
        return requests.stream()
                .map(this::normalize)
                .map(NormalizedRuleRequest::toSimulationRule)
                .toList();
    }

    private NormalizedRuleRequest normalize(CreateRuleRequest request) {
        return new NormalizedRuleRequest(
                RuleType.valueOf(request.getRuleType().getValue()),
                request.getTargetField() != null ? TargetField.valueOf(request.getTargetField().getValue()) : null,
                request.getText(),
                request.getStrict() != null ? request.getStrict() : true,
                request.getThreshold(),
                request.getAmount() != null ? BigDecimal.valueOf(request.getAmount()) : null,
                request.getFluctuationRange() != null ? BigDecimal.valueOf(request.getFluctuationRange()) : null
        );
    }

    private record NormalizedRuleRequest(
            RuleType ruleType,
            TargetField targetField,
            String text,
            Boolean strict,
            Double threshold,
            BigDecimal amount,
            BigDecimal fluctuationRange
    ) {
        private RuleCreateParams toCreateParams() {
            return new RuleCreateParams(
                    ruleType,
                    targetField,
                    text,
                    strict,
                    threshold,
                    amount,
                    fluctuationRange
            );
        }

        private Rule toSimulationRule() {
            Rule rule = new Rule();
            rule.setRuleType(ruleType);
            rule.setTargetField(targetField);
            rule.setText(text);
            rule.setStrict(strict);
            rule.setThreshold(threshold);
            rule.setAmount(amount);
            rule.setFluctuationRange(fluctuationRange);
            return rule;
        }
    }
}
