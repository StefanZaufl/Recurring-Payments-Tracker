package com.tracker.controller;

import com.tracker.api.RecurringPaymentsApi;
import com.tracker.api.model.RecurringPaymentDto;
import com.tracker.api.model.RecurringPaymentUpdateRequest;
import com.tracker.api.model.TransactionDto;
import com.tracker.service.RecurringPaymentService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
public class RecurringPaymentController implements RecurringPaymentsApi {

    private final RecurringPaymentService recurringPaymentService;
    private final RecurringPaymentMapper recurringPaymentMapper;

    public RecurringPaymentController(RecurringPaymentService recurringPaymentService,
                                      RecurringPaymentMapper recurringPaymentMapper) {
        this.recurringPaymentService = recurringPaymentService;
        this.recurringPaymentMapper = recurringPaymentMapper;
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
}
