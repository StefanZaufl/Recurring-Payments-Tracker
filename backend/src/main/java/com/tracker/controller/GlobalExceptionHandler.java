package com.tracker.controller;

import com.tracker.api.model.ErrorResponse;
import com.tracker.service.CsvParserService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.time.OffsetDateTime;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(CsvParserService.CsvParseException.class)
    public ResponseEntity<ErrorResponse> handleCsvParseException(CsvParserService.CsvParseException e) {
        log.debug("CSV parse error: {}", e.getMessage(), e);
        return buildResponse(HttpStatus.BAD_REQUEST, e.getMessage());
    }

    @ExceptionHandler(TransactionController.CsvValidationException.class)
    public ResponseEntity<ErrorResponse> handleCsvValidationException(TransactionController.CsvValidationException e) {
        log.debug("CSV validation error: {}", e.getMessage(), e);
        return buildResponse(HttpStatus.BAD_REQUEST, e.getMessage());
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleResourceNotFound(ResourceNotFoundException e) {
        log.debug("Resource not found: {}", e.getMessage(), e);
        return buildResponse(HttpStatus.NOT_FOUND, e.getMessage());
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleIllegalArgument(IllegalArgumentException e) {
        log.debug("Bad request: {}", e.getMessage(), e);
        return buildResponse(HttpStatus.BAD_REQUEST, e.getMessage());
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ErrorResponse> handleDataIntegrityViolation(DataIntegrityViolationException e) {
        log.debug("Data integrity violation: {}", e.getMessage(), e);
        return buildResponse(HttpStatus.CONFLICT, "A resource with this value already exists.");
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ErrorResponse> handleMaxUploadSizeExceeded(MaxUploadSizeExceededException e) {
        log.debug("File upload size exceeded: {}", e.getMessage(), e);
        return buildResponse(HttpStatus.BAD_REQUEST, "File size exceeds the maximum allowed size of 10MB.");
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ErrorResponse> handleNoResourceFound(NoResourceFoundException e) {
        return buildResponse(HttpStatus.NOT_FOUND, "The requested resource was not found.");
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGenericException(Exception e) {
        log.error("Unexpected error: {}", e.getMessage(), e);
        return buildResponse(HttpStatus.INTERNAL_SERVER_ERROR, "An unexpected error occurred.");
    }

    private ResponseEntity<ErrorResponse> buildResponse(HttpStatus status, String message) {
        ErrorResponse error = new ErrorResponse(status.value(), message, OffsetDateTime.now());
        return ResponseEntity.status(status).body(error);
    }
}
