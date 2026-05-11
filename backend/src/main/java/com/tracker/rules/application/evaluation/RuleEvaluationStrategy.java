package com.tracker.rules.application.evaluation;

import com.tracker.rules.domain.Rule;
import com.tracker.rules.domain.RuleType;
import com.tracker.transactions.domain.Transaction;

public interface RuleEvaluationStrategy {

    RuleType getSupportedRuleType();

    boolean evaluate(Rule rule, Transaction transaction);
}
