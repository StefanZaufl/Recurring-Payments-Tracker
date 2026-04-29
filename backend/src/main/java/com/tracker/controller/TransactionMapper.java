package com.tracker.controller;

import com.tracker.api.model.BankAccountDto;
import com.tracker.api.model.TransactionDto;
import com.tracker.model.entity.Transaction;
import com.tracker.service.BankAccountService;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.springframework.beans.factory.annotation.Autowired;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;

@Mapper(componentModel = "spring")
public abstract class TransactionMapper {

    @Autowired
    protected BankAccountService bankAccountService;

    @Autowired
    protected BankAccountMapper bankAccountMapper;

    @Autowired
    protected TransactionLinkMetadataEnricher linkMetadataEnricher;

    @Mapping(source = "upload.id", target = "uploadId")
    @Mapping(source = "amount", target = "amount")
    @Mapping(target = "linkedPaymentCount", ignore = true)
    @Mapping(target = "linkedPaymentNames", ignore = true)
    protected abstract TransactionDto toDtoBase(Transaction transaction);

    public TransactionDto toDto(Transaction transaction) {
        if (transaction == null) {
            return null;
        }
        return toDtoList(List.of(transaction)).getFirst();
    }

    public List<TransactionDto> toDtoList(List<Transaction> transactions) {
        List<TransactionDto> dtos = transactions.stream()
                .map(this::toDtoBase)
                .toList();
        linkMetadataEnricher.enrich(transactions, dtos);
        return dtos;
    }

    protected BankAccountDto map(String iban) {
        if (iban == null || iban.isBlank()) {
            return null;
        }
        return bankAccountService.getCurrentUserAccountByIban(iban)
                .map(bankAccountMapper::toDto)
                .orElseGet(() -> {
                    BankAccountDto account = new BankAccountDto();
                    account.setIban(iban);
                    return account;
                });
    }

    protected Double mapBigDecimal(BigDecimal value) {
        return value != null ? value.doubleValue() : null;
    }

    protected OffsetDateTime mapLocalDateTime(LocalDateTime value) {
        return value != null ? value.atOffset(ZoneOffset.UTC) : null;
    }
}
