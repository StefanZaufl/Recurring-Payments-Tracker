package com.tracker.service;

import com.tracker.model.entity.Transaction;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.*;
import java.math.BigDecimal;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;

@Service
public class CsvParserService {

    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("dd.MM.yyyy");

    private static final String COL_BOOKING_DATE = "Buchungsdatum";
    private static final String COL_PARTNER_NAME = "Partnername";
    private static final String COL_AMOUNT = "Betrag";
    private static final String COL_DETAILS = "Buchungs-Details";

    public List<Transaction> parse(MultipartFile file) throws IOException {
        byte[] bytes = file.getBytes();
        Charset charset = detectCharset(bytes);

        CSVFormat format = CSVFormat.Builder.create()
                .setDelimiter(';')
                .setHeader()
                .setSkipHeaderRecord(true)
                .setIgnoreEmptyLines(true)
                .setTrim(true)
                .build();

        try (Reader reader = new InputStreamReader(new ByteArrayInputStream(bytes), charset);
             CSVParser parser = new CSVParser(reader, format)) {

            validateHeaders(parser);

            List<Transaction> transactions = new ArrayList<>();
            for (CSVRecord record : parser) {
                Transaction tx = parseRecord(record);
                if (tx != null) {
                    transactions.add(tx);
                }
            }
            return transactions;
        }
    }

    private Charset detectCharset(byte[] bytes) {
        // Check for UTF-8 BOM
        if (bytes.length >= 3 && bytes[0] == (byte) 0xEF && bytes[1] == (byte) 0xBB && bytes[2] == (byte) 0xBF) {
            return StandardCharsets.UTF_8;
        }

        // Try to decode as UTF-8; if it fails, fall back to ISO-8859-1
        try {
            String decoded = new String(bytes, StandardCharsets.UTF_8);
            // Check for replacement characters which indicate invalid UTF-8
            if (decoded.contains("\uFFFD")) {
                return Charset.forName("ISO-8859-1");
            }
            // Verify by re-encoding
            byte[] reEncoded = decoded.getBytes(StandardCharsets.UTF_8);
            if (reEncoded.length == bytes.length) {
                return StandardCharsets.UTF_8;
            }
        } catch (Exception e) {
            // Fall through to ISO-8859-1
        }
        return Charset.forName("ISO-8859-1");
    }

    private void validateHeaders(CSVParser parser) {
        var headerMap = parser.getHeaderMap();
        if (!headerMap.containsKey(COL_BOOKING_DATE)) {
            throw new CsvParseException("Missing required column: " + COL_BOOKING_DATE);
        }
        if (!headerMap.containsKey(COL_AMOUNT)) {
            throw new CsvParseException("Missing required column: " + COL_AMOUNT);
        }
    }

    private Transaction parseRecord(CSVRecord record) {
        String dateStr = getField(record, COL_BOOKING_DATE);
        String amountStr = getField(record, COL_AMOUNT);

        if (dateStr == null || dateStr.isEmpty() || amountStr == null || amountStr.isEmpty()) {
            return null;
        }

        Transaction tx = new Transaction();
        tx.setBookingDate(parseDate(dateStr, record.getRecordNumber()));
        tx.setAmount(parseAmount(amountStr, record.getRecordNumber()));
        tx.setPartnerName(getField(record, COL_PARTNER_NAME));
        tx.setDetails(getField(record, COL_DETAILS));

        return tx;
    }

    private String getField(CSVRecord record, String column) {
        if (!record.isSet(column)) {
            return null;
        }
        String value = record.get(column);
        return (value == null || value.isBlank()) ? null : value.trim();
    }

    private LocalDate parseDate(String dateStr, long recordNumber) {
        try {
            return LocalDate.parse(dateStr, DATE_FORMAT);
        } catch (DateTimeParseException e) {
            throw new CsvParseException(
                    "Invalid date format at row " + recordNumber + ": '" + dateStr + "'. Expected DD.MM.YYYY");
        }
    }

    private BigDecimal parseAmount(String amountStr, long recordNumber) {
        try {
            // European format: thousands separator is '.', decimal separator is ','
            // e.g. "-1.234,56" -> "-1234.56"
            String normalized = amountStr
                    .replace(".", "")
                    .replace(",", ".");
            return new BigDecimal(normalized);
        } catch (NumberFormatException e) {
            throw new CsvParseException(
                    "Invalid amount format at row " + recordNumber + ": '" + amountStr + "'. Expected European format (e.g. -12,99)");
        }
    }

    public static class CsvParseException extends RuntimeException {
        public CsvParseException(String message) {
            super(message);
        }
    }
}
