package com.tracker.controller;

import com.tracker.api.model.RuleDto;
import com.tracker.model.entity.Rule;
import org.mapstruct.Mapper;

import java.math.BigDecimal;
import java.util.List;

@Mapper(componentModel = "spring")
public interface RuleMapper {

    RuleDto toDto(Rule entity);

    List<RuleDto> toDtoList(List<Rule> entities);

    default Double mapBigDecimal(BigDecimal value) {
        return value != null ? value.doubleValue() : null;
    }

    default com.tracker.api.model.RuleType mapRuleType(com.tracker.model.entity.RuleType ruleType) {
        if (ruleType == null) return null;
        return com.tracker.api.model.RuleType.fromValue(ruleType.name());
    }

    default com.tracker.api.model.TargetField mapTargetField(com.tracker.model.entity.TargetField targetField) {
        if (targetField == null) return null;
        return com.tracker.api.model.TargetField.fromValue(targetField.name());
    }
}
