package com.tracker.rules.api;

import com.tracker.rules.domain.RuleType;
import com.tracker.rules.domain.TargetField;

import com.tracker.api.model.RuleDto;
import com.tracker.rules.domain.Rule;
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

    default com.tracker.api.model.RuleType mapRuleType(com.tracker.rules.domain.RuleType ruleType) {
        if (ruleType == null) return null;
        return com.tracker.api.model.RuleType.fromValue(ruleType.name());
    }

    default com.tracker.api.model.TargetField mapTargetField(com.tracker.rules.domain.TargetField targetField) {
        if (targetField == null) return null;
        return com.tracker.api.model.TargetField.fromValue(targetField.name());
    }
}
