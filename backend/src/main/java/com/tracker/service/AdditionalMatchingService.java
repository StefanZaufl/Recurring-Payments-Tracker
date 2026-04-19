package com.tracker.service;

import com.tracker.model.entity.AdditionalRuleGroup;
import com.tracker.model.entity.Transaction;
import com.tracker.repository.AdditionalRuleGroupRepository;
import com.tracker.repository.TransactionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class AdditionalMatchingService {

    private final AdditionalRuleGroupRepository groupRepository;
    private final TransactionRepository transactionRepository;
    private final RuleEvaluationService ruleEvaluationService;
    private final UserContextService userContextService;

    public AdditionalMatchingService(AdditionalRuleGroupRepository groupRepository,
                                     TransactionRepository transactionRepository,
                                     RuleEvaluationService ruleEvaluationService,
                                     UserContextService userContextService) {
        this.groupRepository = groupRepository;
        this.transactionRepository = transactionRepository;
        this.ruleEvaluationService = ruleEvaluationService;
        this.userContextService = userContextService;
    }

    @Transactional(readOnly = true)
    public List<Transaction> filterExcluded(List<Transaction> transactions) {
        if (transactions.isEmpty()) {
            return transactions;
        }
        Set<UUID> excludedIds = matchGroups(transactions, null).keySet();
        return transactions.stream()
                .filter(tx -> !excludedIds.contains(tx.getId()))
                .toList();
    }

    @Transactional(readOnly = true)
    public Map<UUID, List<AdditionalGroupReference>> matchGroups(List<Transaction> transactions, UUID excludeGroupId) {
        if (transactions.isEmpty()) {
            return Map.of();
        }
        UUID userId = userContextService.getCurrentUserId();
        List<AdditionalRuleGroup> groups = groupRepository.findByUserIdOrderByNameAsc(userId).stream()
                .filter(group -> excludeGroupId == null || !group.getId().equals(excludeGroupId))
                .toList();

        Map<UUID, List<AdditionalGroupReference>> matches = new HashMap<>();
        for (AdditionalRuleGroup group : groups) {
            if (group.getRules() == null || group.getRules().isEmpty()) {
                continue;
            }
            List<Transaction> groupMatches = ruleEvaluationService.findMatchingTransactions(group.getRules(), transactions);
            AdditionalGroupReference reference = new AdditionalGroupReference(group.getId(), group.getName());
            for (Transaction tx : groupMatches) {
                matches.computeIfAbsent(tx.getId(), ignored -> new ArrayList<>()).add(reference);
            }
        }

        matches.values().forEach(list -> list.sort(Comparator.comparing(AdditionalGroupReference::name)));
        return matches.entrySet().stream()
                .sorted(Comparator.comparing(entry -> transactions.stream()
                        .filter(tx -> tx.getId().equals(entry.getKey()))
                        .findFirst()
                        .map(Transaction::getBookingDate)
                        .orElse(LocalDate.MIN), Comparator.reverseOrder()))
                .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue, (left, right) -> left, LinkedHashMap::new));
    }

    @Transactional(readOnly = true)
    public Map<UUID, Long> countMatchesByGroupInLookback() {
        UUID userId = userContextService.getCurrentUserId();
        LocalDate cutoff = LocalDate.now().minusDays(RecurringPaymentDetectionService.LOOKBACK_DAYS);
        List<Transaction> candidates = transactionRepository.findByUserIdAndBookingDateGreaterThanEqualAndIsInterAccountFalse(userId, cutoff);
        return countMatchesByGroup(candidates);
    }

    @Transactional(readOnly = true)
    public Map<UUID, Long> countMatchesByGroup(List<Transaction> candidates) {
        UUID userId = userContextService.getCurrentUserId();
        return groupRepository.findByUserIdOrderByNameAsc(userId).stream()
                .collect(Collectors.toMap(
                        AdditionalRuleGroup::getId,
                        group -> group.getRules() == null || group.getRules().isEmpty()
                                ? 0L
                                : (long) ruleEvaluationService.findMatchingTransactions(group.getRules(), candidates).size(),
                        (left, right) -> left,
                        LinkedHashMap::new));
    }

    public List<Transaction> sortNewestFirst(Collection<Transaction> transactions) {
        return transactions.stream()
                .sorted(Comparator.comparing(Transaction::getBookingDate, Comparator.nullsLast(Comparator.naturalOrder()))
                        .reversed()
                        .thenComparing(Transaction::getId))
                .toList();
    }

    public Map<UUID, Transaction> byId(List<Transaction> transactions) {
        return transactions.stream().collect(Collectors.toMap(Transaction::getId, Function.identity()));
    }

    public record AdditionalGroupReference(UUID id, String name) {
    }
}
