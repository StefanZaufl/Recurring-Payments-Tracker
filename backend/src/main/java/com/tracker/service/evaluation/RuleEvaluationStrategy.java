package com.tracker.service.evaluation;

import com.tracker.model.entity.Rule;
import com.tracker.model.entity.RuleType;
import com.tracker.model.entity.Transaction;

public interface RuleEvaluationStrategy {

    RuleType getSupportedRuleType();

    boolean evaluate(Rule rule, Transaction transaction);
}
