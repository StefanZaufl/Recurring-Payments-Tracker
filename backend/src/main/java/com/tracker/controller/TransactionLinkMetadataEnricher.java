package com.tracker.controller;

import com.tracker.api.model.TransactionDto;
import com.tracker.model.entity.Transaction;
import com.tracker.repository.TransactionRecurringLinkRepository;
import com.tracker.service.UserContextService;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Component
public class TransactionLinkMetadataEnricher {

    private final TransactionRecurringLinkRepository linkRepository;
    private final UserContextService userContextService;

    public TransactionLinkMetadataEnricher(TransactionRecurringLinkRepository linkRepository,
                                           UserContextService userContextService) {
        this.linkRepository = linkRepository;
        this.userContextService = userContextService;
    }

    public void enrich(List<Transaction> transactions, List<TransactionDto> dtos) {
        for (TransactionDto dto : dtos) {
            dto.setLinkedPaymentCount(0);
            dto.setLinkedPaymentNames(List.of());
        }

        List<UUID> transactionIds = transactions.stream()
                .map(Transaction::getId)
                .filter(java.util.Objects::nonNull)
                .distinct()
                .toList();
        if (transactionIds.isEmpty()) {
            return;
        }

        Map<UUID, List<String>> namesByTransactionId = new HashMap<>();
        linkRepository.findWithRecurringPaymentByTransactionIdInAndUserId(
                        transactionIds, userContextService.getCurrentUserId())
                .forEach(link -> namesByTransactionId
                        .computeIfAbsent(link.getTransaction().getId(), ignored -> new ArrayList<>())
                        .add(link.getRecurringPayment().getName()));

        for (int i = 0; i < transactions.size(); i++) {
            UUID transactionId = transactions.get(i).getId();
            List<String> names = namesByTransactionId.getOrDefault(transactionId, List.of()).stream()
                    .sorted()
                    .toList();
            dtos.get(i).setLinkedPaymentCount(names.size());
            dtos.get(i).setLinkedPaymentNames(names);
        }
    }
}
