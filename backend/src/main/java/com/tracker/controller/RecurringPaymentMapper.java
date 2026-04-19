package com.tracker.controller;

import com.tracker.api.model.BankAccountDto;
import com.tracker.api.model.RecurringPaymentDto;
import com.tracker.api.model.TransactionDto;
import com.tracker.model.entity.Frequency;
import com.tracker.model.entity.PaymentType;
import com.tracker.model.entity.RecurringPayment;
import com.tracker.model.entity.Transaction;
import com.tracker.repository.TransactionRecurringLinkRepository;
import com.tracker.service.BankAccountService;
import com.tracker.service.UserContextService;
import org.mapstruct.AfterMapping;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;
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
    protected TransactionRecurringLinkRepository linkRepository;

    @Autowired
    protected UserContextService userContextService;

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
    public abstract TransactionDto toTransactionDto(Transaction transaction);

    public abstract List<TransactionDto> toTransactionDtoList(List<Transaction> transactions);

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

    @AfterMapping
    protected void addLinkMetadata(Transaction transaction, @MappingTarget TransactionDto dto) {
        if (transaction.getId() == null) {
            dto.setLinkedPaymentCount(0);
            dto.setLinkedPaymentNames(List.of());
            return;
        }
        var links = linkRepository.findWithRecurringPaymentByTransactionIdAndUserId(
                transaction.getId(), userContextService.getCurrentUserId());
        dto.setLinkedPaymentCount(links.size());
        dto.setLinkedPaymentNames(links.stream()
                .map(link -> link.getRecurringPayment().getName())
                .sorted()
                .toList());
    }
}
