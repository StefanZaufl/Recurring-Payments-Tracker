package com.tracker.controller;

import com.tracker.api.model.CreateRuleRequest;
import com.tracker.api.model.RuleType;
import com.tracker.api.model.TargetField;
import com.tracker.service.RuleCreateParams;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class RecurringPaymentRuleRequestMapperTest {

    private final RecurringPaymentRuleRequestMapper mapper = new RecurringPaymentRuleRequestMapper();

    @Test
    void defaultsStrictToTrueForCreateAndSimulation() {
        CreateRuleRequest request = new CreateRuleRequest(RuleType.JARO_WINKLER);
        request.setTargetField(TargetField.PARTNER_NAME);
        request.setText("netflix");
        request.setThreshold(0.85);

        RuleCreateParams createParams = mapper.toCreateParams(List.of(request)).getFirst();
        var simulationRule = mapper.toSimulationRules(List.of(request)).getFirst();

        assertThat(createParams.strict()).isTrue();
        assertThat(simulationRule.getStrict()).isTrue();
    }

    @Test
    void keepsNullableTargetFieldConsistentAcrossCreateAndSimulation() {
        CreateRuleRequest request = new CreateRuleRequest(RuleType.AMOUNT);
        request.setAmount(-12.99);
        request.setFluctuationRange(1.5);

        RuleCreateParams createParams = mapper.toCreateParams(List.of(request)).getFirst();
        var simulationRule = mapper.toSimulationRules(List.of(request)).getFirst();

        assertThat(createParams.targetField()).isNull();
        assertThat(simulationRule.getTargetField()).isNull();
    }

    @Test
    void mapsAmountRuleFieldsIdenticallyForCreateAndSimulation() {
        CreateRuleRequest request = new CreateRuleRequest(RuleType.AMOUNT);
        request.setAmount(-12.99);
        request.setFluctuationRange(1.25);
        request.setStrict(false);

        RuleCreateParams createParams = mapper.toCreateParams(List.of(request)).getFirst();
        var simulationRule = mapper.toSimulationRules(List.of(request)).getFirst();

        assertThat(createParams.amount()).isEqualByComparingTo("-12.99");
        assertThat(createParams.fluctuationRange()).isEqualByComparingTo("1.25");
        assertThat(simulationRule.getAmount()).isEqualByComparingTo("-12.99");
        assertThat(simulationRule.getFluctuationRange()).isEqualByComparingTo("1.25");
        assertThat(createParams.strict()).isFalse();
        assertThat(simulationRule.getStrict()).isFalse();
    }

    @Test
    void mapsTextRuleFieldsIdenticallyForCreateAndSimulation() {
        CreateRuleRequest request = new CreateRuleRequest(RuleType.REGEX);
        request.setTargetField(TargetField.PARTNER_NAME);
        request.setText("netflix.*");
        request.setStrict(false);

        RuleCreateParams createParams = mapper.toCreateParams(List.of(request)).getFirst();
        var simulationRule = mapper.toSimulationRules(List.of(request)).getFirst();

        assertThat(createParams.ruleType()).isEqualTo(com.tracker.model.entity.RuleType.REGEX);
        assertThat(createParams.targetField()).isEqualTo(com.tracker.model.entity.TargetField.PARTNER_NAME);
        assertThat(createParams.text()).isEqualTo("netflix.*");
        assertThat(simulationRule.getRuleType()).isEqualTo(com.tracker.model.entity.RuleType.REGEX);
        assertThat(simulationRule.getTargetField()).isEqualTo(com.tracker.model.entity.TargetField.PARTNER_NAME);
        assertThat(simulationRule.getText()).isEqualTo("netflix.*");
    }
}
