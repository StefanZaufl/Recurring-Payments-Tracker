package com.tracker.service.evaluation;

import com.tracker.model.entity.Rule;
import com.tracker.model.entity.RuleType;
import com.tracker.model.entity.Transaction;
import org.apache.commons.text.similarity.JaroWinklerSimilarity;
import org.springframework.stereotype.Component;

@Component
public class JaroWinklerEvaluationStrategy implements RuleEvaluationStrategy {

    private final JaroWinklerSimilarity jaroWinkler = new JaroWinklerSimilarity();

    @Override
    public RuleType getSupportedRuleType() {
        return RuleType.JARO_WINKLER;
    }

    @Override
    public boolean evaluate(Rule rule, Transaction transaction) {
        String candidate = TransactionFieldResolver.resolve(rule.getTargetField(), transaction);

        if (candidate == null) {
            return !Boolean.TRUE.equals(rule.getStrict());
        }

        double similarity = jaroWinkler.apply(
                rule.getText().toLowerCase(),
                candidate.toLowerCase()
        );
        return similarity >= rule.getThreshold();
    }
}
