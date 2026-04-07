package com.tracker.service;

import com.tracker.model.entity.Transaction;
import com.tracker.repository.TransactionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;

@Service
public class InterAccountService {

    private final BankAccountService bankAccountService;
    private final TransactionRepository transactionRepository;

    public InterAccountService(BankAccountService bankAccountService, TransactionRepository transactionRepository) {
        this.bankAccountService = bankAccountService;
        this.transactionRepository = transactionRepository;
    }

    @Transactional
    public void markInterAccountTransactions(List<Transaction> transactions) {
        if (transactions.isEmpty()) {
            return;
        }

        Set<String> ownedIbans = bankAccountService.getCurrentUserIbans();
        for (Transaction transaction : transactions) {
            boolean isInterAccount = transaction.getPartnerIban() != null && ownedIbans.contains(transaction.getPartnerIban());
            transaction.setIsInterAccount(isInterAccount);
        }
        transactionRepository.saveAll(transactions);
    }
}
