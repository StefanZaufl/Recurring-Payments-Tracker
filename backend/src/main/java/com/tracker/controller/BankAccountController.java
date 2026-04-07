package com.tracker.controller;

import com.tracker.api.BankAccountsApi;
import com.tracker.api.model.BankAccountDto;
import com.tracker.api.model.CreateBankAccountRequest;
import com.tracker.api.model.UpdateBankAccountRequest;
import com.tracker.service.BankAccountService;
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
    public ResponseEntity<BankAccountDto> createBankAccount(CreateBankAccountRequest request) {
        var account = bankAccountService.create(request.getIban(), unwrap(request.getName()));
        return ResponseEntity.status(HttpStatus.CREATED).body(bankAccountMapper.toDto(account));
    }

    @Override
    public ResponseEntity<BankAccountDto> updateBankAccount(UUID id, UpdateBankAccountRequest request) {
        return bankAccountService.update(id, unwrap(request.getName()), request.getName() != null && request.getName().isPresent())
                .map(bankAccountMapper::toDto)
                .map(ResponseEntity::ok)
                .orElseThrow(() -> new ResourceNotFoundException("Bank account not found: " + id));
    }

    @Override
    public ResponseEntity<Void> deleteBankAccount(UUID id) {
        if (bankAccountService.delete(id)) {
            return ResponseEntity.noContent().build();
        }
        throw new ResourceNotFoundException("Bank account not found: " + id);
    }

    private String unwrap(JsonNullable<String> value) {
        return value != null && value.isPresent() ? value.get() : null;
    }
}
