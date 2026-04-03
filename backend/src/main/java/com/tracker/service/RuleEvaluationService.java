package com.tracker.service;

import com.tracker.model.entity.Rule;
import com.tracker.model.entity.RuleType;
import com.tracker.model.entity.Transaction;
import com.tracker.service.evaluation.RuleEvaluationStrategy;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class RuleEvaluationService {

    private final Map<RuleType, RuleEvaluationStrategy> strategyMap;

    public RuleEvaluationService(List<RuleEvaluationStrategy> strategies) {
        this.strategyMap = strategies.stream()
                .collect(Collectors.toMap(RuleEvaluationStrategy::getSupportedRuleType, Function.identity()));
    }

    /**
     * Returns true if the transaction matches ALL rules (AND logic).
     * Empty rules means no match.
     */
    public boolean matches(List<Rule> rules, Transaction transaction) {
        if (rules.isEmpty()) {
            return false;
        }
        return rules.stream().allMatch(rule -> {
            RuleEvaluationStrategy strategy = strategyMap.get(rule.getRuleType());
            if (strategy == null) {
                return false;
            }
            return strategy.evaluate(rule, transaction);
        });
    }

    /**
     * From a list of candidates, return those matching all rules.
     */
    public List<Transaction> findMatchingTransactions(List<Rule> rules, List<Transaction> candidates) {
        return candidates.stream()
                .filter(tx -> matches(rules, tx))
                .toList();
    }
}
