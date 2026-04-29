package com.tracker.repository;

import java.time.LocalDate;
import java.util.UUID;

public record TransactionFilter(
        UUID userId,
        LocalDate from,
        LocalDate to,
        String text,
        String account,
        TransactionTypeFilter transactionType,
        TransactionSignFilter transactionSign
) {
}
