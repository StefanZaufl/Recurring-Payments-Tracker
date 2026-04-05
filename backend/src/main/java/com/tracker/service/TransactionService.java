package com.tracker.service;

import com.tracker.model.entity.FileUpload;
import com.tracker.model.entity.Transaction;
import com.tracker.model.entity.User;
import com.tracker.repository.FileUploadRepository;
import com.tracker.repository.TransactionRepository;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class TransactionService {

    private final CsvParserService csvParserService;
    private final TransactionRepository transactionRepository;
    private final FileUploadRepository fileUploadRepository;
    private final RecurringPaymentDetectionService detectionService;
    private final UserContextService userContextService;

    public TransactionService(CsvParserService csvParserService,
                              TransactionRepository transactionRepository,
                              FileUploadRepository fileUploadRepository,
                              RecurringPaymentDetectionService detectionService,
                              UserContextService userContextService) {
        this.csvParserService = csvParserService;
        this.transactionRepository = transactionRepository;
        this.fileUploadRepository = fileUploadRepository;
        this.detectionService = detectionService;
        this.userContextService = userContextService;
    }

    @Transactional
    public UploadResult uploadCsv(CsvUploadRequest request) {
        User currentUser = userContextService.getCurrentUser();
        List<Transaction> transactions = csvParserService.parse(request.content());

        FileUpload upload = new FileUpload();
        upload.setFilename(request.filename());
        upload.setMimeType(request.mimeType());
        upload.setRowCount(transactions.size());
        upload.setUser(currentUser);
        upload = fileUploadRepository.save(upload);

        for (Transaction tx : transactions) {
            tx.setUpload(upload);
            tx.setUser(currentUser);
        }
        List<Transaction> savedTransactions = transactionRepository.saveAll(transactions);

        int recurringCount = detectionService.detectRecurringPayments(savedTransactions).size();

        return new UploadResult(upload.getId(), transactions.size(), recurringCount);
    }

    private static final java.util.Set<String> ALLOWED_SORT_FIELDS = java.util.Set.of("bookingDate", "partnerName", "amount");

    @Transactional(readOnly = true)
    public Page<Transaction> getTransactions(LocalDate from, LocalDate to, String text,
                                             Boolean unlinked, int page, int size,
                                             String sort, String sortDirection) {
        UUID currentUserId = userContextService.getCurrentUserId();
        String sortField = sort != null && ALLOWED_SORT_FIELDS.contains(sort) ? sort : "bookingDate";
        Sort.Direction direction = "asc".equalsIgnoreCase(sortDirection) ? Sort.Direction.ASC : Sort.Direction.DESC;
        Sort sorting = Sort.by(direction, sortField);
        if (!"bookingDate".equals(sortField)) {
            sorting = sorting.and(Sort.by(Sort.Direction.DESC, "bookingDate"));
        }
        PageRequest pageRequest = PageRequest.of(page, size, sorting);

        if (Boolean.TRUE.equals(unlinked)) {
            LocalDate cutoff = LocalDate.now().minusDays(RecurringPaymentDetectionService.LOOKBACK_DAYS);
            return transactionRepository.findUnlinkedTransactionsAfterForUserPaged(cutoff, currentUserId, pageRequest);
        }

        Specification<Transaction> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.equal(root.get("user").get("id"), currentUserId));
            if (from != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("bookingDate"), from));
            }
            if (to != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("bookingDate"), to));
            }
            if (text != null && !text.isBlank()) {
                String pattern = "%" + text.toLowerCase() + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("partnerName")), pattern),
                        cb.like(cb.lower(root.get("details")), pattern)
                ));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };

        return transactionRepository.findAll(spec, pageRequest);
    }

    @Transactional(readOnly = true)
    public Optional<Transaction> getTransactionById(UUID id) {
        UUID currentUserId = userContextService.getCurrentUserId();
        return transactionRepository.findById(id)
                .filter(tx -> tx.getUser() != null && tx.getUser().getId().equals(currentUserId));
    }

    public record CsvUploadRequest(String filename, String mimeType, byte[] content) {}

    public record UploadResult(UUID uploadId, int transactionCount, int recurringPaymentsDetected) {}
}
