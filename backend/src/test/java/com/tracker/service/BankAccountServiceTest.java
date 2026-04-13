package com.tracker.service;

import com.tracker.model.entity.BankAccount;
import com.tracker.model.entity.User;
import com.tracker.repository.BankAccountRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BankAccountServiceTest {

    @Mock
    private BankAccountRepository bankAccountRepository;

    @Mock
    private UserContextService userContextService;

    @Mock
    private RecurringPaymentRecalculationService recalculationService;

    private BankAccountService bankAccountService;
    private User user;

    @BeforeEach
    void setUp() {
        bankAccountService = new BankAccountService(bankAccountRepository, userContextService, recalculationService);
        user = new User();
        user.setId(UUID.randomUUID());
        lenient().when(userContextService.getCurrentUser()).thenReturn(user);
        lenient().when(userContextService.getCurrentUserId()).thenReturn(user.getId());
    }

    @Test
    void create_savesNewAccountWithNormalizedData() {
        when(bankAccountRepository.findByUserIdAndIban(user.getId(), "DE123456")).thenReturn(Optional.empty());
        when(bankAccountRepository.save(any(BankAccount.class))).thenAnswer(invocation -> invocation.getArgument(0));

        BankAccount result = bankAccountService.create("de12 3456", "  Checking  ");

        assertThat(result.getIban()).isEqualTo("DE123456");
        assertThat(result.getName()).isEqualTo("Checking");
        assertThat(result.getUser()).isSameAs(user);
    }

    @Test
    void create_updatesExistingNameWhenProvided() {
        BankAccount existing = account("DE123456", "Old Name");
        when(bankAccountRepository.findByUserIdAndIban(user.getId(), "DE123456")).thenReturn(Optional.of(existing));
        when(bankAccountRepository.save(existing)).thenReturn(existing);

        BankAccount result = bankAccountService.create("DE123456", "New Name");

        assertThat(result.getName()).isEqualTo("New Name");
        verify(bankAccountRepository).save(existing);
    }

    @Test
    void create_returnsExistingAccountWithoutSavingWhenNameBlank() {
        BankAccount existing = account("DE123456", "Existing");
        when(bankAccountRepository.findByUserIdAndIban(user.getId(), "DE123456")).thenReturn(Optional.of(existing));

        BankAccount result = bankAccountService.create("DE123456", "   ");

        assertThat(result).isSameAs(existing);
        verify(bankAccountRepository, never()).save(any(BankAccount.class));
    }

    @Test
    void createWithRecalculation_returnsBothAccountAndSummary() {
        RecurringPaymentRecalculationService.RecalculationResult summary =
                new RecurringPaymentRecalculationService.RecalculationResult(1, 2, 3, 4);
        when(bankAccountRepository.findByUserIdAndIban(user.getId(), "DE123456")).thenReturn(Optional.empty());
        when(bankAccountRepository.save(any(BankAccount.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(recalculationService.recalculateCurrentUserRecurringPayments()).thenReturn(summary);

        BankAccountService.BankAccountMutationResult result = bankAccountService.createWithRecalculation("DE123456", "Main");

        assertThat(result.bankAccount().getIban()).isEqualTo("DE123456");
        assertThat(result.recalculationResult()).isEqualTo(summary);
    }

    @Test
    void createMissingForCurrentUser_returnsZeroWhenNoValidIbans() {
        int created = bankAccountService.createMissingForCurrentUser(Set.of("", "   "));

        assertThat(created).isZero();
        verify(bankAccountRepository, never()).findByUserIdAndIbanIn(eq(user.getId()), any());
    }

    @Test
    void createMissingForCurrentUser_createsOnlyUnknownAccounts() {
        when(bankAccountRepository.findByUserIdAndIbanIn(user.getId(), Set.of("DE111", "DE222"))).thenReturn(List.of(account("DE111", "Known")));
        when(bankAccountRepository.save(any(BankAccount.class))).thenAnswer(invocation -> invocation.getArgument(0));

        int created = bankAccountService.createMissingForCurrentUser(Set.of("de111", "de222"));

        assertThat(created).isEqualTo(1);
        verify(bankAccountRepository).save(any(BankAccount.class));
    }

    @Test
    void update_returnsUpdatedAccountWhenNameFlagSet() {
        UUID id = UUID.randomUUID();
        BankAccount existing = account("DE123456", "Old");
        existing.setId(id);
        when(bankAccountRepository.findByIdAndUserId(id, user.getId())).thenReturn(Optional.of(existing));
        when(bankAccountRepository.save(existing)).thenReturn(existing);

        Optional<BankAccount> result = bankAccountService.update(id, "  New  ", true);

        assertThat(result).isPresent();
        assertThat(result.get().getName()).isEqualTo("New");
    }

    @Test
    void update_preservesNameWhenFlagFalse() {
        UUID id = UUID.randomUUID();
        BankAccount existing = account("DE123456", "Old");
        existing.setId(id);
        when(bankAccountRepository.findByIdAndUserId(id, user.getId())).thenReturn(Optional.of(existing));
        when(bankAccountRepository.save(existing)).thenReturn(existing);

        Optional<BankAccount> result = bankAccountService.update(id, "Ignored", false);

        assertThat(result).isPresent();
        assertThat(result.get().getName()).isEqualTo("Old");
    }

    @Test
    void update_returnsEmptyForUnknownAccount() {
        UUID id = UUID.randomUUID();
        when(bankAccountRepository.findByIdAndUserId(id, user.getId())).thenReturn(Optional.empty());

        assertThat(bankAccountService.update(id, "Name", true)).isEmpty();
        verify(bankAccountRepository, never()).save(any(BankAccount.class));
    }

    @Test
    void deleteAndDeleteWithRecalculation_coverFoundAndMissingCases() {
        UUID id = UUID.randomUUID();
        BankAccount existing = account("DE123456", "Main");
        existing.setId(id);
        RecurringPaymentRecalculationService.RecalculationResult summary =
                new RecurringPaymentRecalculationService.RecalculationResult(0, 1, 1, 0);
        when(bankAccountRepository.findByIdAndUserId(id, user.getId())).thenReturn(Optional.of(existing));
        when(recalculationService.recalculateCurrentUserRecurringPayments()).thenReturn(summary);

        assertThat(bankAccountService.delete(id)).isTrue();
        assertThat(bankAccountService.deleteWithRecalculation(id)).contains(summary);

        UUID missingId = UUID.randomUUID();
        when(bankAccountRepository.findByIdAndUserId(missingId, user.getId())).thenReturn(Optional.empty());
        assertThat(bankAccountService.delete(missingId)).isFalse();
        assertThat(bankAccountService.deleteWithRecalculation(missingId)).isEmpty();
    }

    @Test
    void getCurrentUserIbansAndLookupByIban_useNormalizedValues() {
        when(bankAccountRepository.findByUserIdOrderByNameAscIbanAsc(user.getId())).thenReturn(List.of(
                account("DE111", "Main"),
                account("DE222", "Savings")
        ));
        BankAccount target = account("DE222", "Savings");
        when(bankAccountRepository.findByUserIdAndIban(user.getId(), "DE222")).thenReturn(Optional.of(target));

        assertThat(bankAccountService.getCurrentUserIbans()).containsExactlyInAnyOrder("DE111", "DE222");
        assertThat(bankAccountService.getCurrentUserAccountByIban("de 222")).contains(target);
        assertThat(bankAccountService.getCurrentUserAccountByIban("   ")).isEmpty();
    }

    @Test
    void create_rejectsMissingIban() {
        assertThatThrownBy(() -> bankAccountService.create("   ", "Name"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("iban is required");
    }

    private BankAccount account(String iban, String name) {
        BankAccount account = new BankAccount();
        account.setUser(user);
        account.setIban(iban);
        account.setName(name);
        return account;
    }
}
