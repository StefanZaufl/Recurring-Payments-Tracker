package com.tracker.repository;

public enum TransactionTypeFilter {
    ALL,
    NON_INTER_ACCOUNT,
    REGULAR,
    ADDITIONAL;

    public static TransactionTypeFilter fromQueryParam(String value) {
        if (value == null || value.isBlank()) {
            return ALL;
        }
        return TransactionTypeFilter.valueOf(value);
    }
}
