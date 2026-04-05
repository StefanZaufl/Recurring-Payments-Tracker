package com.tracker.controller;

import com.tracker.api.RecurringPaymentsApi;
import com.tracker.api.model.*;
import com.tracker.model.entity.PaymentType;
import com.tracker.model.entity.Rule;
import com.tracker.model.entity.RuleType;
import com.tracker.model.entity.TargetField;
import com.tracker.service.RecurringPaymentService;
import com.tracker.service.RuleCreateParams;
import com.tracker.service.SimulationService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.net.URI;
import java.util.List;
import java.util.UUID;

@RestController
public class RecurringPaymentController implements RecurringPaymentsApi {

    private final RecurringPaymentService recurringPaymentService;
    private final RecurringPaymentMapper recurringPaymentMapper;
    private final SimulationService simulationService;

    public RecurringPaymentController(RecurringPaymentService recurringPaymentService,
                                      RecurringPaymentMapper recurringPaymentMapper,
                                      SimulationService simulationService) {
        this.recurringPaymentService = recurringPaymentService;
        this.recurringPaymentMapper = recurringPaymentMapper;
        this.simulationService = simulationService;
    }

    @Override
    public ResponseEntity<List<RecurringPaymentDto>> getRecurringPayments() {
        return ResponseEntity.ok(
                recurringPaymentMapper.toDtoList(recurringPaymentService.getAllRecurringPayments()));
    }

    @Override
    public ResponseEntity<RecurringPaymentDto> updateRecurringPayment(UUID id,
                                                                       RecurringPaymentUpdateRequest request) {
        return recurringPaymentService.update(id, request.getName(), request.getCategoryId(), request.getIsActive())
                .map(recurringPaymentMapper::toDto)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @Override
    public ResponseEntity<List<TransactionDto>> getRecurringPaymentTransactions(UUID id) {
        return recurringPaymentService.getById(id)
                .map(payment -> ResponseEntity.ok(
                        recurringPaymentMapper.toTransactionDtoList(
                                recurringPaymentService.getTransactionsForPayment(id))))
                .orElse(ResponseEntity.notFound().build());
    }

    @Override
    public ResponseEntity<RecurringPaymentDto> createRecurringPayment(
            CreateRecurringPaymentRequest request) {
        List<RuleCreateParams> ruleParams = request.getRules().stream()
                .map(r -> new RuleCreateParams(
                        RuleType.valueOf(r.getRuleType().getValue()),
                        r.getTargetField() != null ? TargetField.valueOf(r.getTargetField().getValue()) : null,
                        r.getText(),
                        r.getStrict(),
                        r.getThreshold(),
                        r.getAmount() != null ? BigDecimal.valueOf(r.getAmount()) : null,
                        r.getFluctuationRange() != null ? BigDecimal.valueOf(r.getFluctuationRange()) : null
                )).toList();

        var payment = recurringPaymentService.create(
                request.getName(),
                PaymentType.valueOf(request.getPaymentType().getValue()),
                request.getFrequency().getValue(),
                ruleParams);

        return ResponseEntity.created(URI.create("/api/recurring-payments/" + payment.getId()))
                .body(recurringPaymentMapper.toDto(payment));
    }

    @Override
    public ResponseEntity<Void> deleteRecurringPayment(UUID id) {
        recurringPaymentService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @Override
    public ResponseEntity<SimulateRulesResponse> simulateRules(SimulateRulesRequest request) {
        List<Rule> transientRules = request.getRules().stream()
                .map(r -> {
                    Rule rule = new Rule();
                    rule.setRuleType(RuleType.valueOf(r.getRuleType().getValue()));
                    if (r.getTargetField() != null) {
                        rule.setTargetField(TargetField.valueOf(r.getTargetField().getValue()));
                    }
                    rule.setText(r.getText());
                    rule.setStrict(r.getStrict() != null ? r.getStrict() : true);
                    rule.setThreshold(r.getThreshold());
                    if (r.getAmount() != null) rule.setAmount(BigDecimal.valueOf(r.getAmount()));
                    if (r.getFluctuationRange() != null) rule.setFluctuationRange(BigDecimal.valueOf(r.getFluctuationRange()));
                    return rule;
                }).toList();

        SimulationService.SimulationResult result = simulationService.simulate(transientRules);

        SimulateRulesResponse response = new SimulateRulesResponse(
                recurringPaymentMapper.toTransactionDtoList(result.matchingTransactions()),
                result.matchingTransactions().size(),
                result.overlappingPayments().stream()
                        .map(op -> new OverlappingPaymentDto(op.id(), op.name()))
                        .toList()
        );

        return ResponseEntity.ok(response);
    }
}
