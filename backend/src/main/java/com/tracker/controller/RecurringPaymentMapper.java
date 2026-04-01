package com.tracker.controller;

import com.tracker.api.model.RecurringPaymentDto;
import com.tracker.api.model.TransactionDto;
import com.tracker.model.entity.RecurringPayment;
import com.tracker.model.entity.Transaction;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;

@Mapper(componentModel = "spring")
public interface RecurringPaymentMapper {

    @Mapping(source = "category.id", target = "categoryId")
    @Mapping(source = "category.name", target = "categoryName")
    @Mapping(source = "frequency", target = "frequency")
    RecurringPaymentDto toDto(RecurringPayment entity);

    List<RecurringPaymentDto> toDtoList(List<RecurringPayment> entities);

    @Mapping(source = "upload.id", target = "uploadId")
    TransactionDto toTransactionDto(Transaction transaction);

    List<TransactionDto> toTransactionDtoList(List<Transaction> transactions);

    default Double mapBigDecimal(BigDecimal value) {
        return value != null ? value.doubleValue() : null;
    }

    default OffsetDateTime mapLocalDateTime(LocalDateTime value) {
        return value != null ? value.atOffset(ZoneOffset.UTC) : null;
    }

    default com.tracker.api.model.Frequency mapFrequency(String frequency) {
        if (frequency == null) {
            return null;
        }
        return com.tracker.api.model.Frequency.fromValue(frequency);
    }
}
