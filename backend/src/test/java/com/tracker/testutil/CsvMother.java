package com.tracker.testutil;

import org.springframework.mock.web.MockMultipartFile;

import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;

public final class CsvMother {

    public static final String HEADER = "Buchungsdatum;Partnername;Betrag;Buchungs-Details";
    public static final String NETFLIX_ROW = "15.01.2025;Netflix;-12,99;Monatliches Abo";
    public static final String SALARY_ROW = "01.02.2025;Arbeitgeber GmbH;3.500,00;Gehalt Februar";
    public static final String MUELLER_ROW = "20.03.2025;Müller Bäckerei;-4,50;Frühstück";
    public static final String MISSING_DATE_ROW = ";Netflix;-12,99;Abo";
    public static final String MISSING_AMOUNT_ROW = "15.01.2025;Spotify;;Abo";
    public static final String INVALID_DATE_ROW = "2025-01-15;Netflix;-12,99;Abo";
    public static final String INVALID_AMOUNT_ROW = "15.01.2025;Netflix;abc;Abo";
    public static final String INVALID_HEADER = "Datum;Name;Wert";

    private CsvMother() {}

    public static byte[] bytes(String... lines) {
        return bytes(StandardCharsets.UTF_8, lines);
    }

    public static byte[] bytes(Charset charset, String... lines) {
        String csv = String.join("\n", lines) + "\n";
        return csv.getBytes(charset);
    }

    public static MockMultipartFile multipartFile(String... lines) {
        return multipartFile(StandardCharsets.UTF_8, lines);
    }

    public static MockMultipartFile multipartFile(Charset charset, String... lines) {
        return new MockMultipartFile("file", "export.csv", "text/csv", bytes(charset, lines));
    }

    public static byte[] validTwoRowBytes() {
        return bytes(HEADER, NETFLIX_ROW, SALARY_ROW);
    }

    public static MockMultipartFile validTwoRowFile() {
        return multipartFile(HEADER, NETFLIX_ROW, SALARY_ROW);
    }
}
