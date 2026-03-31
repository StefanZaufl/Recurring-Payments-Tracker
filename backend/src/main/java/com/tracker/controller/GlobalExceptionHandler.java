package com.tracker.controller;

import com.tracker.service.CsvParserService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(CsvParserService.CsvParseException.class)
    public ResponseEntity<Map<String, String>> handleCsvParseException(CsvParserService.CsvParseException e) {
        return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
    }

    @ExceptionHandler(TransactionController.CsvValidationException.class)
    public ResponseEntity<Map<String, String>> handleCsvValidationException(TransactionController.CsvValidationException e) {
        return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
    }
}
