package com.tracker.service;

import com.tracker.model.entity.RecurringPayment;
import com.tracker.model.entity.Rule;
import com.tracker.model.entity.Transaction;
import com.tracker.repository.RecurringPaymentRepository;
import com.tracker.repository.TransactionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class SimulationService {

    private static final Logger log = LoggerFactory.getLogger(SimulationService.class);

    private final TransactionRepository transactionRepository;
    private final RecurringPaymentRepository recurringPaymentRepository;
    private final RuleEvaluationService ruleEvaluationService;
    private final UserContextService userContextService;

    public SimulationService(TransactionRepository transactionRepository,
                             RecurringPaymentRepository recurringPaymentRepository,
                             RuleEvaluationService ruleEvaluationService,
                             UserContextService userContextService) {
        this.transactionRepository = transactionRepository;
        this.recurringPaymentRepository = recurringPaymentRepository;
        this.ruleEvaluationService = ruleEvaluationService;
        this.userContextService = userContextService;
    }

    @Transactional(readOnly = true)
    public SimulationResult simulate(List<Rule> transientRules) {
        UUID currentUserId = userContextService.getCurrentUserId();
        LocalDate cutoff = LocalDate.now().minusDays(RecurringPaymentDetectionService.LOOKBACK_DAYS);

        List<Transaction> unlinked = transactionRepository.findUnlinkedTransactionsAfterForUser(cutoff, currentUserId);
        log.debug("Simulation: {} unlinked transactions found for user {}", unlinked.size(), currentUserId);

        List<Transaction> matchingTransactions = ruleEvaluationService.findMatchingTransactions(transientRules, unlinked);
        log.debug("Simulation: {} transactions match the provided rules", matchingTransactions.size());

        // Overlap detection: check which existing active payments also match any of the same transactions
        List<RecurringPayment> activePayments = recurringPaymentRepository.findByUserIdAndIsActiveTrue(currentUserId);
        List<OverlappingPayment> overlapping = new ArrayList<>();

        for (RecurringPayment rt : activePayments) {
            List<Rule> rtRules = rt.getRules();
            if (rtRules.isEmpty()) continue;

            List<Transaction> rtMatches = ruleEvaluationService.findMatchingTransactions(rtRules, matchingTransactions);
            if (!rtMatches.isEmpty()) {
                overlapping.add(new OverlappingPayment(rt.getId(), rt.getName()));
                log.debug("Simulation: overlap detected with '{}' ({} shared transactions)", rt.getName(), rtMatches.size());
            }
        }

        return new SimulationResult(matchingTransactions, overlapping);
    }

    public record SimulationResult(
            List<Transaction> matchingTransactions,
            List<OverlappingPayment> overlappingPayments
    ) {}

    public record OverlappingPayment(UUID id, String name) {}
}
