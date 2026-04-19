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
public class SimulationService {

    private static final Logger log = LoggerFactory.getLogger(SimulationService.class);

    private final TransactionRepository transactionRepository;
    private final RecurringPaymentRepository recurringPaymentRepository;
    private final TransactionRecurringLinkRepository linkRepository;
    private final RuleEvaluationService ruleEvaluationService;
    private final UserContextService userContextService;
    private final AdditionalMatchingService additionalMatchingService;

    public SimulationService(TransactionRepository transactionRepository,
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
        return simulate(transientRules, DraftType.RECURRING_PAYMENT, null);
    }

    @Transactional(readOnly = true)
    public SimulationResult simulate(List<Rule> transientRules, DraftType draftType, UUID currentAdditionalGroupId) {
        UUID currentUserId = userContextService.getCurrentUserId();
        LocalDate cutoff = LocalDate.now().minusDays(RecurringPaymentDetectionService.LOOKBACK_DAYS);

        if (draftType == DraftType.ADDITIONAL_GROUP) {
            List<Transaction> candidates = transactionRepository
                    .findByUserIdAndBookingDateGreaterThanEqualAndIsInterAccountFalse(currentUserId, cutoff);
            List<Transaction> matchingTransactions = additionalMatchingService.sortNewestFirst(
                    ruleEvaluationService.findMatchingTransactions(transientRules, candidates));
            var otherMatches = additionalMatchingService.matchGroups(candidates, currentAdditionalGroupId);
            int uniqueExclusionCount = (int) matchingTransactions.stream()
                    .filter(tx -> !otherMatches.containsKey(tx.getId()))
                    .count();
            return new SimulationResult(matchingTransactions, matchingTransactions.size(), uniqueExclusionCount,
                    0, List.of(), toAdditionalMatches(otherMatches, candidates), List.of());
        }

        List<Transaction> unlinked = transactionRepository.findUnlinkedTransactionsAfterForUser(cutoff, currentUserId);
        log.debug("Simulation: {} unlinked transactions found for user {}", unlinked.size(), currentUserId);

        List<Transaction> rawMatches = ruleEvaluationService.findMatchingTransactions(transientRules, unlinked);
        var additionalMatches = additionalMatchingService.matchGroups(rawMatches, null);
        List<Transaction> matchingTransactions = additionalMatchingService.sortNewestFirst(rawMatches.stream()
                .filter(tx -> !additionalMatches.containsKey(tx.getId()))
                .toList());
        log.debug("Simulation: {} transactions match the provided rules after Additional exclusions", matchingTransactions.size());

        List<RecurringPayment> activePayments = recurringPaymentRepository.findByUserIdAndIsActiveTrue(currentUserId);
        List<OverlappingPayment> overlapping = detectOverlaps(transientRules, matchingTransactions, activePayments);

        List<AdditionalTransactionMatch> omitted = toAdditionalMatches(additionalMatches, rawMatches).stream()
                .limit(10)
                .toList();
        return new SimulationResult(matchingTransactions, matchingTransactions.size(), 0,
                additionalMatches.size(), omitted, List.of(), overlapping);
    }

    private List<OverlappingPayment> detectOverlaps(List<Rule> simulatedRules,
                                                     List<Transaction> matchingUnlinked,
                                                     List<RecurringPayment> activePayments) {
        List<OverlappingPayment> overlapping = new ArrayList<>();

        for (RecurringPayment rt : activePayments) {
            List<Rule> rtRules = rt.getRules();

            // Check 1: do the existing payment's rules match any of the simulated matching (unlinked) transactions?
            if (!rtRules.isEmpty()) {
                List<Transaction> rtMatches = ruleEvaluationService.findMatchingTransactions(rtRules, matchingUnlinked);
                if (!rtMatches.isEmpty()) {
                    overlapping.add(new OverlappingPayment(rt.getId(), rt.getName()));
                    log.debug("Simulation: overlap detected with '{}' ({} shared unlinked transactions)", rt.getName(), rtMatches.size());
                    continue;
                }
            }

            // Check 2: do the simulated rules match any of this payment's already-linked transactions?
            List<Transaction> linkedTransactions = linkRepository.findWithTransactionByRecurringPaymentId(rt.getId())
                    .stream().map(TransactionRecurringLink::getTransaction).toList();
            if (!linkedTransactions.isEmpty()) {
                List<Transaction> simMatches = ruleEvaluationService.findMatchingTransactions(simulatedRules, linkedTransactions);
                if (!simMatches.isEmpty()) {
                    overlapping.add(new OverlappingPayment(rt.getId(), rt.getName()));
                    log.debug("Simulation: overlap detected with '{}' ({} linked transactions match simulated rules)", rt.getName(), simMatches.size());
                }
            }
        }

        return overlapping;
    }

    public record SimulationResult(
            List<Transaction> matchingTransactions,
            int totalMatchCount,
            int uniqueExclusionCount,
            int omittedAdditionalMatchCount,
            List<AdditionalTransactionMatch> omittedAdditionalMatches,
            List<AdditionalTransactionMatch> otherAdditionalGroupMatches,
            List<OverlappingPayment> overlappingPayments
    ) {}

    public record OverlappingPayment(UUID id, String name) {}

    public record AdditionalTransactionMatch(UUID transactionId,
                                             Transaction transaction,
                                             List<AdditionalMatchingService.AdditionalGroupReference> groups) {}

    public enum DraftType {
        RECURRING_PAYMENT,
        ADDITIONAL_GROUP
    }

    private List<AdditionalTransactionMatch> toAdditionalMatches(
            java.util.Map<UUID, List<AdditionalMatchingService.AdditionalGroupReference>> matches,
            List<Transaction> transactions) {
        java.util.Map<UUID, Transaction> byId = additionalMatchingService.byId(transactions);
        return matches.entrySet().stream()
                .sorted(java.util.Comparator.comparing(entry -> {
                    Transaction tx = byId.get(entry.getKey());
                    return tx == null ? LocalDate.MIN : tx.getBookingDate();
                }, java.util.Comparator.reverseOrder()))
                .map(entry -> new AdditionalTransactionMatch(entry.getKey(), byId.get(entry.getKey()), entry.getValue()))
                .toList();
    }
}
