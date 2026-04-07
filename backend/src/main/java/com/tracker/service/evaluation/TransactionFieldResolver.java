package com.tracker.service.evaluation;

import com.tracker.model.entity.TargetField;
import com.tracker.model.entity.Transaction;

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
