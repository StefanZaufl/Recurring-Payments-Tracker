package com.tracker.controller;

import com.tracker.service.CsvParserService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(CsvParserService.CsvParseException.class)
    public ResponseEntity<Map<String, String>> handleCsvParseException(CsvParserService.CsvParseException e) {
        log.debug("CSV parse error: {}", e.getMessage(), e);
        return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
    }

    @ExceptionHandler(TransactionController.CsvValidationException.class)
    public ResponseEntity<Map<String, String>> handleCsvValidationException(TransactionController.CsvValidationException e) {
        log.debug("CSV validation error: {}", e.getMessage(), e);
        return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
    }
}
