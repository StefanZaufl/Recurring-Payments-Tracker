package com.tracker.controller;

import com.tracker.api.AdditionalRuleGroupsApi;
import com.tracker.api.model.AdditionalRuleGroupDto;
import com.tracker.api.model.AdditionalRuleGroupMutationResponse;
import com.tracker.api.model.AdditionalRuleGroupRequest;
import com.tracker.api.model.RecalculationSummaryResponse;
import com.tracker.service.AdditionalRuleGroupService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.util.List;
import java.util.UUID;

@RestController
public class AdditionalRuleGroupController implements AdditionalRuleGroupsApi {

    private final AdditionalRuleGroupService service;
    private final AdditionalRuleGroupMapper mapper;
    private final RecurringPaymentRuleRequestMapper ruleRequestMapper;

    public AdditionalRuleGroupController(AdditionalRuleGroupService service,
                                         AdditionalRuleGroupMapper mapper,
                                         RecurringPaymentRuleRequestMapper ruleRequestMapper) {
        this.service = service;
        this.mapper = mapper;
        this.ruleRequestMapper = ruleRequestMapper;
    }

    @Override
    public ResponseEntity<List<AdditionalRuleGroupDto>> getAdditionalRuleGroups() {
        return ResponseEntity.ok(mapper.toDtoList(service.getAll()));
    }

    @Override
    public ResponseEntity<AdditionalRuleGroupDto> getAdditionalRuleGroup(UUID id) {
        return ResponseEntity.ok(mapper.toDto(service.getById(id)));
    }

    @Override
    public ResponseEntity<AdditionalRuleGroupMutationResponse> createAdditionalRuleGroup(AdditionalRuleGroupRequest request) {
        AdditionalRuleGroupMutationResponse response = mapper.toMutationResponse(service.create(
                request.getName(),
                ruleRequestMapper.toCreateParams(request.getRules())));
        return ResponseEntity
                .created(URI.create("/api/additional-rule-groups/" + response.getGroup().getId()))
                .body(response);
    }

    @Override
    public ResponseEntity<AdditionalRuleGroupMutationResponse> updateAdditionalRuleGroup(UUID id, AdditionalRuleGroupRequest request) {
        return ResponseEntity.ok(mapper.toMutationResponse(service.update(
                id,
                request.getName(),
                ruleRequestMapper.toCreateParams(request.getRules()))));
    }

    @Override
    public ResponseEntity<RecalculationSummaryResponse> deleteAdditionalRuleGroup(UUID id) {
        return ResponseEntity.status(HttpStatus.OK).body(mapper.toRecalculationSummary(service.delete(id)));
    }
}
