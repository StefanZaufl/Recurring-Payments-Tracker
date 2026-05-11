package com.tracker.bankaccounts.api;

import com.tracker.recurringpayments.application.RecurringPaymentRecalculationService;
import com.tracker.shared.api.ResourceNotFoundException;

import com.tracker.api.BankAccountsApi;
import com.tracker.api.model.BankAccountMutationResponse;
import com.tracker.api.model.BankAccountDto;
import com.tracker.api.model.CreateBankAccountRequest;
import com.tracker.api.model.RecalculationSummaryResponse;
import com.tracker.api.model.UpdateBankAccountRequest;
import com.tracker.bankaccounts.application.BankAccountService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;
import org.openapitools.jackson.nullable.JsonNullable;

import java.util.List;
import java.util.UUID;

@RestController
public class BankAccountController implements BankAccountsApi {

    private final BankAccountService bankAccountService;
    private final BankAccountMapper bankAccountMapper;

    public BankAccountController(BankAccountService bankAccountService, BankAccountMapper bankAccountMapper) {
        this.bankAccountService = bankAccountService;
        this.bankAccountMapper = bankAccountMapper;
    }

    @Override
    public ResponseEntity<List<BankAccountDto>> getBankAccounts() {
        return ResponseEntity.ok(bankAccountMapper.toDtoList(bankAccountService.getAllAccounts()));
    }

    @Override
    public ResponseEntity<BankAccountMutationResponse> createBankAccount(CreateBankAccountRequest request) {
        var result = bankAccountService.createWithRecalculation(request.getIban(), unwrap(request.getName()));
        BankAccountMutationResponse response = new BankAccountMutationResponse();
        response.setBankAccount(bankAccountMapper.toDto(result.bankAccount()));
        response.setRecalculationSummary(toSummaryResponse(result.recalculationResult()));
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @Override
    public ResponseEntity<BankAccountDto> updateBankAccount(UUID id, UpdateBankAccountRequest request) {
        return bankAccountService.update(id, unwrap(request.getName()), request.getName() != null && request.getName().isPresent())
                .map(bankAccountMapper::toDto)
                .map(ResponseEntity::ok)
                .orElseThrow(() -> new ResourceNotFoundException("Bank account not found: " + id));
    }

    @Override
    public ResponseEntity<RecalculationSummaryResponse> deleteBankAccount(UUID id) {
        return bankAccountService.deleteWithRecalculation(id)
                .map(this::toSummaryResponse)
                .map(ResponseEntity::ok)
                .orElseThrow(() -> new ResourceNotFoundException("Bank account not found: " + id));
    }

    private String unwrap(JsonNullable<String> value) {
        return value != null && value.isPresent() ? value.get() : null;
    }

    private RecalculationSummaryResponse toSummaryResponse(
            com.tracker.recurringpayments.application.RecurringPaymentRecalculationService.RecalculationResult result) {
        RecalculationSummaryResponse response = new RecalculationSummaryResponse();
        response.setTransactionsMarkedInterAccount(result.transactionsMarkedInterAccount());
        response.setTransactionLinksRemoved(result.transactionLinksRemoved());
        response.setRecurringPaymentsDeleted(result.recurringPaymentsDeleted());
        response.setRecurringPaymentsDetected(result.recurringPaymentsDetected());
        return response;
    }
}
