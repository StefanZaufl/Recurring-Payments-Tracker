package com.tracker.service;

import com.tracker.controller.ResourceNotFoundException;
import com.tracker.model.entity.PaymentType;
import com.tracker.model.entity.RecurringPayment;
import com.tracker.model.entity.Rule;
import com.tracker.model.entity.RuleType;
import com.tracker.model.entity.TargetField;
import com.tracker.model.entity.User;
import com.tracker.repository.RecurringPaymentRepository;
import com.tracker.repository.RuleRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RuleServiceTest {

    @Mock
    private RuleRepository ruleRepository;
    @Mock
    private RecurringPaymentRepository recurringPaymentRepository;
    @Mock
    private UserContextService userContextService;
    @Mock
    private RecurringPaymentRecalculationService recalculationService;

    private RuleService ruleService;
    private UUID userId;
    private User user;
    private RecurringPayment recurringPayment;

    @BeforeEach
    void setUp() {
        ruleService = new RuleService(
                ruleRepository,
                recurringPaymentRepository,
                userContextService,
                new RuleValidationService(),
                recalculationService);
        userId = UUID.randomUUID();
        user = new User();
        user.setId(userId);
        recurringPayment = new RecurringPayment();
        recurringPayment.setId(UUID.randomUUID());
        recurringPayment.setRules(new ArrayList<>());

        lenient().when(userContextService.getCurrentUserId()).thenReturn(userId);
        lenient().when(userContextService.getCurrentUser()).thenReturn(user);
        lenient().when(recurringPaymentRepository.findByIdAndUserId(recurringPayment.getId(), userId))
                .thenReturn(Optional.of(recurringPayment));
        lenient().when(ruleRepository.save(any(Rule.class))).thenAnswer(invocation -> invocation.getArgument(0));
        lenient().when(ruleRepository.findByRecurringPaymentIdAndUserId(recurringPayment.getId(), userId))
                .thenReturn(List.of());
    }

    @Test
    void getRulesForPayment_requiresExistingPaymentAndDelegatesLookup() {
        List<Rule> rules = List.of(new Rule(), new Rule());
        when(ruleRepository.findByRecurringPaymentIdAndUserId(recurringPayment.getId(), userId)).thenReturn(rules);

        assertThat(ruleService.getRulesForPayment(recurringPayment.getId())).isEqualTo(rules);
        assertThatThrownBy(() -> ruleService.getRulesForPayment(UUID.randomUUID()))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void createRule_throwsWhenRecurringPaymentDoesNotExist() {
        UUID missingPaymentId = UUID.randomUUID();
        when(recurringPaymentRepository.findByIdAndUserId(missingPaymentId, userId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> ruleService.createRule(
                missingPaymentId, RuleType.REGEX, TargetField.PARTNER_NAME, "x", true, null, null, null))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessage("Recurring payment not found: " + missingPaymentId);
    }

    @Test
    void createRule_validatesRegexAndDefaultsStrictToTrue() {
        Rule result = ruleService.createRule(
                recurringPayment.getId(),
                RuleType.REGEX,
                TargetField.PARTNER_NAME,
                "netflix.*",
                null,
                null,
                null,
                null
        );

        assertThat(result.getRuleType()).isEqualTo(RuleType.REGEX);
        assertThat(result.getTargetField()).isEqualTo(TargetField.PARTNER_NAME);
        assertThat(result.getText()).isEqualTo("netflix.*");
        assertThat(result.getStrict()).isTrue();
        assertThat(result.getUser()).isSameAs(user);
        verify(recalculationService).recalculateRecurringPaymentLinks(recurringPayment.getId());
    }

    @Test
    void createRule_recalculatesAllPaymentsWhenPaymentIsGrouped() {
        recurringPayment.setPaymentType(PaymentType.GROUPED);

        ruleService.createRule(
                recurringPayment.getId(),
                RuleType.REGEX,
                TargetField.PARTNER_NAME,
                "netflix.*",
                null,
                null,
                null,
                null
        );

        verify(recalculationService).recalculateCurrentUserRecurringPayments();
        verify(recalculationService, never()).recalculateRecurringPaymentLinks(any());
    }

    @Test
    void createRule_supportsValidJaroWinklerAndAmountRules() {
        Rule jaro = ruleService.createRule(
                recurringPayment.getId(),
                RuleType.JARO_WINKLER,
                TargetField.DETAILS,
                "subscription",
                false,
                0.85,
                null,
                null
        );
        Rule amount = ruleService.createRule(
                recurringPayment.getId(),
                RuleType.AMOUNT,
                null,
                null,
                null,
                null,
                new BigDecimal("19.99"),
                new BigDecimal("1.00")
        );

        assertThat(jaro.getRuleType()).isEqualTo(RuleType.JARO_WINKLER);
        assertThat(jaro.getStrict()).isFalse();
        assertThat(jaro.getThreshold()).isEqualTo(0.85);
        assertThat(amount.getRuleType()).isEqualTo(RuleType.AMOUNT);
        assertThat(amount.getAmount()).isEqualByComparingTo("19.99");
        assertThat(amount.getFluctuationRange()).isEqualByComparingTo("1.00");
    }

    @Test
    void createRule_rejectsInvalidRuleConfigurations() {
        assertThatThrownBy(() -> ruleService.createRule(
                recurringPayment.getId(), RuleType.REGEX, null, "x", true, null, null, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("targetField is required for REGEX rules");

        assertThatThrownBy(() -> ruleService.createRule(
                recurringPayment.getId(), RuleType.REGEX, TargetField.PARTNER_NAME, "[", true, null, null, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Invalid regex pattern");

        assertThatThrownBy(() -> ruleService.createRule(
                recurringPayment.getId(), RuleType.REGEX, TargetField.PARTNER_NAME, " ", true, null, null, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("text is required for REGEX rules");

        assertThatThrownBy(() -> ruleService.createRule(
                recurringPayment.getId(), RuleType.JARO_WINKLER, null, "abc", true, 0.8, null, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("targetField is required for JARO_WINKLER rules");

        assertThatThrownBy(() -> ruleService.createRule(
                recurringPayment.getId(), RuleType.JARO_WINKLER, TargetField.PARTNER_NAME, "abc", true, 1.5, null, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("threshold must be between 0 and 1 for JARO_WINKLER rules");

        assertThatThrownBy(() -> ruleService.createRule(
                recurringPayment.getId(), RuleType.JARO_WINKLER, TargetField.PARTNER_NAME, " ", true, 0.9, null, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("text is required for JARO_WINKLER rules");

        assertThatThrownBy(() -> ruleService.createRule(
                recurringPayment.getId(), RuleType.AMOUNT, null, null, null, null, null, BigDecimal.ONE.negate()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("amount is required for AMOUNT rules");

        assertThatThrownBy(() -> ruleService.createRule(
                recurringPayment.getId(), RuleType.AMOUNT, null, null, null, null, BigDecimal.ONE, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("fluctuationRange must be non-negative for AMOUNT rules");

        assertThatThrownBy(() -> ruleService.createRule(
                recurringPayment.getId(), RuleType.AMOUNT, null, null, null, null, BigDecimal.ONE, BigDecimal.ONE.negate()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("fluctuationRange must be non-negative for AMOUNT rules");
    }

    @Test
    void updateRule_updatesFieldsAndPersistsValidResult() {
        Rule existing = new Rule();
        existing.setId(UUID.randomUUID());
        existing.setRuleType(RuleType.JARO_WINKLER);
        existing.setTargetField(TargetField.PARTNER_NAME);
        existing.setText("netflix");
        existing.setStrict(true);
        existing.setThreshold(0.85);
        when(ruleRepository.findByIdAndRecurringPaymentIdAndUserId(existing.getId(), recurringPayment.getId(), userId))
                .thenReturn(Optional.of(existing));

        Optional<Rule> updated = ruleService.updateRule(
                recurringPayment.getId(),
                existing.getId(),
                TargetField.DETAILS,
                "netflix family",
                false,
                0.91,
                null,
                null
        );

        assertThat(updated).contains(existing);
        assertThat(existing.getTargetField()).isEqualTo(TargetField.DETAILS);
        assertThat(existing.getText()).isEqualTo("netflix family");
        assertThat(existing.getStrict()).isFalse();
        assertThat(existing.getThreshold()).isEqualTo(0.91);
        verify(recalculationService).recalculateRecurringPaymentLinks(recurringPayment.getId());
    }

    @Test
    void updateRule_throwsWhenRecurringPaymentDoesNotExist() {
        UUID missingPaymentId = UUID.randomUUID();
        when(recurringPaymentRepository.findByIdAndUserId(missingPaymentId, userId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> ruleService.updateRule(
                missingPaymentId, UUID.randomUUID(), null, null, null, null, null, null))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessage("Recurring payment not found: " + missingPaymentId);
    }

    @Test
    void updateRule_canUpdateAmountRuleFields() {
        Rule amountRule = new Rule();
        amountRule.setId(UUID.randomUUID());
        amountRule.setRuleType(RuleType.AMOUNT);
        amountRule.setAmount(BigDecimal.TEN);
        amountRule.setFluctuationRange(BigDecimal.ONE);
        when(ruleRepository.findByIdAndRecurringPaymentIdAndUserId(amountRule.getId(), recurringPayment.getId(), userId))
                .thenReturn(Optional.of(amountRule));

        Optional<Rule> updated = ruleService.updateRule(
                recurringPayment.getId(),
                amountRule.getId(),
                null,
                null,
                null,
                null,
                new BigDecimal("12.50"),
                new BigDecimal("0.50")
        );

        assertThat(updated).contains(amountRule);
        assertThat(amountRule.getAmount()).isEqualByComparingTo("12.50");
        assertThat(amountRule.getFluctuationRange()).isEqualByComparingTo("0.50");
    }

    @Test
    void updateRule_returnsEmptyWhenRuleDoesNotExistAndRejectsInvalidMutations() {
        UUID missingRuleId = UUID.randomUUID();
        when(ruleRepository.findByIdAndRecurringPaymentIdAndUserId(missingRuleId, recurringPayment.getId(), userId))
                .thenReturn(Optional.empty());

        assertThat(ruleService.updateRule(recurringPayment.getId(), missingRuleId,
                null, null, null, null, null, null)).isEmpty();

        Rule amountRule = new Rule();
        amountRule.setId(UUID.randomUUID());
        amountRule.setRuleType(RuleType.AMOUNT);
        amountRule.setAmount(BigDecimal.TEN);
        amountRule.setFluctuationRange(BigDecimal.ONE);
        when(ruleRepository.findByIdAndRecurringPaymentIdAndUserId(amountRule.getId(), recurringPayment.getId(), userId))
                .thenReturn(Optional.of(amountRule));

        assertThatThrownBy(() -> ruleService.updateRule(
                recurringPayment.getId(), amountRule.getId(), null, null, null, null, null, BigDecimal.ONE.negate()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("fluctuationRange must be non-negative for AMOUNT rules");
    }

    @Test
    void deleteRule_detachesRuleFromPaymentWhenFound() {
        Rule rule = new Rule();
        rule.setId(UUID.randomUUID());
        recurringPayment.getRules().add(rule);
        when(ruleRepository.findByIdAndRecurringPaymentIdAndUserId(rule.getId(), recurringPayment.getId(), userId))
                .thenReturn(Optional.of(rule));

        assertThat(ruleService.deleteRule(recurringPayment.getId(), rule.getId())).isTrue();
        assertThat(recurringPayment.getRules()).isEmpty();
        assertThat(rule.getRecurringPayment()).isNull();
        verify(ruleRepository).delete(rule);
        verify(ruleRepository).flush();
        verify(recalculationService).recalculateRecurringPaymentLinks(recurringPayment.getId());
    }

    @Test
    void deleteRule_returnsFalseWhenRuleDoesNotExist() {
        UUID ruleId = UUID.randomUUID();
        when(ruleRepository.findByIdAndRecurringPaymentIdAndUserId(ruleId, recurringPayment.getId(), userId))
                .thenReturn(Optional.empty());

        assertThat(ruleService.deleteRule(recurringPayment.getId(), ruleId)).isFalse();
        verify(ruleRepository, never()).delete(any(Rule.class));
        verify(recalculationService, never()).recalculateRecurringPaymentLinks(any());
    }

    @Test
    void deleteRule_throwsWhenRecurringPaymentDoesNotExist() {
        UUID missingPaymentId = UUID.randomUUID();
        when(recurringPaymentRepository.findByIdAndUserId(missingPaymentId, userId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> ruleService.deleteRule(missingPaymentId, UUID.randomUUID()))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessage("Recurring payment not found: " + missingPaymentId);
    }
}
