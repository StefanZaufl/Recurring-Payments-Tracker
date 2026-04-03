package com.tracker.controller;

import com.tracker.api.RecurringPaymentRulesApi;
import com.tracker.api.model.CreateRuleRequest;
import com.tracker.api.model.RecurringPaymentDto;
import com.tracker.api.model.RuleDto;
import com.tracker.api.model.UpdateRuleRequest;
import com.tracker.model.entity.RecurringPayment;
import com.tracker.model.entity.RuleType;
import com.tracker.model.entity.TargetField;
import com.tracker.service.RecurringPaymentDetectionService;
import com.tracker.service.RuleService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.UUID;

@RestController
public class RuleController implements RecurringPaymentRulesApi {

    private final RuleService ruleService;
    private final RuleMapper ruleMapper;
    private final RecurringPaymentDetectionService detectionService;
    private final RecurringPaymentMapper recurringPaymentMapper;

    public RuleController(RuleService ruleService, RuleMapper ruleMapper,
                          RecurringPaymentDetectionService detectionService,
                          RecurringPaymentMapper recurringPaymentMapper) {
        this.ruleService = ruleService;
        this.ruleMapper = ruleMapper;
        this.detectionService = detectionService;
        this.recurringPaymentMapper = recurringPaymentMapper;
    }

    @Override
    public ResponseEntity<List<RuleDto>> getRules(UUID recurringPaymentId) {
        try {
            return ResponseEntity.ok(ruleMapper.toDtoList(ruleService.getRulesForPayment(recurringPaymentId)));
        } catch (NoSuchElementException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @Override
    public ResponseEntity<RuleDto> createRule(UUID recurringPaymentId, CreateRuleRequest request) {
        try {
            var rule = ruleService.createRule(
                    recurringPaymentId,
                    mapRuleType(request.getRuleType()),
                    mapTargetField(request.getTargetField()),
                    request.getText(),
                    request.getStrict(),
                    request.getThreshold(),
                    toBigDecimal(request.getAmount()),
                    toBigDecimal(request.getFluctuationRange()));
            return ResponseEntity.status(HttpStatus.CREATED).body(ruleMapper.toDto(rule));
        } catch (NoSuchElementException e) {
            return ResponseEntity.notFound().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @Override
    public ResponseEntity<RuleDto> updateRule(UUID recurringPaymentId, UUID ruleId, UpdateRuleRequest request) {
        try {
            return ruleService.updateRule(
                            recurringPaymentId, ruleId,
                            mapTargetField(request.getTargetField()),
                            request.getText(),
                            request.getStrict(),
                            request.getThreshold(),
                            toBigDecimal(request.getAmount()),
                            toBigDecimal(request.getFluctuationRange()))
                    .map(ruleMapper::toDto)
                    .map(ResponseEntity::ok)
                    .orElse(ResponseEntity.notFound().build());
        } catch (NoSuchElementException e) {
            return ResponseEntity.notFound().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @Override
    public ResponseEntity<Void> deleteRule(UUID recurringPaymentId, UUID ruleId) {
        try {
            if (ruleService.deleteRule(recurringPaymentId, ruleId)) {
                return ResponseEntity.noContent().build();
            }
            return ResponseEntity.notFound().build();
        } catch (NoSuchElementException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @Override
    public ResponseEntity<RecurringPaymentDto> reEvaluateRecurringPayment(UUID recurringPaymentId) {
        try {
            RecurringPayment updated = detectionService.reEvaluateRecurringPayment(recurringPaymentId);
            return ResponseEntity.ok(recurringPaymentMapper.toDto(updated));
        } catch (NoSuchElementException e) {
            return ResponseEntity.notFound().build();
        }
    }

    private RuleType mapRuleType(com.tracker.api.model.RuleType apiRuleType) {
        if (apiRuleType == null) return null;
        return RuleType.valueOf(apiRuleType.getValue());
    }

    private TargetField mapTargetField(com.tracker.api.model.TargetField apiTargetField) {
        if (apiTargetField == null) return null;
        return TargetField.valueOf(apiTargetField.getValue());
    }

    private BigDecimal toBigDecimal(Double value) {
        return value != null ? BigDecimal.valueOf(value) : null;
    }
}
