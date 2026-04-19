package com.tracker.service;

import com.tracker.controller.ConflictException;
import com.tracker.model.entity.AdditionalRuleGroup;
import com.tracker.model.entity.Rule;
import com.tracker.model.entity.RuleType;
import com.tracker.model.entity.TargetField;
import com.tracker.model.entity.User;
import com.tracker.repository.AdditionalRuleGroupRepository;
import com.tracker.repository.RuleRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdditionalRuleGroupServiceTest {

    @Mock
    private AdditionalRuleGroupRepository groupRepository;
    @Mock
    private RuleRepository ruleRepository;
    @Mock
    private UserContextService userContextService;
    @Mock
    private AdditionalMatchingService matchingService;
    @Mock
    private RecurringPaymentRecalculationService recalculationService;

    private AdditionalRuleGroupService service;
    private UUID userId;
    private User user;

    @BeforeEach
    void setUp() {
        service = new AdditionalRuleGroupService(
                groupRepository,
                ruleRepository,
                userContextService,
                new RuleValidationService(),
                matchingService,
                recalculationService
        );
        userId = UUID.randomUUID();
        user = new User();
        user.setId(userId);

        lenient().when(userContextService.getCurrentUserId()).thenReturn(userId);
        lenient().when(userContextService.getCurrentUser()).thenReturn(user);
        lenient().when(matchingService.countMatchesByGroupInLookback()).thenReturn(java.util.Map.of());
        lenient().when(recalculationService.recalculateCurrentUserRecurringPayments())
                .thenReturn(new RecurringPaymentRecalculationService.RecalculationResult(1, 2, 3, 4));
    }

    @Test
    void create_trimsNameStoresAdditionalRulesAndRecalculates() {
        AtomicReference<AdditionalRuleGroup> savedGroup = new AtomicReference<>();
        when(groupRepository.existsByUserIdAndNormalizedName(userId, "amazon payments")).thenReturn(false);
        when(groupRepository.save(any(AdditionalRuleGroup.class))).thenAnswer(invocation -> {
            AdditionalRuleGroup group = invocation.getArgument(0);
            if (group.getId() == null) {
                group.setId(UUID.randomUUID());
            }
            savedGroup.set(group);
            return group;
        });
        when(groupRepository.findByIdAndUserId(any(UUID.class), any(UUID.class)))
                .thenAnswer(invocation -> Optional.of(savedGroup.get()));

        AdditionalRuleGroupService.MutationResult result = service.create(
                "  Amazon Payments  ",
                List.of(new RuleCreateParams(
                        RuleType.REGEX,
                        TargetField.PARTNER_NAME,
                        "AMZN.*",
                        null,
                        null,
                        null,
                        null
                ))
        );

        AdditionalRuleGroup group = result.groupWithCount().group();
        assertThat(group.getName()).isEqualTo("Amazon Payments");
        assertThat(group.getNormalizedName()).isEqualTo("amazon payments");
        assertThat(group.getUser()).isSameAs(user);
        assertThat(group.getRules()).hasSize(1);
        assertThat(group.getRules().get(0).getAdditionalRuleGroup()).isSameAs(group);
        assertThat(group.getRules().get(0).getRecurringPayment()).isNull();
        assertThat(group.getRules().get(0).getStrict()).isTrue();
        assertThat(result.recalculationResult().transactionLinksRemoved()).isEqualTo(2);
        verify(ruleRepository).deleteByAdditionalRuleGroupId(group.getId());
        verify(groupRepository).flush();
        verify(recalculationService).recalculateCurrentUserRecurringPayments();
    }

    @Test
    void create_rejectsDuplicateNormalizedNameBeforeSaving() {
        when(groupRepository.existsByUserIdAndNormalizedName(userId, "amazon payments")).thenReturn(true);
        List<RuleCreateParams> rules = List.of(new RuleCreateParams(
                RuleType.REGEX,
                TargetField.PARTNER_NAME,
                "AMZN.*",
                true,
                null,
                null,
                null
        ));

        assertThatThrownBy(() -> service.create("Amazon   Payments", rules))
                .isInstanceOf(ConflictException.class)
                .hasMessage("An Additional rule group with this name already exists.");

        verify(groupRepository, never()).save(any());
        verify(recalculationService, never()).recalculateCurrentUserRecurringPayments();
    }

    @Test
    void update_nameOnlyChangeDoesNotReplaceRulesOrRecalculate() {
        UUID groupId = UUID.randomUUID();
        AdditionalRuleGroup group = new AdditionalRuleGroup();
        group.setId(groupId);
        group.setName("Utilities");
        group.setNormalizedName("utilities");
        group.setUser(user);
        Rule rule = new Rule();
        rule.setRuleType(RuleType.REGEX);
        rule.setTargetField(TargetField.PARTNER_NAME);
        rule.setText("POWER.*");
        rule.setStrict(true);
        rule.setAdditionalRuleGroup(group);
        group.getRules().add(rule);

        when(groupRepository.findByIdAndUserId(groupId, userId)).thenReturn(Optional.of(group));
        when(groupRepository.existsByUserIdAndNormalizedNameAndIdNot(userId, "house utilities", groupId)).thenReturn(false);
        when(groupRepository.save(any(AdditionalRuleGroup.class))).thenAnswer(invocation -> invocation.getArgument(0));

        AdditionalRuleGroupService.MutationResult result = service.update(
                groupId,
                " House Utilities ",
                List.of(new RuleCreateParams(
                        RuleType.REGEX,
                        TargetField.PARTNER_NAME,
                        "POWER.*",
                        true,
                        null,
                        null,
                        null
                ))
        );

        assertThat(result.groupWithCount().group().getName()).isEqualTo("House Utilities");
        assertThat(result.recalculationResult()).isNull();
        verify(ruleRepository, never()).deleteByAdditionalRuleGroupId(any());
        verify(groupRepository, never()).flush();
        verify(recalculationService, never()).recalculateCurrentUserRecurringPayments();
    }
}
