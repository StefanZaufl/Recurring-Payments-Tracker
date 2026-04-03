package com.tracker.service.evaluation;

import com.tracker.model.entity.Rule;
import com.tracker.model.entity.RuleType;
import com.tracker.model.entity.Transaction;
import org.springframework.stereotype.Component;

import java.util.regex.Pattern;
import java.util.regex.PatternSyntaxException;

@Component
public class RegexEvaluationStrategy implements RuleEvaluationStrategy {

    @Override
    public RuleType getSupportedRuleType() {
        return RuleType.REGEX;
    }

    @Override
    public boolean evaluate(Rule rule, Transaction transaction) {
        String candidate = TransactionFieldResolver.resolve(rule.getTargetField(), transaction);

        if (candidate == null) {
            return !Boolean.TRUE.equals(rule.getStrict());
        }

        try {
            return Pattern.compile(rule.getText(), Pattern.CASE_INSENSITIVE).matcher(candidate).find();
        } catch (PatternSyntaxException e) {
            return false;
        }
    }
}
