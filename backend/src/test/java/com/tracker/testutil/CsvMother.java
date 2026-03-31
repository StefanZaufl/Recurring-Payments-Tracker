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

    public static MockMultipartFile file(String... lines) {
        return file(StandardCharsets.UTF_8, lines);
    }

    public static MockMultipartFile file(Charset charset, String... lines) {
        String csv = String.join("\n", lines) + "\n";
        return new MockMultipartFile("file", "export.csv", "text/csv", csv.getBytes(charset));
    }

    public static MockMultipartFile validTwoRowFile() {
        return file(HEADER, NETFLIX_ROW, SALARY_ROW);
    }
}
