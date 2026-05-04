package com.tracker.service;

import com.tracker.model.entity.FileUpload;
import com.tracker.model.entity.RecurringPayment;
import com.tracker.model.entity.Transaction;
import com.tracker.model.entity.User;
import com.tracker.repository.FileUploadRepository;
import com.tracker.repository.TransactionFilter;
import com.tracker.repository.TransactionRepository;
import com.tracker.repository.TransactionTypeFilter;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
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
    private final RecurringPaymentRecalculationService recalculationService;

    public TransactionService(CsvParserService csvParserService,
                              TransactionRepository transactionRepository,
                              FileUploadRepository fileUploadRepository,
                              RecurringPaymentDetectionService detectionService,
                              UserContextService userContextService,
                              BankAccountService bankAccountService,
                              InterAccountService interAccountService,
                              RecurringPaymentRecalculationService recalculationService) {
        this.csvParserService = csvParserService;
        this.transactionRepository = transactionRepository;
        this.fileUploadRepository = fileUploadRepository;
        this.detectionService = detectionService;
        this.userContextService = userContextService;
        this.bankAccountService = bankAccountService;
        this.interAccountService = interAccountService;
        this.recalculationService = recalculationService;
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
        int createdBankAccounts = bankAccountService.createMissingForCurrentUser(savedTransactions.stream()
                .map(Transaction::getAccount)
                .collect(java.util.stream.Collectors.toSet()));
        interAccountService.markInterAccountTransactions(savedTransactions);

        int recurringCount = detectionService.detectRecurringPayments(savedTransactions.stream()
                .filter(tx -> !Boolean.TRUE.equals(tx.getIsInterAccount()))
                .toList()).stream()
                .map(RecurringPayment::getId)
                .collect(java.util.stream.Collectors.toSet())
                .size();
        savedTransactions.stream()
                .map(Transaction::getBookingDate)
                .max(LocalDate::compareTo)
                .ifPresent(detectionService::markStalePayments);

        Integer transactionsMarkedInterAccount = null;
        Integer transactionLinksRemoved = null;
        Integer recurringPaymentsDeleted = null;
        Integer recalculationRecurringPaymentsDetected = null;

        if (createdBankAccounts > 0) {
            RecurringPaymentRecalculationService.RecalculationResult recalculationResult =
                    recalculationService.recalculateCurrentUserRecurringPayments();
            transactionsMarkedInterAccount = recalculationResult.transactionsMarkedInterAccount();
            transactionLinksRemoved = recalculationResult.transactionLinksRemoved();
            recurringPaymentsDeleted = recalculationResult.recurringPaymentsDeleted();
            recalculationRecurringPaymentsDetected = recalculationResult.recurringPaymentsDetected();
        }

        return new UploadResult(
                upload.getId(),
                newTransactions.size(),
                duplicateFilterResult.skippedDuplicates(),
                recurringCount,
                transactionsMarkedInterAccount,
                transactionLinksRemoved,
                recurringPaymentsDeleted,
                recalculationRecurringPaymentsDetected
        );
    }

    private static final java.util.Set<String> ALLOWED_SORT_FIELDS = java.util.Set.of("bookingDate", "partnerName", "amount");

    @Transactional(readOnly = true)
    public TransactionQueryResult getTransactions(LocalDate from, LocalDate to, String text, String account,
                                                  String transactionType, String transactionSign, int page, int size,
                                                  String sort, String sortDirection) {
        TransactionFilter filter = new TransactionFilter(
                userContextService.getCurrentUserId(),
                from,
                to,
                text,
                account,
                TransactionTypeFilter.fromQueryParam(transactionType),
                com.tracker.repository.TransactionSignFilter.fromQueryParam(transactionSign)
        );
        String sortField = sort != null && ALLOWED_SORT_FIELDS.contains(sort) ? sort : "bookingDate";
        Sort.Direction direction = "asc".equalsIgnoreCase(sortDirection) ? Sort.Direction.ASC : Sort.Direction.DESC;
        Sort sorting = Sort.by(direction, sortField);
        if (!"bookingDate".equals(sortField)) {
            sorting = sorting.and(Sort.by(Sort.Direction.DESC, "bookingDate"));
        }
        PageRequest pageRequest = PageRequest.of(page, size, sorting);

        Page<Transaction> transactionPage = transactionRepository.findAll(toSpecification(filter), pageRequest);
        BigDecimal filteredSum = transactionRepository.sumAmounts(filter);

        return new TransactionQueryResult(transactionPage, filteredSum);
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

    public record UploadResult(UUID uploadId,
                               int transactionCount,
                               int skippedDuplicates,
                               int recurringPaymentsDetected,
                               Integer transactionsMarkedInterAccount,
                               Integer transactionLinksRemoved,
                               Integer recurringPaymentsDeleted,
                               Integer recalculationRecurringPaymentsDetected) {}

    private record DuplicateFilterResult(List<Transaction> newTransactions, int skippedDuplicates) {}

    public record TransactionQueryResult(Page<Transaction> page, BigDecimal filteredSum) {}

    private Specification<Transaction> toSpecification(TransactionFilter filter) {
        return (root, query, cb) -> cb.and(com.tracker.repository.TransactionPredicates.build(filter, root, query, cb).toArray(new Predicate[0]));
    }

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
