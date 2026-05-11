package com.tracker.transactions.persistence;

public enum TransactionSignFilter {
    ALL,
    POSITIVE,
    NEGATIVE;

    public static TransactionSignFilter fromQueryParam(String value) {
        if (value == null || value.isBlank()) {
            return ALL;
        }
        return TransactionSignFilter.valueOf(value);
    }
}
