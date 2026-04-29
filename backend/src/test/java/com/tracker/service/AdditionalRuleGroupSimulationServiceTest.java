package com.tracker.service;

import com.tracker.model.entity.Rule;
import com.tracker.model.entity.Transaction;
import com.tracker.repository.TransactionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdditionalRuleGroupSimulationServiceTest {

    @Mock
    private TransactionRepository transactionRepository;
    @Mock
    private RuleEvaluationService ruleEvaluationService;
    @Mock
    private UserContextService userContextService;
    @Mock
    private AdditionalMatchingService additionalMatchingService;

    private AdditionalRuleGroupSimulationService service;
    private UUID userId;

    @BeforeEach
    void setUp() {
        service = new AdditionalRuleGroupSimulationService(
                transactionRepository,
                ruleEvaluationService,
                userContextService,
                additionalMatchingService
        );
        userId = UUID.randomUUID();
        when(userContextService.getCurrentUserId()).thenReturn(userId);
        when(additionalMatchingService.sortNewestFirst(org.mockito.ArgumentMatchers.<Collection<Transaction>>any()))
                .thenAnswer(invocation -> {
                    Collection<Transaction> transactions = invocation.getArgument(0);
                    return transactions.stream().toList();
                });
    }

    @Test
    void simulate_countsMatchesThatAreUniqueAcrossOtherAdditionalGroups() {
        UUID currentGroupId = UUID.randomUUID();
        Rule rule = new Rule();
        Transaction amazon = transaction("Amazon");
        Transaction spotify = transaction("Spotify");
        var otherMatches = Map.of(spotify.getId(), List.of(
                new AdditionalMatchingService.AdditionalGroupReference(UUID.randomUUID(), "Existing group")));
        var otherMatchDtos = List.of(new AdditionalMatchingService.TransactionGroupMatch(
                spotify.getId(), spotify, otherMatches.get(spotify.getId())));

        when(transactionRepository.findByUserIdAndBookingDateGreaterThanEqualAndIsInterAccountFalse(
                org.mockito.ArgumentMatchers.eq(userId), any()))
                .thenReturn(List.of(amazon, spotify));
        when(ruleEvaluationService.findMatchingTransactions(List.of(rule), List.of(amazon, spotify)))
                .thenReturn(List.of(amazon, spotify));
        when(additionalMatchingService.matchGroups(List.of(amazon, spotify), currentGroupId)).thenReturn(otherMatches);
        when(additionalMatchingService.toTransactionGroupMatches(otherMatches, List.of(amazon, spotify))).thenReturn(otherMatchDtos);

        AdditionalRuleGroupSimulationService.SimulationResult result = service.simulate(List.of(rule), currentGroupId);

        assertThat(result.matchingTransactions()).containsExactly(amazon, spotify);
        assertThat(result.totalMatchCount()).isEqualTo(2);
        assertThat(result.uniqueExclusionCount()).isEqualTo(1);
        assertThat(result.otherAdditionalGroupMatches()).isEqualTo(otherMatchDtos);
    }

    private Transaction transaction(String partnerName) {
        Transaction transaction = new Transaction();
        transaction.setId(UUID.randomUUID());
        transaction.setPartnerName(partnerName);
        transaction.setBookingDate(LocalDate.now());
        return transaction;
    }
}
