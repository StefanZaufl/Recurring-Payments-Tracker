package com.tracker.controller;

import com.tracker.api.TransactionsApi;
import com.tracker.api.model.TransactionDto;
import com.tracker.api.model.TransactionPage;
import com.tracker.api.model.UploadResponse;
import com.tracker.service.CsvParserService;
import com.tracker.service.TransactionService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.util.UUID;

@RestController
public class TransactionController implements TransactionsApi {

    private final TransactionService transactionService;

    public TransactionController(TransactionService transactionService) {
        this.transactionService = transactionService;
    }

    @Override
    public ResponseEntity<UploadResponse> uploadCsv(MultipartFile file) {
        try {
            UploadResponse response = transactionService.uploadCsv(file);
            return ResponseEntity.ok(response);
        } catch (CsvParserService.CsvParseException e) {
            throw new CsvValidationException(e.getMessage());
        } catch (Exception e) {
            throw new CsvValidationException("Failed to process CSV file: " + e.getMessage());
        }
    }

    @Override
    public ResponseEntity<TransactionPage> getTransactions(LocalDate from, LocalDate to, String text, Integer page, Integer size) {
        TransactionPage result = transactionService.getTransactions(from, to, text, page, size);
        return ResponseEntity.ok(result);
    }

    @Override
    public ResponseEntity<TransactionDto> getTransactionById(UUID id) {
        return transactionService.getTransactionById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    public static class CsvValidationException extends RuntimeException {
        public CsvValidationException(String message) {
            super(message);
        }
    }
}
