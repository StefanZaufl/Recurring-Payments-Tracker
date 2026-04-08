package com.tracker.service;

import com.tracker.controller.ResourceNotFoundException;
import com.tracker.model.entity.BankAccount;
import com.tracker.model.entity.User;
import com.tracker.repository.BankAccountRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class BankAccountService {

    private final BankAccountRepository bankAccountRepository;
    private final UserContextService userContextService;

    public BankAccountService(BankAccountRepository bankAccountRepository, UserContextService userContextService) {
        this.bankAccountRepository = bankAccountRepository;
        this.userContextService = userContextService;
    }

    @Transactional(readOnly = true)
    public List<BankAccount> getAllAccounts() {
        return bankAccountRepository.findByUserIdOrderByNameAscIbanAsc(userContextService.getCurrentUserId());
    }

    @Transactional
    public BankAccount create(String iban, String name) {
        User currentUser = userContextService.getCurrentUser();
        String normalizedIban = requireNormalizedIban(iban);

        return bankAccountRepository.findByUserIdAndIban(currentUser.getId(), normalizedIban)
                .map(existing -> updateNameIfProvided(existing, name))
                .orElseGet(() -> {
                    BankAccount account = new BankAccount();
                    account.setUser(currentUser);
                    account.setIban(normalizedIban);
                    account.setName(normalizeName(name));
                    return bankAccountRepository.save(account);
                });
    }

    @Transactional
    public void createMissingForCurrentUser(Set<String> ibans) {
        Set<String> normalizedIbans = ibans.stream()
                .map(IbanNormalizationService::normalize)
                .filter(value -> value != null && !value.isBlank())
                .collect(Collectors.toSet());
        if (normalizedIbans.isEmpty()) {
            return;
        }

        UUID userId = userContextService.getCurrentUserId();
        Set<String> existing = bankAccountRepository.findByUserIdAndIbanIn(userId, normalizedIbans).stream()
                .map(BankAccount::getIban)
                .collect(Collectors.toSet());

        User currentUser = userContextService.getCurrentUser();
        for (String iban : normalizedIbans) {
            if (existing.contains(iban)) {
                continue;
            }
            BankAccount account = new BankAccount();
            account.setUser(currentUser);
            account.setIban(iban);
            bankAccountRepository.save(account);
        }
    }

    @Transactional
    public Optional<BankAccount> update(UUID id, String name, boolean updateName) {
        return bankAccountRepository.findByIdAndUserId(id, userContextService.getCurrentUserId())
                .map(account -> {
                    if (updateName) {
                        account.setName(normalizeName(name));
                        account.setUpdatedAt(LocalDateTime.now());
                    }
                    return bankAccountRepository.save(account);
                });
    }

    @Transactional
    public boolean delete(UUID id) {
        return bankAccountRepository.findByIdAndUserId(id, userContextService.getCurrentUserId())
                .map(account -> {
                    bankAccountRepository.delete(account);
                    return true;
                })
                .orElse(false);
    }

    @Transactional(readOnly = true)
    public Set<String> getCurrentUserIbans() {
        return getAllAccounts().stream()
                .map(BankAccount::getIban)
                .collect(Collectors.toSet());
    }

    @Transactional(readOnly = true)
    public Optional<BankAccount> getCurrentUserAccountByIban(String iban) {
        String normalizedIban = IbanNormalizationService.normalize(iban);
        if (normalizedIban == null) {
            return Optional.empty();
        }
        return bankAccountRepository.findByUserIdAndIban(userContextService.getCurrentUserId(), normalizedIban);
    }

    private String requireNormalizedIban(String iban) {
        String normalized = IbanNormalizationService.normalize(iban);
        if (normalized == null) {
            throw new IllegalArgumentException("iban is required");
        }
        return normalized;
    }

    private BankAccount updateNameIfProvided(BankAccount account, String name) {
        String normalizedName = normalizeName(name);
        if (normalizedName != null && !normalizedName.equals(account.getName())) {
            account.setName(normalizedName);
            account.setUpdatedAt(LocalDateTime.now());
            return bankAccountRepository.save(account);
        }
        return account;
    }

    private String normalizeName(String name) {
        if (name == null) {
            return null;
        }
        String trimmed = name.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
