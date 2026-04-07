package com.tracker.controller;

import com.tracker.api.model.BankAccountDto;
import com.tracker.model.entity.BankAccount;
import org.mapstruct.Mapper;
import org.openapitools.jackson.nullable.JsonNullable;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;

@Mapper(componentModel = "spring")
public interface BankAccountMapper {

    BankAccountDto toDto(BankAccount entity);

    List<BankAccountDto> toDtoList(List<BankAccount> entities);

    default OffsetDateTime mapLocalDateTime(LocalDateTime value) {
        return value != null ? value.atOffset(ZoneOffset.UTC) : null;
    }

    default JsonNullable<String> mapNullableString(String value) {
        return JsonNullable.of(value);
    }
}
