package com.tracker.service;

import com.tracker.model.entity.Rule;
import com.tracker.model.entity.RuleType;
import com.tracker.model.entity.Transaction;
import com.tracker.service.evaluation.RuleEvaluationStrategy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class RuleEvaluationService {

    private static final Logger log = LoggerFactory.getLogger(RuleEvaluationService.class);

    private final Map<RuleType, RuleEvaluationStrategy> strategyMap;

    public RuleEvaluationService(List<RuleEvaluationStrategy> strategies) {
        this.strategyMap = strategies.stream()
                .collect(Collectors.toMap(RuleEvaluationStrategy::getSupportedRuleType, Function.identity()));
        log.info("RuleEvaluationService initialized with {} strategies: {}",
                strategyMap.size(), strategyMap.keySet());
    }

    /**
     * Returns true if the transaction matches ALL rules (AND logic).
     * Empty rules means no match.
     */
    public boolean matches(List<Rule> rules, Transaction transaction) {
        if (rules.isEmpty()) {
            log.debug("No rules to evaluate for transaction {} ({})",
                    transaction.getId(), transaction.getPartnerName());
            return false;
        }
        boolean result = rules.stream().allMatch(rule -> {
            RuleEvaluationStrategy strategy = strategyMap.get(rule.getRuleType());
            if (strategy == null) {
                log.warn("No strategy found for rule type {} — available strategies: {}",
                        rule.getRuleType(), strategyMap.keySet());
                return false;
            }
            boolean match = strategy.evaluate(rule, transaction);
            log.debug("Rule {} [{}] vs tx {} ({}): {}",
                    rule.getId(), rule.getRuleType(), transaction.getId(),
                    transaction.getPartnerName(), match ? "MATCH" : "NO MATCH");
            return match;
        });
        return result;
    }

    /**
     * From a list of candidates, return those matching all rules.
     */
    public List<Transaction> findMatchingTransactions(List<Rule> rules, List<Transaction> candidates) {
        log.debug("Evaluating {} rules against {} candidates", rules.size(), candidates.size());
        List<Transaction> matched = candidates.stream()
                .filter(tx -> matches(rules, tx))
                .toList();
        log.debug("Found {} matching transactions out of {} candidates", matched.size(), candidates.size());
        return matched;
    }
}
