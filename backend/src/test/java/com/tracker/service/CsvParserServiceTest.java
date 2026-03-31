package com.tracker.service;

import com.tracker.model.entity.Transaction;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class CsvParserServiceTest {

    private CsvParserService parser;

    @BeforeEach
    void setUp() {
        parser = new CsvParserService();
    }

    @Test
    void parsesValidGermanBankCsv() throws IOException {
        String csv = "Buchungsdatum;Partnername;Betrag;Buchungs-Details\n" +
                "15.01.2025;Netflix;-12,99;Monatliches Abo\n" +
                "01.02.2025;Arbeitgeber GmbH;3.500,00;Gehalt Februar\n";

        MockMultipartFile file = new MockMultipartFile("file", "export.csv", "text/csv",
                csv.getBytes(StandardCharsets.UTF_8));

        List<Transaction> result = parser.parse(file);

        assertEquals(2, result.size());

        Transaction netflix = result.get(0);
        assertEquals(LocalDate.of(2025, 1, 15), netflix.getBookingDate());
        assertEquals("Netflix", netflix.getPartnerName());
        assertEquals(new BigDecimal("-12.99"), netflix.getAmount());
        assertEquals("Monatliches Abo", netflix.getDetails());

        Transaction salary = result.get(1);
        assertEquals(LocalDate.of(2025, 2, 1), salary.getBookingDate());
        assertEquals("Arbeitgeber GmbH", salary.getPartnerName());
        assertEquals(new BigDecimal("3500.00"), salary.getAmount());
        assertEquals("Gehalt Februar", salary.getDetails());
    }

    @Test
    void handlesIso88591Encoding() throws IOException {
        String csv = "Buchungsdatum;Partnername;Betrag;Buchungs-Details\n" +
                "20.03.2025;M\u00fcller B\u00e4ckerei;-4,50;Fr\u00fchst\u00fcck\n";

        MockMultipartFile file = new MockMultipartFile("file", "export.csv", "text/csv",
                csv.getBytes(Charset.forName("ISO-8859-1")));

        List<Transaction> result = parser.parse(file);

        assertEquals(1, result.size());
        assertEquals("Müller Bäckerei", result.get(0).getPartnerName());
    }

    @Test
    void skipsRowsWithMissingBookingDateOrAmount() throws IOException {
        String csv = "Buchungsdatum;Partnername;Betrag;Buchungs-Details\n" +
                ";Netflix;-12,99;Abo\n" +
                "15.01.2025;Spotify;;Abo\n" +
                "15.01.2025;Valid;-9,99;OK\n";

        MockMultipartFile file = new MockMultipartFile("file", "export.csv", "text/csv",
                csv.getBytes(StandardCharsets.UTF_8));

        List<Transaction> result = parser.parse(file);
        assertEquals(1, result.size());
        assertEquals("Valid", result.get(0).getPartnerName());
    }

    @Test
    void throwsOnMissingRequiredColumns() {
        String csv = "Datum;Name;Wert\n01.01.2025;Test;-10,00\n";

        MockMultipartFile file = new MockMultipartFile("file", "export.csv", "text/csv",
                csv.getBytes(StandardCharsets.UTF_8));

        assertThrows(CsvParserService.CsvParseException.class, () -> parser.parse(file));
    }

    @Test
    void throwsOnInvalidDateFormat() {
        String csv = "Buchungsdatum;Partnername;Betrag;Buchungs-Details\n" +
                "2025-01-15;Netflix;-12,99;Abo\n";

        MockMultipartFile file = new MockMultipartFile("file", "export.csv", "text/csv",
                csv.getBytes(StandardCharsets.UTF_8));

        assertThrows(CsvParserService.CsvParseException.class, () -> parser.parse(file));
    }

    @Test
    void throwsOnInvalidAmountFormat() {
        String csv = "Buchungsdatum;Partnername;Betrag;Buchungs-Details\n" +
                "15.01.2025;Netflix;abc;Abo\n";

        MockMultipartFile file = new MockMultipartFile("file", "export.csv", "text/csv",
                csv.getBytes(StandardCharsets.UTF_8));

        assertThrows(CsvParserService.CsvParseException.class, () -> parser.parse(file));
    }

    @Test
    void handlesNegativeAndPositiveAmounts() throws IOException {
        String csv = "Buchungsdatum;Partnername;Betrag;Buchungs-Details\n" +
                "15.01.2025;Expense;-99,99;Payment\n" +
                "15.01.2025;Income;1.234,56;Salary\n";

        MockMultipartFile file = new MockMultipartFile("file", "export.csv", "text/csv",
                csv.getBytes(StandardCharsets.UTF_8));

        List<Transaction> result = parser.parse(file);
        assertEquals(new BigDecimal("-99.99"), result.get(0).getAmount());
        assertEquals(new BigDecimal("1234.56"), result.get(1).getAmount());
    }

    @Test
    void handlesOptionalColumnsGracefully() throws IOException {
        String csv = "Buchungsdatum;Betrag\n" +
                "15.01.2025;-12,99\n";

        MockMultipartFile file = new MockMultipartFile("file", "export.csv", "text/csv",
                csv.getBytes(StandardCharsets.UTF_8));

        List<Transaction> result = parser.parse(file);
        assertEquals(1, result.size());
        assertNull(result.get(0).getPartnerName());
        assertNull(result.get(0).getDetails());
    }
}
