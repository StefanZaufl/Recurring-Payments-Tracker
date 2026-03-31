package com.tracker.controller;

import com.tracker.api.model.TransactionDto;
import com.tracker.model.entity.Transaction;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;

@Mapper(componentModel = "spring")
public interface TransactionMapper {

    @Mapping(source = "upload.id", target = "uploadId")
    @Mapping(source = "amount", target = "amount")
    TransactionDto toDto(Transaction transaction);

    List<TransactionDto> toDtoList(List<Transaction> transactions);

    default Double mapBigDecimal(BigDecimal value) {
        return value != null ? value.doubleValue() : null;
    }

    default OffsetDateTime mapLocalDateTime(LocalDateTime value) {
        return value != null ? value.atOffset(ZoneOffset.UTC) : null;
    }
}
