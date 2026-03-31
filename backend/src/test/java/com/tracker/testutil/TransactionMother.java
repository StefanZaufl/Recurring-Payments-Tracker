package com.tracker.testutil;

import com.tracker.model.entity.FileUpload;
import com.tracker.model.entity.Transaction;

import java.math.BigDecimal;
import java.time.LocalDate;

public final class TransactionMother {

    public static final String NETFLIX = "Netflix";
    public static final String SPOTIFY = "Spotify";
    public static final String EMPLOYER = "Arbeitgeber GmbH";
    public static final String MUELLER_BAKERY = "Müller Bäckerei";

    public static final LocalDate JAN_15 = LocalDate.of(2025, 1, 15);
    public static final LocalDate FEB_01 = LocalDate.of(2025, 2, 1);
    public static final LocalDate MAR_15 = LocalDate.of(2025, 3, 15);
    public static final LocalDate MAR_20 = LocalDate.of(2025, 3, 20);

    public static final BigDecimal NETFLIX_AMOUNT = new BigDecimal("-12.99");
    public static final BigDecimal SPOTIFY_AMOUNT = new BigDecimal("-9.99");
    public static final BigDecimal SALARY_AMOUNT = new BigDecimal("3500.00");

    private TransactionMother() {}

    public static Transaction netflix() {
        return transaction(NETFLIX, JAN_15, NETFLIX_AMOUNT);
    }

    public static Transaction spotify() {
        return transaction(SPOTIFY, FEB_01, SPOTIFY_AMOUNT);
    }

    public static Transaction salary() {
        return transaction(EMPLOYER, FEB_01, SALARY_AMOUNT);
    }

    public static Transaction transaction(String partnerName, LocalDate date, BigDecimal amount) {
        Transaction tx = new Transaction();
        tx.setBookingDate(date);
        tx.setPartnerName(partnerName);
        tx.setAmount(amount);
        return tx;
    }

    public static Transaction withUpload(Transaction tx, FileUpload upload) {
        tx.setUpload(upload);
        return tx;
    }
}
