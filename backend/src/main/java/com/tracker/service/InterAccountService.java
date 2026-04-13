package com.tracker.service;

import com.tracker.model.entity.Transaction;
import com.tracker.repository.BankAccountRepository;
import com.tracker.repository.TransactionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class InterAccountService {

    private final BankAccountRepository bankAccountRepository;
    private final TransactionRepository transactionRepository;
    private final UserContextService userContextService;

    public InterAccountService(BankAccountRepository bankAccountRepository,
                               TransactionRepository transactionRepository,
                               UserContextService userContextService) {
        this.bankAccountRepository = bankAccountRepository;
        this.transactionRepository = transactionRepository;
        this.userContextService = userContextService;
    }

    @Transactional
    public void markInterAccountTransactions(List<Transaction> transactions) {
        if (transactions.isEmpty()) {
            return;
        }

        Set<String> ownedIbans = getCurrentUserIbans();
        for (Transaction transaction : transactions) {
            boolean isInterAccount = transaction.getPartnerIban() != null && ownedIbans.contains(transaction.getPartnerIban());
            transaction.setIsInterAccount(isInterAccount);
        }
        transactionRepository.saveAll(transactions);
    }

    @Transactional
    public int remarkCurrentUserTransactions() {
        List<Transaction> transactions = transactionRepository.findByUserId(userContextService.getCurrentUserId());
        if (transactions.isEmpty()) {
            return 0;
        }

        Set<String> ownedIbans = getCurrentUserIbans();
        int newlyMarkedCount = 0;
        for (Transaction transaction : transactions) {
            boolean isInterAccount = transaction.getPartnerIban() != null && ownedIbans.contains(transaction.getPartnerIban());
            boolean wasInterAccount = Boolean.TRUE.equals(transaction.getIsInterAccount());
            if (!wasInterAccount && isInterAccount) {
                newlyMarkedCount += 1;
            }
            transaction.setIsInterAccount(isInterAccount);
        }
        transactionRepository.saveAll(transactions);
        return newlyMarkedCount;
    }

    private Set<String> getCurrentUserIbans() {
        return bankAccountRepository.findByUserIdOrderByNameAscIbanAsc(userContextService.getCurrentUserId()).stream()
                .map(bankAccount -> bankAccount.getIban())
                .collect(Collectors.toSet());
    }
}
