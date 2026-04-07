package com.tracker.controller;

import com.tracker.api.TransactionsApi;
import com.tracker.api.model.TransactionDto;
import com.tracker.api.model.TransactionPage;
import com.tracker.api.model.UploadResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tracker.model.entity.Transaction;
import com.tracker.service.CsvParserService;
import com.tracker.service.TransactionService;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.UUID;

@RestController
public class TransactionController implements TransactionsApi {

    static final String HEADER_TOTAL_ITEMS = "X-Total-Items";
    static final String HEADER_PAGE = "X-Page";
    static final String HEADER_PAGE_SIZE = "X-Page-Size";
    static final String HEADER_TOTAL_PAGES = "X-Total-Pages";
    static final String HEADER_CSV_CHARSET = "X-Csv-Charset";

    private final TransactionService transactionService;
    private final TransactionMapper transactionMapper;
    private final ObjectMapper objectMapper;

    public TransactionController(TransactionService transactionService, TransactionMapper transactionMapper, ObjectMapper objectMapper) {
        this.transactionService = transactionService;
        this.transactionMapper = transactionMapper;
        this.objectMapper = objectMapper;
    }

    @Override
    public ResponseEntity<UploadResponse> uploadCsv(MultipartFile file, String mapping, String xCsvCharset) {
        try {
            CsvParserService.CsvImportMapping parsedMapping = objectMapper.readValue(mapping, CsvParserService.CsvImportMapping.class);
            String charset = (xCsvCharset == null || xCsvCharset.isBlank()) ? StandardCharsets.UTF_8.name() : xCsvCharset;
            var request = new TransactionService.CsvUploadRequest(
                    file.getOriginalFilename(), file.getContentType(), file.getBytes(), parsedMapping, charset);
            TransactionService.UploadResult result = transactionService.uploadCsv(request);
            UploadResponse response = new UploadResponse();
            response.setUploadId(result.uploadId());
            response.setTransactionCount(result.transactionCount());
            response.setSkippedDuplicates(result.skippedDuplicates());
            response.setRecurringPaymentsDetected(result.recurringPaymentsDetected());
            return ResponseEntity.ok(response);
        } catch (CsvParserService.CsvParseException e) {
            throw new CsvValidationException(e.getMessage(), e);
        } catch (Exception e) {
            throw new CsvValidationException("Failed to process CSV file: " + e.getMessage(), e);
        }
    }

    @Override
    public ResponseEntity<TransactionPage> getTransactions(LocalDate from, LocalDate to, String text, String account, Boolean unlinked, Integer page, Integer size, String sort, String sortDirection) {
        Page<Transaction> result = transactionService.getTransactions(from, to, text, account, unlinked, page, size, sort, sortDirection);
        TransactionPage transactionPage = new TransactionPage(
                transactionMapper.toDtoList(result.getContent()),
                result.getTotalElements(),
                result.getTotalPages()
        );

        HttpHeaders headers = new HttpHeaders();
        headers.set(HEADER_TOTAL_ITEMS, String.valueOf(result.getTotalElements()));
        headers.set(HEADER_PAGE, String.valueOf(result.getNumber()));
        headers.set(HEADER_PAGE_SIZE, String.valueOf(result.getSize()));
        headers.set(HEADER_TOTAL_PAGES, String.valueOf(result.getTotalPages()));

        return ResponseEntity.ok().headers(headers).body(transactionPage);
    }

    @Override
    public ResponseEntity<TransactionDto> getTransactionById(UUID id) {
        return transactionService.getTransactionById(id)
                .map(transactionMapper::toDto)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    public static class CsvValidationException extends RuntimeException {
        public CsvValidationException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
