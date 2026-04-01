package com.tracker.service;

import com.tracker.model.entity.FileUpload;
import com.tracker.model.entity.Transaction;
import com.tracker.repository.FileUploadRepository;
import com.tracker.repository.TransactionRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class TransactionService {

    private final CsvParserService csvParserService;
    private final TransactionRepository transactionRepository;
    private final FileUploadRepository fileUploadRepository;
    private final RecurringPaymentDetectionService detectionService;

    public TransactionService(CsvParserService csvParserService,
                              TransactionRepository transactionRepository,
                              FileUploadRepository fileUploadRepository,
                              RecurringPaymentDetectionService detectionService) {
        this.csvParserService = csvParserService;
        this.transactionRepository = transactionRepository;
        this.fileUploadRepository = fileUploadRepository;
        this.detectionService = detectionService;
    }

    @Transactional
    public UploadResult uploadCsv(CsvUploadRequest request) {
        List<Transaction> transactions = csvParserService.parse(request.content());

        FileUpload upload = new FileUpload();
        upload.setFilename(request.filename());
        upload.setMimeType(request.mimeType());
        upload.setRowCount(transactions.size());
        upload = fileUploadRepository.save(upload);

        for (Transaction tx : transactions) {
            tx.setUpload(upload);
        }
        transactionRepository.saveAll(transactions);

        int recurringCount = detectionService.detectRecurringPayments().size();

        return new UploadResult(upload.getId(), transactions.size(), recurringCount);
    }

    @Transactional(readOnly = true)
    public Page<Transaction> getTransactions(LocalDate from, LocalDate to, String text, int page, int size) {
        PageRequest pageRequest = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "bookingDate"));
        return transactionRepository.findFiltered(from, to, text, pageRequest);
    }

    @Transactional(readOnly = true)
    public Optional<Transaction> getTransactionById(UUID id) {
        return transactionRepository.findById(id);
    }

    public record CsvUploadRequest(String filename, String mimeType, byte[] content) {}

    public record UploadResult(UUID uploadId, int transactionCount, int recurringPaymentsDetected) {}
}
