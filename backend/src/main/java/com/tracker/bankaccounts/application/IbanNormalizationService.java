package com.tracker.bankaccounts.application;

public final class IbanNormalizationService {

    private IbanNormalizationService() {}

    public static String normalize(String iban) {
        if (iban == null) {
            return null;
        }
        String normalized = iban.replace(" ", "").trim().toUpperCase();
        return normalized.isEmpty() ? null : normalized;
    }
}
