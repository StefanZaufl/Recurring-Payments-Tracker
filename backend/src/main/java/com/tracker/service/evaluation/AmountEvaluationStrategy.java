package com.tracker.service.evaluation;

import com.tracker.model.entity.Rule;
import com.tracker.model.entity.RuleType;
import com.tracker.model.entity.Transaction;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

@Component
public class AmountEvaluationStrategy implements RuleEvaluationStrategy {

    @Override
    public RuleType getSupportedRuleType() {
        return RuleType.AMOUNT;
    }

    @Override
    public boolean evaluate(Rule rule, Transaction transaction) {
        BigDecimal txAmount = transaction.getAmount();
        if (txAmount == null || rule.getAmount() == null) {
            return false;
        }

        BigDecimal diff = txAmount.subtract(rule.getAmount()).abs();
        return diff.compareTo(rule.getFluctuationRange()) <= 0;
    }
}
