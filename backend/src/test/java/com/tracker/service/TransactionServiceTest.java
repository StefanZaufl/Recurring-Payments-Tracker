package com.tracker.service;

import com.tracker.model.entity.FileUpload;
import com.tracker.model.entity.RecurringPayment;
import com.tracker.model.entity.Transaction;
import com.tracker.model.entity.User;
import com.tracker.repository.FileUploadRepository;
import com.tracker.repository.TransactionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentMatcher;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.lenient;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TransactionServiceTest {

    @Mock
    private CsvParserService csvParserService;
    @Mock
    private TransactionRepository transactionRepository;
    @Mock
    private FileUploadRepository fileUploadRepository;
    @Mock
    private RecurringPaymentDetectionService detectionService;
    @Mock
    private UserContextService userContextService;
    @Mock
    private BankAccountService bankAccountService;
    @Mock
    private InterAccountService interAccountService;
    @Mock
    private RecurringPaymentRecalculationService recalculationService;

    private TransactionService service;
    private User user;

    @BeforeEach
    void setUp() {
        service = new TransactionService(
                csvParserService,
                transactionRepository,
                fileUploadRepository,
                detectionService,
                userContextService,
                bankAccountService,
                interAccountService,
                recalculationService
        );
        user = new User();
        user.setId(UUID.randomUUID());
        lenient().when(userContextService.getCurrentUser()).thenReturn(user);
        lenient().when(userContextService.getCurrentUserId()).thenReturn(user.getId());
    }

    @Test
    void uploadCsv_returnsNullRecalculationFieldsWhenNoBankAccountsWereCreated() {
        Transaction duplicate = transaction(LocalDate.of(2025, 1, 10), "DE111", "Gym", "DE999", "-10.00", "Membership");
        Transaction first = transaction(LocalDate.of(2025, 2, 10), "DE111", "Gym", "DE999", "-10.00", "Membership");
        Transaction second = transaction(LocalDate.of(2025, 3, 10), "DE111", "Gym", "DE999", "-10.00", "Membership");
        RecurringPayment recurringPayment = recurringPayment();

        when(csvParserService.parse(any(), any(), eq("UTF-8"))).thenReturn(List.of(first, second, duplicate));
        when(transactionRepository.findByUserId(user.getId())).thenReturn(List.of(duplicate));
        when(fileUploadRepository.save(any(FileUpload.class))).thenAnswer(invocation -> {
            FileUpload upload = invocation.getArgument(0);
            upload.setId(UUID.randomUUID());
            return upload;
        });
        when(transactionRepository.saveAll(List.of(first, second))).thenReturn(List.of(first, second));
        when(bankAccountService.createMissingForCurrentUser(Set.of("DE111"))).thenReturn(0);
        when(detectionService.detectRecurringPayments(List.of(first, second))).thenReturn(List.of(recurringPayment, recurringPayment));

        TransactionService.UploadResult result = service.uploadCsv(request());

        assertThat(result.transactionCount()).isEqualTo(2);
        assertThat(result.skippedDuplicates()).isEqualTo(1);
        assertThat(result.recurringPaymentsDetected()).isEqualTo(1);
        assertThat(result.transactionsMarkedInterAccount()).isNull();
        assertThat(result.transactionLinksRemoved()).isNull();
        assertThat(result.recurringPaymentsDeleted()).isNull();
        assertThat(result.recalculationRecurringPaymentsDetected()).isNull();
        assertThat(first.getUpload()).isNotNull();
        assertThat(first.getUser()).isSameAs(user);
        assertThat(first.getIsInterAccount()).isFalse();
        verify(interAccountService).markInterAccountTransactions(List.of(first, second));
        verify(recalculationService, never()).recalculateCurrentUserRecurringPayments();
    }

    @Test
    void uploadCsv_includesRecalculationSummaryWhenNewBankAccountsWereCreated() {
        Transaction transaction = transaction(LocalDate.of(2025, 2, 10), "DE111", "Savings", "DE222", "-10.00", null);
        RecurringPayment recurringPayment = recurringPayment();

        when(csvParserService.parse(any(), any(), eq("UTF-8"))).thenReturn(List.of(transaction));
        when(transactionRepository.findByUserId(user.getId())).thenReturn(List.of());
        when(fileUploadRepository.save(any(FileUpload.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(transactionRepository.saveAll(List.of(transaction))).thenReturn(List.of(transaction));
        when(bankAccountService.createMissingForCurrentUser(Set.of("DE111"))).thenReturn(1);
        when(detectionService.detectRecurringPayments(List.of(transaction))).thenReturn(List.of(recurringPayment));
        when(recalculationService.recalculateCurrentUserRecurringPayments())
                .thenReturn(new RecurringPaymentRecalculationService.RecalculationResult(3, 2, 1, 4));

        TransactionService.UploadResult result = service.uploadCsv(request());

        assertThat(result.transactionsMarkedInterAccount()).isEqualTo(3);
        assertThat(result.transactionLinksRemoved()).isEqualTo(2);
        assertThat(result.recurringPaymentsDeleted()).isEqualTo(1);
        assertThat(result.recalculationRecurringPaymentsDetected()).isEqualTo(4);
    }

    @Test
    void getTransactions_usesSpecificationPathForRegularQueries() {
        PageImpl<Transaction> page = new PageImpl<>(List.of());
        when(transactionRepository.findAll(any(org.springframework.data.jpa.domain.Specification.class), any(Pageable.class)))
                .thenReturn(page);

        assertThat(service.getTransactions(
                LocalDate.of(2025, 1, 1),
                LocalDate.of(2025, 12, 31),
                "Gym",
                "de11 1",
                "ALL",
                1,
                10,
                "partnerName",
                "asc"
        )).isSameAs(page);
    }

    @Test
    void getTransactions_fallsBackToDefaultSortAndDescendingDirection() {
        PageImpl<Transaction> page = new PageImpl<>(List.of());
        when(transactionRepository.findAll(any(org.springframework.data.jpa.domain.Specification.class), any(Pageable.class)))
                .thenReturn(page);

        Page<Transaction> result = service.getTransactions(null, null, null, null, "ALL", 0, 5, "unknown", "sideways");

        assertThat(result).isSameAs(page);
        ArgumentCaptor<Pageable> pageableCaptor = ArgumentCaptor.forClass(Pageable.class);
        verify(transactionRepository).findAll(any(org.springframework.data.jpa.domain.Specification.class), pageableCaptor.capture());
        assertThat(pageableCaptor.getValue().getSort().toString()).contains("bookingDate: DESC");
    }

    @Test
    void getTransactions_usesSpecificationPathForRegularFilter() {
        PageImpl<Transaction> page = new PageImpl<>(List.of());
        when(transactionRepository.findAll(any(org.springframework.data.jpa.domain.Specification.class), any(Pageable.class)))
                .thenReturn(page);

        assertThat(service.getTransactions(null, null, null, null, "REGULAR", 0, 20, null, null))
                .isSameAs(page);

        verify(transactionRepository).findAll(any(org.springframework.data.jpa.domain.Specification.class), any(Pageable.class));
    }

    @Test
    void getTransactions_usesSpecificationPathForAdditionalFilter() {
        PageImpl<Transaction> page = new PageImpl<>(List.of());
        when(transactionRepository.findAll(any(org.springframework.data.jpa.domain.Specification.class), any(Pageable.class)))
                .thenReturn(page);

        assertThat(service.getTransactions(null, null, null, null, "ADDITIONAL", 0, 20, null, null))
                .isSameAs(page);

        verify(transactionRepository).findAll(any(org.springframework.data.jpa.domain.Specification.class), any(Pageable.class));
    }

    @Test
    void getTransactions_rejectsUnknownTransactionType() {
        assertThatThrownBy(() -> service.getTransactions(null, null, null, null, "MYSTERY", 0, 20, null, null))
                .isInstanceOf(IllegalArgumentException.class);

        verify(transactionRepository, never()).findAll(any(Specification.class), any(Pageable.class));
    }

    @Test
    void getTransactionById_filtersByCurrentUserOwnership() {
        UUID id = UUID.randomUUID();
        Transaction owned = transaction(LocalDate.now(), "DE111", "Gym", null, "-10.00", null);
        owned.setId(id);
        owned.setUser(user);
        when(transactionRepository.findById(id)).thenReturn(Optional.of(owned));

        assertThat(service.getTransactionById(id)).contains(owned);

        Transaction foreign = transaction(LocalDate.now(), "DE111", "Gym", null, "-10.00", null);
        foreign.setId(UUID.randomUUID());
        User otherUser = new User();
        otherUser.setId(UUID.randomUUID());
        foreign.setUser(otherUser);
        when(transactionRepository.findById(foreign.getId())).thenReturn(Optional.of(foreign));
        assertThat(service.getTransactionById(foreign.getId())).isEmpty();

        Transaction userless = transaction(LocalDate.now(), "DE111", "Gym", null, "-10.00", null);
        userless.setId(UUID.randomUUID());
        when(transactionRepository.findById(userless.getId())).thenReturn(Optional.of(userless));
        assertThat(service.getTransactionById(userless.getId())).isEmpty();

        UUID missingId = UUID.randomUUID();
        when(transactionRepository.findById(missingId)).thenReturn(Optional.empty());
        assertThat(service.getTransactionById(missingId)).isEmpty();
    }

    @Test
    void uploadCsv_persistsUploadMetadata() {
        Transaction tx = transaction(LocalDate.of(2025, 2, 10), "DE111", "Gym", null, "-10.00", null);
        when(csvParserService.parse(any(), any(), eq("UTF-8"))).thenReturn(List.of(tx));
        when(transactionRepository.findByUserId(user.getId())).thenReturn(List.of());
        when(fileUploadRepository.save(any(FileUpload.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(transactionRepository.saveAll(List.of(tx))).thenReturn(List.of(tx));
        when(bankAccountService.createMissingForCurrentUser(Set.of("DE111"))).thenReturn(0);
        when(detectionService.detectRecurringPayments(List.of(tx))).thenReturn(List.of());

        service.uploadCsv(request());

        ArgumentCaptor<FileUpload> captor = ArgumentCaptor.forClass(FileUpload.class);
        verify(fileUploadRepository).save(captor.capture());
        assertThat(captor.getValue().getFilename()).isEqualTo("transactions.csv");
        assertThat(captor.getValue().getMimeType()).isEqualTo("text/csv");
        assertThat(captor.getValue().getRowCount()).isEqualTo(1);
        assertThat(captor.getValue().getUser()).isSameAs(user);
    }

    private TransactionService.CsvUploadRequest request() {
        return new TransactionService.CsvUploadRequest(
                "transactions.csv",
                "text/csv",
                "date,amount".getBytes(),
                new CsvParserService.CsvImportMapping("Date", "Amount", null, null, null, null, null),
                "UTF-8"
        );
    }

    private Transaction transaction(LocalDate bookingDate, String account, String partnerName, String partnerIban, String amount, String details) {
        Transaction transaction = new Transaction();
        transaction.setBookingDate(bookingDate);
        transaction.setAccount(account);
        transaction.setPartnerName(partnerName);
        transaction.setPartnerIban(partnerIban);
        transaction.setAmount(new BigDecimal(amount));
        transaction.setDetails(details);
        return transaction;
    }

    private RecurringPayment recurringPayment() {
        RecurringPayment payment = new RecurringPayment();
        payment.setId(UUID.randomUUID());
        return payment;
    }
}
