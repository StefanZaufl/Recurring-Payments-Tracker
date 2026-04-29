package com.tracker.controller;

import com.tracker.api.model.AdditionalGroupReferenceDto;
import com.tracker.api.model.AdditionalGroupTransactionMatchDto;
import com.tracker.service.AdditionalMatchingService;
import org.springframework.stereotype.Component;

@Component
public class AdditionalGroupTransactionMatchMapper {

    private final RecurringPaymentMapper recurringPaymentMapper;

    public AdditionalGroupTransactionMatchMapper(RecurringPaymentMapper recurringPaymentMapper) {
        this.recurringPaymentMapper = recurringPaymentMapper;
    }

    public AdditionalGroupTransactionMatchDto toDto(AdditionalMatchingService.TransactionGroupMatch match) {
        AdditionalGroupTransactionMatchDto dto = new AdditionalGroupTransactionMatchDto();
        dto.setTransactionId(match.transactionId());
        if (match.transaction() != null) {
            dto.setTransaction(recurringPaymentMapper.toTransactionDto(match.transaction()));
        }
        dto.setGroups(match.groups().stream()
                .map(group -> {
                    AdditionalGroupReferenceDto reference = new AdditionalGroupReferenceDto();
                    reference.setId(group.id());
                    reference.setName(group.name());
                    return reference;
                })
                .toList());
        return dto;
    }
}
