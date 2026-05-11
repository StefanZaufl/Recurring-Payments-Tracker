package com.tracker.rules.application.evaluation;

import com.tracker.rules.domain.TargetField;
import com.tracker.transactions.domain.Transaction;

public final class TransactionFieldResolver {

    private TransactionFieldResolver() {}

    public static String resolve(TargetField field, Transaction transaction) {
        return switch (field) {
            case ACCOUNT -> transaction.getAccount();
            case PARTNER_NAME -> transaction.getPartnerName();
            case PARTNER_IBAN -> transaction.getPartnerIban();
            case DETAILS -> transaction.getDetails();
        };
    }
}
