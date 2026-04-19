package com.tracker.service;

import com.tracker.controller.ConflictException;
import com.tracker.controller.ResourceNotFoundException;
import com.tracker.model.entity.AdditionalRuleGroup;
import com.tracker.model.entity.Rule;
import com.tracker.model.entity.User;
import com.tracker.repository.AdditionalRuleGroupRepository;
import com.tracker.repository.RuleRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
public class AdditionalRuleGroupService {

    private static final int MAX_NAME_LENGTH = 120;

    private final AdditionalRuleGroupRepository groupRepository;
    private final RuleRepository ruleRepository;
    private final UserContextService userContextService;
    private final RuleValidationService ruleValidationService;
    private final AdditionalMatchingService matchingService;
    private final RecurringPaymentRecalculationService recalculationService;

    public AdditionalRuleGroupService(AdditionalRuleGroupRepository groupRepository,
                                      RuleRepository ruleRepository,
                                      UserContextService userContextService,
                                      RuleValidationService ruleValidationService,
                                      AdditionalMatchingService matchingService,
                                      RecurringPaymentRecalculationService recalculationService) {
        this.groupRepository = groupRepository;
        this.ruleRepository = ruleRepository;
        this.userContextService = userContextService;
        this.ruleValidationService = ruleValidationService;
        this.matchingService = matchingService;
        this.recalculationService = recalculationService;
    }

    @Transactional(readOnly = true)
    public List<GroupWithCount> getAll() {
        UUID userId = userContextService.getCurrentUserId();
        Map<UUID, Long> counts = matchingService.countMatchesByGroupInLookback();
        return groupRepository.findByUserIdOrderByNameAsc(userId).stream()
                .map(group -> new GroupWithCount(group, counts.getOrDefault(group.getId(), 0L)))
                .toList();
    }

    @Transactional(readOnly = true)
    public GroupWithCount getById(UUID id) {
        UUID userId = userContextService.getCurrentUserId();
        AdditionalRuleGroup group = groupRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Additional rule group not found: " + id));
        Map<UUID, Long> counts = matchingService.countMatchesByGroupInLookback();
        return new GroupWithCount(group, counts.getOrDefault(id, 0L));
    }

    @Transactional
    public MutationResult create(String name, List<RuleCreateParams> rules) {
        User user = userContextService.getCurrentUser();
        String trimmedName = normalizeDisplayName(name);
        String normalizedName = normalizeName(trimmedName);
        validateNameAvailable(user.getId(), normalizedName, null);
        List<RuleValidationService.NormalizedRule> normalizedRules = normalizeRules(rules);

        AdditionalRuleGroup group = new AdditionalRuleGroup();
        group.setName(trimmedName);
        group.setNormalizedName(normalizedName);
        group.setUser(user);
        group.setCreatedAt(LocalDateTime.now());
        group.setUpdatedAt(LocalDateTime.now());
        group = groupRepository.save(group);
        replaceRules(group, normalizedRules, user);

        RecurringPaymentRecalculationService.RecalculationResult recalculation =
                recalculationService.recalculateCurrentUserRecurringPayments();
        return new MutationResult(getById(group.getId()), recalculation);
    }

    @Transactional
    public MutationResult update(UUID id, String name, List<RuleCreateParams> rules) {
        UUID userId = userContextService.getCurrentUserId();
        AdditionalRuleGroup group = groupRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Additional rule group not found: " + id));

        String trimmedName = normalizeDisplayName(name);
        String normalizedName = normalizeName(trimmedName);
        validateNameAvailable(userId, normalizedName, id);
        List<RuleValidationService.NormalizedRule> normalizedRules = normalizeRules(rules);

        boolean rulesChanged = !normalizedRules.equals(group.getRules().stream()
                .map(ruleValidationService::normalizeExisting)
                .toList());

        group.setName(trimmedName);
        group.setNormalizedName(normalizedName);
        group.setUpdatedAt(LocalDateTime.now());
        group = groupRepository.save(group);

        RecurringPaymentRecalculationService.RecalculationResult recalculation = null;
        if (rulesChanged) {
            replaceRules(group, normalizedRules, userContextService.getCurrentUser());
            recalculation = recalculationService.recalculateCurrentUserRecurringPayments();
        }
        return new MutationResult(getById(group.getId()), recalculation);
    }

    @Transactional
    public RecurringPaymentRecalculationService.RecalculationResult delete(UUID id) {
        UUID userId = userContextService.getCurrentUserId();
        AdditionalRuleGroup group = groupRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Additional rule group not found: " + id));
        groupRepository.delete(group);
        groupRepository.flush();
        return recalculationService.recalculateCurrentUserRecurringPayments();
    }

    private void replaceRules(AdditionalRuleGroup group,
                              List<RuleValidationService.NormalizedRule> normalizedRules,
                              User user) {
        group.getRules().clear();
        ruleRepository.deleteByAdditionalRuleGroupId(group.getId());
        ruleRepository.flush();
        for (RuleValidationService.NormalizedRule normalizedRule : normalizedRules) {
            Rule rule = new Rule();
            rule.setAdditionalRuleGroup(group);
            rule.setUser(user);
            ruleValidationService.apply(rule, normalizedRule);
            group.getRules().add(rule);
        }
        groupRepository.save(group);
    }

    private List<RuleValidationService.NormalizedRule> normalizeRules(List<RuleCreateParams> rules) {
        if (rules == null || rules.isEmpty()) {
            throw new IllegalArgumentException("At least one rule is required");
        }
        List<RuleValidationService.NormalizedRule> normalized = rules.stream()
                .map(rule -> ruleValidationService.normalizeAndValidate(rule.ruleType(), rule.targetField(), rule.text(),
                        rule.strict(), rule.threshold(), rule.amount(), rule.fluctuationRange()))
                .toList();
        ruleValidationService.validateNoDuplicates(normalized);
        return normalized;
    }

    private void validateNameAvailable(UUID userId, String normalizedName, UUID currentId) {
        boolean exists = currentId == null
                ? groupRepository.existsByUserIdAndNormalizedName(userId, normalizedName)
                : groupRepository.existsByUserIdAndNormalizedNameAndIdNot(userId, normalizedName, currentId);
        if (exists) {
            throw new ConflictException("An Additional rule group with this name already exists.");
        }
    }

    private String normalizeDisplayName(String name) {
        if (name == null || name.trim().isBlank()) {
            throw new IllegalArgumentException("name is required");
        }
        String trimmed = name.trim();
        if (trimmed.length() > MAX_NAME_LENGTH) {
            throw new IllegalArgumentException("name must be at most " + MAX_NAME_LENGTH + " characters");
        }
        return trimmed;
    }

    public static String normalizeName(String name) {
        return name.trim().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
    }

    public record GroupWithCount(AdditionalRuleGroup group, long excludedTransactionCount) {
    }

    public record MutationResult(GroupWithCount groupWithCount,
                                 RecurringPaymentRecalculationService.RecalculationResult recalculationResult) {
    }
}
