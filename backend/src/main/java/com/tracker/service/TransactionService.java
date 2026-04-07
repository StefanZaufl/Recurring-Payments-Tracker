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
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Service
public class TransactionService {

    private final CsvParserService csvParserService;
    private final TransactionRepository transactionRepository;
    private final FileUploadRepository fileUploadRepository;
    private final RecurringPaymentDetectionService detectionService;
    private final UserContextService userContextService;
    private final BankAccountService bankAccountService;
    private final InterAccountService interAccountService;

    public TransactionService(CsvParserService csvParserService,
                              TransactionRepository transactionRepository,
                              FileUploadRepository fileUploadRepository,
                              RecurringPaymentDetectionService detectionService,
                              UserContextService userContextService,
                              BankAccountService bankAccountService,
                              InterAccountService interAccountService) {
        this.csvParserService = csvParserService;
        this.transactionRepository = transactionRepository;
        this.fileUploadRepository = fileUploadRepository;
        this.detectionService = detectionService;
        this.userContextService = userContextService;
        this.bankAccountService = bankAccountService;
        this.interAccountService = interAccountService;
    }

    @Transactional
    public UploadResult uploadCsv(CsvUploadRequest request) {
        User currentUser = userContextService.getCurrentUser();
        List<Transaction> transactions = csvParserService.parse(request.content(), request.mapping(), request.charset());
        DuplicateFilterResult duplicateFilterResult = filterDuplicates(currentUser.getId(), transactions);
        List<Transaction> newTransactions = duplicateFilterResult.newTransactions();

        FileUpload upload = new FileUpload();
        upload.setFilename(request.filename());
        upload.setMimeType(request.mimeType());
        upload.setRowCount(newTransactions.size());
        upload.setUser(currentUser);
        upload = fileUploadRepository.save(upload);

        for (Transaction tx : newTransactions) {
            tx.setUpload(upload);
            tx.setUser(currentUser);
            tx.setIsInterAccount(Boolean.FALSE);
        }
        List<Transaction> savedTransactions = transactionRepository.saveAll(newTransactions);
        bankAccountService.createMissingForCurrentUser(savedTransactions.stream()
                .map(Transaction::getAccount)
                .collect(java.util.stream.Collectors.toSet()));
        interAccountService.markInterAccountTransactions(savedTransactions);

        int recurringCount = detectionService.detectRecurringPayments(savedTransactions.stream()
                .filter(tx -> !Boolean.TRUE.equals(tx.getIsInterAccount()))
                .toList()).size();

        return new UploadResult(upload.getId(), newTransactions.size(), duplicateFilterResult.skippedDuplicates(), recurringCount);
    }

    private static final java.util.Set<String> ALLOWED_SORT_FIELDS = java.util.Set.of("bookingDate", "partnerName", "amount");

    @Transactional(readOnly = true)
    public Page<Transaction> getTransactions(LocalDate from, LocalDate to, String text, String account,
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
            if (account != null && !account.isBlank()) {
                predicates.add(cb.equal(root.get("account"), IbanNormalizationService.normalize(account)));
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

    private DuplicateFilterResult filterDuplicates(UUID userId, List<Transaction> transactions) {
        Set<TransactionSignature> existingSignatures = transactionRepository.findByUserId(userId).stream()
                .map(TransactionSignature::from)
                .collect(java.util.stream.Collectors.toCollection(HashSet::new));

        List<Transaction> newTransactions = new ArrayList<>();
        int skippedDuplicates = 0;
        for (Transaction transaction : transactions) {
            TransactionSignature signature = TransactionSignature.from(transaction);
            if (!existingSignatures.add(signature)) {
                skippedDuplicates += 1;
                continue;
            }
            newTransactions.add(transaction);
        }

        return new DuplicateFilterResult(newTransactions, skippedDuplicates);
    }

    public record CsvUploadRequest(String filename,
                                   String mimeType,
                                   byte[] content,
                                   CsvParserService.CsvImportMapping mapping,
                                   String charset) {}

    public record UploadResult(UUID uploadId, int transactionCount, int skippedDuplicates, int recurringPaymentsDetected) {}

    private record DuplicateFilterResult(List<Transaction> newTransactions, int skippedDuplicates) {}

    private record TransactionSignature(LocalDate bookingDate,
                                        String account,
                                        String partnerName,
                                        String partnerIban,
                                        java.math.BigDecimal amount,
                                        String details) {

        static TransactionSignature from(Transaction transaction) {
            return new TransactionSignature(
                    transaction.getBookingDate(),
                    normalize(transaction.getAccount()),
                    normalize(transaction.getPartnerName()),
                    normalize(transaction.getPartnerIban()),
                    transaction.getAmount() == null ? null : transaction.getAmount().stripTrailingZeros(),
                    normalize(transaction.getDetails())
            );
        }

        private static String normalize(String value) {
            if (value == null) {
                return null;
            }
            String trimmed = value.trim();
            return trimmed.isEmpty() ? null : trimmed;
        }
    }
}
