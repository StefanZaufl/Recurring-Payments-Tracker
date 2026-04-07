package com.tracker.service;

import com.tracker.model.entity.Transaction;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.*;
import java.math.BigDecimal;
import java.nio.charset.Charset;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class CsvParserService {

    private static final Logger log = LoggerFactory.getLogger(CsvParserService.class);
    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("dd.MM.yyyy");
    private static final Set<String> REQUIRED_COLUMNS = Set.of("bookingDate", "amount");

    public List<Transaction> parse(byte[] bytes, CsvImportMapping mapping, String charsetName) {
        Charset charset = resolveCharset(charsetName);

        CSVFormat format = CSVFormat.Builder.create()
                .setDelimiter(';')
                .setHeader()
                .setSkipHeaderRecord(true)
                .setIgnoreEmptyLines(true)
                .setTrim(true)
                .build();

        try (Reader reader = createReader(bytes, charset);
             CSVParser parser = new CSVParser(reader, format)) {

            validateHeaders(parser, mapping);

            List<Transaction> transactions = new ArrayList<>();
            for (CSVRecord record : parser) {
                Transaction tx = parseRecord(record, mapping);
                if (tx != null) {
                    transactions.add(tx);
                }
            }
            return transactions;
        } catch (IOException e) {
            throw new CsvParseException("Failed to read CSV data: " + e.getMessage(), e);
        }
    }

    private Charset resolveCharset(String charsetName) {
        if (charsetName == null || charsetName.isBlank()) {
            throw new CsvParseException("CSV charset is required");
        }

        try {
            return Charset.forName(charsetName);
        } catch (Exception e) {
            throw new CsvParseException("Unsupported CSV charset: " + charsetName, e);
        }
    }

    private Reader createReader(byte[] bytes, Charset charset) throws IOException {
        PushbackReader reader = new PushbackReader(new InputStreamReader(new ByteArrayInputStream(bytes), charset), 1);
        int firstChar = reader.read();
        if (firstChar != 0xFEFF && firstChar != -1) {
            reader.unread(firstChar);
        }
        return reader;
    }

    private void validateHeaders(CSVParser parser, CsvImportMapping mapping) {
        if (mapping == null) {
            throw new CsvParseException("CSV column mapping is required");
        }
        Map<String, String> requiredMapping = Map.of(
                "bookingDate", mapping.bookingDate(),
                "amount", mapping.amount()
        );
        for (String field : REQUIRED_COLUMNS) {
            String header = requiredMapping.get(field);
            if (header == null || header.isBlank()) {
                throw new CsvParseException("Missing required mapping: " + field);
            }
        }

        var headerMap = parser.getHeaderMap();
        for (String header : mapping.mappedHeaders()) {
            if (header != null && !header.isBlank() && !headerMap.containsKey(header)) {
                throw new CsvParseException("Mapped column not found in CSV header: " + header);
            }
        }
    }

    private Transaction parseRecord(CSVRecord record, CsvImportMapping mapping) {
        String dateStr = getField(record, mapping.bookingDate());
        String amountStr = getField(record, mapping.amount());

        if (dateStr == null || dateStr.isEmpty() || amountStr == null || amountStr.isEmpty()) {
            log.warn("Skipping row {}: missing required field (bookingDate or amount)", record.getRecordNumber());
            return null;
        }

        Transaction tx = new Transaction();
        tx.setBookingDate(parseDate(dateStr, record.getRecordNumber()));
        tx.setAmount(parseAmount(amountStr, record.getRecordNumber()));
        tx.setAccount(IbanNormalizationService.normalize(getField(record, mapping.account())));
        tx.setPartnerName(getField(record, mapping.partnerName()));
        tx.setPartnerIban(IbanNormalizationService.normalize(getField(record, mapping.partnerIban())));

        String details = getField(record, mapping.details());
        if (details == null) {
            details = getField(record, mapping.detailsFallback());
        }
        tx.setDetails(details);

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
                    "Invalid date format at row " + recordNumber + ": '" + dateStr + "'. Expected DD.MM.YYYY", e);
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
                    "Invalid amount format at row " + recordNumber + ": '" + amountStr + "'. Expected European format (e.g. -12,99)", e);
        }
    }

    public static class CsvParseException extends RuntimeException {
        public CsvParseException(String message) {
            super(message);
        }

        public CsvParseException(String message, Throwable cause) {
            super(message, cause);
        }
    }

    public record CsvImportMapping(String bookingDate,
                                   String amount,
                                   String account,
                                   String partnerName,
                                   String partnerIban,
                                   String details,
                                   String detailsFallback) {

        public List<String> mappedHeaders() {
            List<String> headers = new ArrayList<>();
            headers.add(bookingDate);
            headers.add(amount);
            headers.add(account);
            headers.add(partnerName);
            headers.add(partnerIban);
            headers.add(details);
            headers.add(detailsFallback);
            return headers;
        }
    }
}
