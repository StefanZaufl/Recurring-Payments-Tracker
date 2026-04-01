package com.tracker.controller;

import com.tracker.api.TransactionsApi;
import com.tracker.api.model.TransactionDto;
import com.tracker.api.model.TransactionPage;
import com.tracker.api.model.UploadResponse;
import com.tracker.model.entity.Transaction;
import com.tracker.service.CsvParserService;
import com.tracker.service.TransactionService;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.util.UUID;

@RestController
public class TransactionController implements TransactionsApi {

    static final String HEADER_TOTAL_ITEMS = "X-Total-Items";
    static final String HEADER_PAGE = "X-Page";
    static final String HEADER_PAGE_SIZE = "X-Page-Size";
    static final String HEADER_TOTAL_PAGES = "X-Total-Pages";

    private final TransactionService transactionService;
    private final TransactionMapper transactionMapper;

    public TransactionController(TransactionService transactionService, TransactionMapper transactionMapper) {
        this.transactionService = transactionService;
        this.transactionMapper = transactionMapper;
    }

    @Override
    public ResponseEntity<UploadResponse> uploadCsv(MultipartFile file) {
        try {
            var request = new TransactionService.CsvUploadRequest(
                    file.getOriginalFilename(), file.getContentType(), file.getBytes());
            TransactionService.UploadResult result = transactionService.uploadCsv(request);
            UploadResponse response = new UploadResponse(result.uploadId(), result.transactionCount(), result.recurringPaymentsDetected());
            return ResponseEntity.ok(response);
        } catch (CsvParserService.CsvParseException e) {
            throw new CsvValidationException(e.getMessage(), e);
        } catch (Exception e) {
            throw new CsvValidationException("Failed to process CSV file: " + e.getMessage(), e);
        }
    }

    @Override
    public ResponseEntity<TransactionPage> getTransactions(LocalDate from, LocalDate to, String text, Integer page, Integer size) {
        Page<Transaction> result = transactionService.getTransactions(from, to, text, page, size);
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
