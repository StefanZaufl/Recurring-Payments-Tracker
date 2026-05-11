package com.tracker.additionalrules.application;

import com.tracker.recurringpayments.application.RecurringPaymentDetectionService;
import com.tracker.rules.application.RuleEvaluationService;
import com.tracker.users.application.UserContextService;

import com.tracker.rules.domain.Rule;
import com.tracker.transactions.domain.Transaction;
import com.tracker.transactions.persistence.TransactionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Service
public class AdditionalRuleGroupSimulationService {

    private final TransactionRepository transactionRepository;
    private final RuleEvaluationService ruleEvaluationService;
    private final UserContextService userContextService;
    private final AdditionalMatchingService additionalMatchingService;

    public AdditionalRuleGroupSimulationService(TransactionRepository transactionRepository,
                                                RuleEvaluationService ruleEvaluationService,
                                                UserContextService userContextService,
                                                AdditionalMatchingService additionalMatchingService) {
        this.transactionRepository = transactionRepository;
        this.ruleEvaluationService = ruleEvaluationService;
        this.userContextService = userContextService;
        this.additionalMatchingService = additionalMatchingService;
    }

    @Transactional(readOnly = true)
    public SimulationResult simulate(List<Rule> transientRules, UUID currentAdditionalGroupId) {
        UUID currentUserId = userContextService.getCurrentUserId();
        LocalDate cutoff = LocalDate.now().minusDays(RecurringPaymentDetectionService.LOOKBACK_DAYS);
        List<Transaction> candidates = transactionRepository
                .findByUserIdAndBookingDateGreaterThanEqualAndIsInterAccountFalse(currentUserId, cutoff);
        List<Transaction> matchingTransactions = additionalMatchingService.sortNewestFirst(
                ruleEvaluationService.findMatchingTransactions(transientRules, candidates));
        var otherMatches = additionalMatchingService.matchGroups(candidates, currentAdditionalGroupId);
        int uniqueExclusionCount = (int) matchingTransactions.stream()
                .filter(tx -> !otherMatches.containsKey(tx.getId()))
                .count();

        return new SimulationResult(matchingTransactions, matchingTransactions.size(), uniqueExclusionCount,
                additionalMatchingService.toTransactionGroupMatches(otherMatches, candidates));
    }

    public record SimulationResult(
            List<Transaction> matchingTransactions,
            int totalMatchCount,
            int uniqueExclusionCount,
            List<AdditionalMatchingService.TransactionGroupMatch> otherAdditionalGroupMatches
    ) {
    }
}
