package com.tracker.controller;

import com.tracker.api.RecurringPaymentsApi;
import com.tracker.api.model.*;
import com.tracker.model.entity.Frequency;
import com.tracker.model.entity.PaymentPeriodHistory;
import com.tracker.model.entity.PaymentType;
import com.tracker.service.PaymentPeriodHistoryService;
import com.tracker.service.RecurringPaymentSimulationService;
import com.tracker.service.RecurringPaymentService;
import com.tracker.service.RuleCreateParams;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
public class RecurringPaymentController implements RecurringPaymentsApi {

    private final RecurringPaymentService recurringPaymentService;
    private final RecurringPaymentMapper recurringPaymentMapper;
    private final RecurringPaymentRuleRequestMapper recurringPaymentRuleRequestMapper;
    private final RecurringPaymentSimulationService simulationService;
    private final AdditionalGroupTransactionMatchMapper additionalGroupTransactionMatchMapper;
    private final PaymentPeriodHistoryService historyService;
    private final com.tracker.service.RecurringPaymentRecalculationService recalculationService;

    public RecurringPaymentController(RecurringPaymentService recurringPaymentService,
                                      RecurringPaymentMapper recurringPaymentMapper,
                                      RecurringPaymentRuleRequestMapper recurringPaymentRuleRequestMapper,
                                      RecurringPaymentSimulationService simulationService,
                                      AdditionalGroupTransactionMatchMapper additionalGroupTransactionMatchMapper,
                                      PaymentPeriodHistoryService historyService,
                                      com.tracker.service.RecurringPaymentRecalculationService recalculationService) {
        this.recurringPaymentService = recurringPaymentService;
        this.recurringPaymentMapper = recurringPaymentMapper;
        this.recurringPaymentRuleRequestMapper = recurringPaymentRuleRequestMapper;
        this.simulationService = simulationService;
        this.additionalGroupTransactionMatchMapper = additionalGroupTransactionMatchMapper;
        this.historyService = historyService;
        this.recalculationService = recalculationService;
    }

    @Override
    public ResponseEntity<List<RecurringPaymentDto>> getRecurringPayments(String category) {
        return ResponseEntity.ok(
                recurringPaymentMapper.toDtoList(recurringPaymentService.getAllRecurringPayments(category)));
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
        List<RuleCreateParams> ruleParams = recurringPaymentRuleRequestMapper.toCreateParams(request.getRules());

        var payment = recurringPaymentService.create(
                request.getName(),
                PaymentType.valueOf(request.getPaymentType().getValue()),
                Frequency.valueOf(request.getFrequency().getValue()),
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
    public ResponseEntity<RecurringPaymentSimulationResponse> simulateRecurringPayment(RecurringPaymentSimulationRequest request) {
        var transientRules = recurringPaymentRuleRequestMapper.toSimulationRules(request.getRules());

        RecurringPaymentSimulationService.SimulationResult result = simulationService.simulate(transientRules);

        RecurringPaymentSimulationResponse response = new RecurringPaymentSimulationResponse(
                recurringPaymentMapper.toTransactionDtoList(result.matchingTransactions()),
                result.totalMatchCount(),
                result.omittedAdditionalMatchCount(),
                result.omittedAdditionalMatches().stream()
                        .map(additionalGroupTransactionMatchMapper::toDto)
                        .toList(),
                result.overlappingPayments().stream()
                        .map(overlap -> new OverlappingPaymentDto(overlap.id(), overlap.name()))
                        .toList()
        );

        return ResponseEntity.ok(response);
    }

    @Override
    public ResponseEntity<List<PaymentPeriodHistoryEntry>> getRecurringPaymentHistory(UUID id, LocalDate from, LocalDate to) {
        List<PaymentPeriodHistory> history = historyService.getHistory(id, from, to);
        List<PaymentPeriodHistoryEntry> entries = history.stream()
                .map(h -> {
                    PaymentPeriodHistoryEntry entry = new PaymentPeriodHistoryEntry();
                    entry.setId(h.getId());
                    entry.setPeriodStart(h.getPeriodStart());
                    entry.setPeriodEnd(h.getPeriodEnd());
                    entry.setAmount(h.getAmount().doubleValue());
                    return entry;
                })
                .toList();
        return ResponseEntity.ok(entries);
    }

    @Override
    public ResponseEntity<RecalculationSummaryResponse> recalculateRecurringPayments() {
        var result = recalculationService.recalculateCurrentUserRecurringPayments();
        RecalculationSummaryResponse response = new RecalculationSummaryResponse();
        response.setTransactionsMarkedInterAccount(result.transactionsMarkedInterAccount());
        response.setTransactionLinksRemoved(result.transactionLinksRemoved());
        response.setRecurringPaymentsDeleted(result.recurringPaymentsDeleted());
        response.setRecurringPaymentsDetected(result.recurringPaymentsDetected());
        return ResponseEntity.ok(response);
    }
}
