package com.tracker.controller;

import com.tracker.api.model.AdditionalRuleGroupDto;
import com.tracker.api.model.AdditionalRuleGroupMutationResponse;
import com.tracker.api.model.RecalculationSummaryResponse;
import com.tracker.model.entity.AdditionalRuleGroup;
import com.tracker.service.AdditionalRuleGroupService;
import com.tracker.service.RecurringPaymentRecalculationService;
import org.springframework.stereotype.Component;

import java.time.ZoneOffset;
import java.util.Comparator;
import java.util.List;

@Component
public class AdditionalRuleGroupMapper {

    private final RuleMapper ruleMapper;

    public AdditionalRuleGroupMapper(RuleMapper ruleMapper) {
        this.ruleMapper = ruleMapper;
    }

    public AdditionalRuleGroupDto toDto(AdditionalRuleGroupService.GroupWithCount groupWithCount) {
        AdditionalRuleGroup group = groupWithCount.group();
        AdditionalRuleGroupDto dto = new AdditionalRuleGroupDto();
        dto.setId(group.getId());
        dto.setName(group.getName());
        dto.setNormalizedName(group.getNormalizedName());
        dto.setExcludedTransactionCount((int) groupWithCount.excludedTransactionCount());
        dto.setRules(ruleMapper.toDtoList(group.getRules().stream()
                .sorted(Comparator.comparing(com.tracker.model.entity.Rule::getCreatedAt,
                        Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparing(com.tracker.model.entity.Rule::getId, Comparator.nullsLast(Comparator.naturalOrder())))
                .toList()));
        if (group.getCreatedAt() != null) {
            dto.setCreatedAt(group.getCreatedAt().atOffset(ZoneOffset.UTC));
        }
        if (group.getUpdatedAt() != null) {
            dto.setUpdatedAt(group.getUpdatedAt().atOffset(ZoneOffset.UTC));
        }
        return dto;
    }

    public List<AdditionalRuleGroupDto> toDtoList(List<AdditionalRuleGroupService.GroupWithCount> groups) {
        return groups.stream().map(this::toDto).toList();
    }

    public AdditionalRuleGroupMutationResponse toMutationResponse(AdditionalRuleGroupService.MutationResult result) {
        AdditionalRuleGroupMutationResponse response = new AdditionalRuleGroupMutationResponse();
        response.setGroup(toDto(result.groupWithCount()));
        if (result.recalculationResult() != null) {
            response.setRecalculationSummary(toRecalculationSummary(result.recalculationResult()));
        }
        return response;
    }

    public RecalculationSummaryResponse toRecalculationSummary(RecurringPaymentRecalculationService.RecalculationResult result) {
        RecalculationSummaryResponse response = new RecalculationSummaryResponse();
        response.setTransactionsMarkedInterAccount(result.transactionsMarkedInterAccount());
        response.setTransactionLinksRemoved(result.transactionLinksRemoved());
        response.setRecurringPaymentsDeleted(result.recurringPaymentsDeleted());
        response.setRecurringPaymentsDetected(result.recurringPaymentsDetected());
        return response;
    }
}
