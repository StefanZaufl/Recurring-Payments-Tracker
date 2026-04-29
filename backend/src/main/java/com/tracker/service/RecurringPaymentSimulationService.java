package com.tracker.service;

import com.tracker.model.entity.RecurringPayment;
import com.tracker.model.entity.Rule;
import com.tracker.model.entity.Transaction;
import com.tracker.model.entity.TransactionRecurringLink;
import com.tracker.repository.RecurringPaymentRepository;
import com.tracker.repository.TransactionRecurringLinkRepository;
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
public class RecurringPaymentSimulationService {

    private static final Logger log = LoggerFactory.getLogger(RecurringPaymentSimulationService.class);

    private final TransactionRepository transactionRepository;
    private final RecurringPaymentRepository recurringPaymentRepository;
    private final TransactionRecurringLinkRepository linkRepository;
    private final RuleEvaluationService ruleEvaluationService;
    private final UserContextService userContextService;
    private final AdditionalMatchingService additionalMatchingService;

    public RecurringPaymentSimulationService(TransactionRepository transactionRepository,
                                             RecurringPaymentRepository recurringPaymentRepository,
                                             TransactionRecurringLinkRepository linkRepository,
                                             RuleEvaluationService ruleEvaluationService,
                                             UserContextService userContextService,
                                             AdditionalMatchingService additionalMatchingService) {
        this.transactionRepository = transactionRepository;
        this.recurringPaymentRepository = recurringPaymentRepository;
        this.linkRepository = linkRepository;
        this.ruleEvaluationService = ruleEvaluationService;
        this.userContextService = userContextService;
        this.additionalMatchingService = additionalMatchingService;
    }

    @Transactional(readOnly = true)
    public SimulationResult simulate(List<Rule> transientRules) {
        UUID currentUserId = userContextService.getCurrentUserId();
        LocalDate cutoff = LocalDate.now().minusDays(RecurringPaymentDetectionService.LOOKBACK_DAYS);
        List<Transaction> unlinked = transactionRepository.findUnlinkedTransactionsAfterForUser(cutoff, currentUserId);
        log.debug("Recurring payment simulation: {} unlinked transactions found for user {}", unlinked.size(), currentUserId);

        if (transientRules.isEmpty()) {
            var additionalMatches = additionalMatchingService.matchGroups(unlinked, null);
            return new SimulationResult(List.of(), 0, additionalMatches.size(),
                    additionalMatchingService.toTransactionGroupMatches(additionalMatches, unlinked), List.of());
        }

        List<Transaction> rawMatches = ruleEvaluationService.findMatchingTransactions(transientRules, unlinked);
        var additionalMatches = additionalMatchingService.matchGroups(rawMatches, null);
        List<Transaction> matchingTransactions = additionalMatchingService.sortNewestFirst(rawMatches.stream()
                .filter(tx -> !additionalMatches.containsKey(tx.getId()))
                .toList());
        log.debug("Recurring payment simulation: {} transactions match after Additional exclusions", matchingTransactions.size());

        List<RecurringPayment> activePayments = recurringPaymentRepository.findByUserIdAndIsActiveTrue(currentUserId);
        List<OverlappingPayment> overlapping = detectOverlaps(transientRules, matchingTransactions, activePayments);

        return new SimulationResult(matchingTransactions, matchingTransactions.size(), additionalMatches.size(),
                additionalMatchingService.toTransactionGroupMatches(additionalMatches, rawMatches), overlapping);
    }

    private List<OverlappingPayment> detectOverlaps(List<Rule> simulatedRules,
                                                    List<Transaction> matchingUnlinked,
                                                    List<RecurringPayment> activePayments) {
        List<OverlappingPayment> overlapping = new ArrayList<>();

        for (RecurringPayment rt : activePayments) {
            List<Rule> rtRules = rt.getRules();

            if (!rtRules.isEmpty()) {
                List<Transaction> rtMatches = ruleEvaluationService.findMatchingTransactions(rtRules, matchingUnlinked);
                if (!rtMatches.isEmpty()) {
                    overlapping.add(new OverlappingPayment(rt.getId(), rt.getName()));
                    log.debug("Recurring payment simulation: overlap detected with '{}' ({} shared unlinked transactions)",
                            rt.getName(), rtMatches.size());
                    continue;
                }
            }

            List<Transaction> linkedTransactions = linkRepository.findWithTransactionByRecurringPaymentId(rt.getId())
                    .stream().map(TransactionRecurringLink::getTransaction).toList();
            if (!linkedTransactions.isEmpty()) {
                List<Transaction> simMatches = ruleEvaluationService.findMatchingTransactions(simulatedRules, linkedTransactions);
                if (!simMatches.isEmpty()) {
                    overlapping.add(new OverlappingPayment(rt.getId(), rt.getName()));
                    log.debug("Recurring payment simulation: overlap detected with '{}' ({} linked transactions match simulated rules)",
                            rt.getName(), simMatches.size());
                }
            }
        }

        return overlapping;
    }

    public record SimulationResult(
            List<Transaction> matchingTransactions,
            int totalMatchCount,
            int omittedAdditionalMatchCount,
            List<AdditionalMatchingService.TransactionGroupMatch> omittedAdditionalMatches,
            List<OverlappingPayment> overlappingPayments
    ) {
    }

    public record OverlappingPayment(UUID id, String name) {
    }
}
