package com.tracker.service;

import com.tracker.model.entity.Transaction;
import com.tracker.testutil.CsvMother;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.nio.charset.Charset;
import java.util.List;

import static com.tracker.testutil.CsvMother.*;
import static com.tracker.testutil.TransactionMother.*;
import static org.junit.jupiter.api.Assertions.*;

class CsvParserServiceTest {

    private static final BigDecimal EXPENSE_AMOUNT = new BigDecimal("-99.99");
    private static final BigDecimal LARGE_INCOME_AMOUNT = new BigDecimal("1234.56");
    private static final String EXPENSE_ROW = "15.01.2025;Expense;-99,99;Payment";
    private static final String INCOME_ROW = "15.01.2025;Income;1.234,56;Salary";
    private static final String VALID_PARTNER = "Valid";
    private static final String VALID_ROW = "15.01.2025;Valid;-9,99;OK";

    private CsvParserService parser;

    @BeforeEach
    void setUp() {
        parser = new CsvParserService();
    }

    @Test
    void parsesValidGermanBankCsv() {
        List<Transaction> result = parser.parse(CsvMother.validTwoRowBytes());

        assertEquals(2, result.size());

        Transaction netflix = result.get(0);
        assertEquals(JAN_15, netflix.getBookingDate());
        assertEquals(NETFLIX, netflix.getPartnerName());
        assertEquals(NETFLIX_AMOUNT, netflix.getAmount());
        assertEquals("Monatliches Abo", netflix.getDetails());

        Transaction salary = result.get(1);
        assertEquals(FEB_01, salary.getBookingDate());
        assertEquals(EMPLOYER, salary.getPartnerName());
        assertEquals(SALARY_AMOUNT, salary.getAmount());
        assertEquals("Gehalt Februar", salary.getDetails());
    }

    @Test
    void handlesIso88591Encoding() {
        List<Transaction> result = parser.parse(CsvMother.bytes(Charset.forName("ISO-8859-1"), HEADER, MUELLER_ROW));

        assertEquals(1, result.size());
        assertEquals(MUELLER_BAKERY, result.get(0).getPartnerName());
    }

    @Test
    void skipsRowsWithMissingBookingDateOrAmount() {
        List<Transaction> result = parser.parse(CsvMother.bytes(HEADER, MISSING_DATE_ROW, MISSING_AMOUNT_ROW, VALID_ROW));

        assertEquals(1, result.size());
        assertEquals(VALID_PARTNER, result.get(0).getPartnerName());
    }

    @Test
    void throwsOnMissingRequiredColumns() {
        byte[] csv = CsvMother.bytes(INVALID_HEADER, "01.01.2025;Test;-10,00");

        assertThrows(CsvParserService.CsvParseException.class, () -> parser.parse(csv));
    }

    @Test
    void throwsOnInvalidDateFormat() {
        byte[] csv = CsvMother.bytes(HEADER, INVALID_DATE_ROW);

        assertThrows(CsvParserService.CsvParseException.class, () -> parser.parse(csv));
    }

    @Test
    void throwsOnInvalidAmountFormat() {
        byte[] csv = CsvMother.bytes(HEADER, INVALID_AMOUNT_ROW);

        assertThrows(CsvParserService.CsvParseException.class, () -> parser.parse(csv));
    }

    @Test
    void handlesNegativeAndPositiveAmounts() {
        List<Transaction> result = parser.parse(CsvMother.bytes(HEADER, EXPENSE_ROW, INCOME_ROW));

        assertEquals(EXPENSE_AMOUNT, result.get(0).getAmount());
        assertEquals(LARGE_INCOME_AMOUNT, result.get(1).getAmount());
    }

    @Test
    void handlesOptionalColumnsGracefully() {
        List<Transaction> result = parser.parse(CsvMother.bytes("Buchungsdatum;Betrag", "15.01.2025;-12,99"));

        assertEquals(1, result.size());
        assertNull(result.get(0).getPartnerName());
        assertNull(result.get(0).getDetails());
    }
}
