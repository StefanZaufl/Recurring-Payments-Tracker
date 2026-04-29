package com.tracker.controller;

import com.tracker.api.model.BankAccountDto;
import com.tracker.api.model.RecurringPaymentDto;
import com.tracker.api.model.TransactionDto;
import com.tracker.model.entity.Frequency;
import com.tracker.model.entity.PaymentType;
import com.tracker.model.entity.RecurringPayment;
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
public abstract class RecurringPaymentMapper {

    @Autowired
    protected BankAccountService bankAccountService;

    @Autowired
    protected BankAccountMapper bankAccountMapper;

    @Autowired
    protected TransactionLinkMetadataEnricher linkMetadataEnricher;

    @Mapping(source = "category.id", target = "categoryId")
    @Mapping(source = "category.name", target = "categoryName")
    @Mapping(source = "category.color", target = "categoryColor")
    @Mapping(source = "frequency", target = "frequency")
    @Mapping(expression = "java(entity.getRules() != null ? entity.getRules().size() : 0)", target = "ruleCount")
    public abstract RecurringPaymentDto toDto(RecurringPayment entity);

    public abstract List<RecurringPaymentDto> toDtoList(List<RecurringPayment> entities);

    @Mapping(source = "upload.id", target = "uploadId")
    @Mapping(target = "linkedPaymentCount", ignore = true)
    @Mapping(target = "linkedPaymentNames", ignore = true)
    protected abstract TransactionDto toTransactionDtoBase(Transaction transaction);

    public TransactionDto toTransactionDto(Transaction transaction) {
        if (transaction == null) {
            return null;
        }
        return toTransactionDtoList(List.of(transaction)).getFirst();
    }

    public List<TransactionDto> toTransactionDtoList(List<Transaction> transactions) {
        List<TransactionDto> dtos = transactions.stream()
                .map(this::toTransactionDtoBase)
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

    protected com.tracker.api.model.Frequency mapFrequency(Frequency frequency) {
        if (frequency == null) {
            return null;
        }
        return com.tracker.api.model.Frequency.fromValue(frequency.name());
    }

    protected com.tracker.api.model.PaymentType mapPaymentType(PaymentType paymentType) {
        if (paymentType == null) {
            return null;
        }
        return com.tracker.api.model.PaymentType.fromValue(paymentType.name());
    }
}
