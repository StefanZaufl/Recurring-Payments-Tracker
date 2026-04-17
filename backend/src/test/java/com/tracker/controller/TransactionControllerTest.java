package com.tracker.controller;

import com.tracker.model.entity.*;
import com.tracker.repository.*;
import com.tracker.testutil.CsvMother;
import com.tracker.testutil.FileUploadMother;
import com.tracker.testutil.SecurityTestUtil;
import com.tracker.testutil.TransactionMother;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.UUID;

import static com.tracker.controller.TransactionController.*;
import static com.tracker.testutil.CsvMother.*;
import static com.tracker.testutil.SecurityTestUtil.authenticatedUser;
import static com.tracker.testutil.TransactionMother.*;
import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class TransactionControllerTest {

    private static final String TRANSACTIONS_URL = "/api/transactions";
    private static final String UPLOAD_URL = "/api/transactions/csv";
    private static final String PAGE_PARAM = "page";
    private static final String SIZE_PARAM = "size";
    private static final String FROM_PARAM = "from";
    private static final String TO_PARAM = "to";
    private static final String TEXT_PARAM = "text";
    private static final String TRANSACTION_TYPE_PARAM = "transactionType";
    private static final String SORT_PARAM = "sort";
    private static final String SORT_DIR_PARAM = "sortDirection";
    private static final String MAPPING_PARAM = "mapping";
    private static final String DEFAULT_MAPPING_JSON = """
            {"bookingDate":"Buchungsdatum","amount":"Betrag","partnerName":"Partnername","details":"Buchungs-Details"}
            """;
    private static final String ACCOUNT_MAPPING_JSON = """
            {"bookingDate":"Buchungsdatum","amount":"Betrag","account":"Auftragskonto","partnerName":"Partnername","partnerIban":"Partner IBAN"}
            """;

    private static final int PAGE_SIZE_2 = 2;
    private static final int TOTAL_PAGING_ITEMS = 3;
    private static final int EXPECTED_PAGES = 2;

    private static final String PARTNER_JAN = "Jan Payment";
    private static final String PARTNER_MAR = "Mar Payment";
    private static final LocalDate JAN_DATE = LocalDate.of(2025, 1, 15);
    private static final LocalDate FEB_DATE = LocalDate.of(2025, 2, 1);
    private static final LocalDate MAR_DATE = LocalDate.of(2025, 3, 15);
    private static final BigDecimal TEN = new BigDecimal("-10.00");
    private static final BigDecimal TWENTY = new BigDecimal("-20.00");
    private static final BigDecimal THIRTY = new BigDecimal("-30.00");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private TransactionRepository transactionRepository;

    @Autowired
    private FileUploadRepository fileUploadRepository;

    @Autowired
    private TransactionRecurringLinkRepository linkRepository;

    @Autowired
    private RuleRepository ruleRepository;

    @Autowired
    private RecurringPaymentRepository recurringPaymentRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private BankAccountRepository bankAccountRepository;

    private User testUser;

    @BeforeEach
    void setUp() {
        linkRepository.deleteAll();
        ruleRepository.deleteAll();
        recurringPaymentRepository.deleteAll();
        transactionRepository.deleteAll();
        fileUploadRepository.deleteAll();
        bankAccountRepository.deleteAll();
        testUser = SecurityTestUtil.createTestUser(userRepository);
    }

    @Test
    void uploadCsv_validFile_returnsUploadResponse() throws Exception {
        MockMultipartFile file = CsvMother.validTwoRowFile();

        mockMvc.perform(multipart(UPLOAD_URL).file(file).param(MAPPING_PARAM, DEFAULT_MAPPING_JSON).header(HEADER_CSV_CHARSET, StandardCharsets.UTF_8.name()).with(authenticatedUser(testUser)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.uploadId").isNotEmpty())
                .andExpect(jsonPath("$.transactionCount").value(2))
                .andExpect(jsonPath("$.skippedDuplicates").value(0))
                .andExpect(jsonPath("$.recurringPaymentsDetected").value(0))
                .andExpect(jsonPath("$.transactionsMarkedInterAccount").doesNotExist())
                .andExpect(jsonPath("$.transactionLinksRemoved").doesNotExist())
                .andExpect(jsonPath("$.recurringPaymentsDeleted").doesNotExist())
                .andExpect(jsonPath("$.recalculationRecurringPaymentsDetected").doesNotExist());
    }

    @Test
    void uploadCsv_missingRequiredColumn_returns400() throws Exception {
        MockMultipartFile file = CsvMother.multipartFile(INVALID_HEADER, "01.01.2025;Test;-10,00");

        mockMvc.perform(multipart(UPLOAD_URL).file(file).param(MAPPING_PARAM, DEFAULT_MAPPING_JSON).header(HEADER_CSV_CHARSET, StandardCharsets.UTF_8.name()).with(authenticatedUser(testUser)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("Buchungsdatum")));
    }

    @Test
    void uploadCsv_invalidDate_returns400() throws Exception {
        MockMultipartFile file = CsvMother.multipartFile(HEADER, INVALID_DATE_ROW);

        mockMvc.perform(multipart(UPLOAD_URL).file(file).param(MAPPING_PARAM, DEFAULT_MAPPING_JSON).header(HEADER_CSV_CHARSET, StandardCharsets.UTF_8.name()).with(authenticatedUser(testUser)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("date")));
    }

    @Test
    void uploadCsv_usesDetailsFallbackWhenPrimaryDetailsEmpty() throws Exception {
        MockMultipartFile file = CsvMother.multipartFile(
                "Buchungsdatum;Partnername;Betrag;Buchungs-Details;Verwendungszweck",
                "15.01.2025;Test;-10,00;;Fallback details"
        );

        mockMvc.perform(multipart(UPLOAD_URL)
                        .file(file)
                        .param(MAPPING_PARAM, """
                                {"bookingDate":"Buchungsdatum","amount":"Betrag","partnerName":"Partnername","details":"Buchungs-Details","detailsFallback":"Verwendungszweck"}
                                """)
                        .header(HEADER_CSV_CHARSET, StandardCharsets.UTF_8.name())
                        .with(authenticatedUser(testUser)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.transactionCount").value(1))
                .andExpect(jsonPath("$.skippedDuplicates").value(0));

        Transaction saved = transactionRepository.findAll().getFirst();
        assertThat(saved.getDetails(), is("Fallback details"));
    }

    @Test
    void uploadCsv_withAccountAndPartnerIban_persistsNormalizedIbansAndCreatesBankAccount() throws Exception {
        MockMultipartFile file = CsvMother.multipartFile(
                "Buchungsdatum;Auftragskonto;Partner IBAN;Betrag",
                "15.01.2025;de12 3456;de98 7654;-10,00"
        );

        mockMvc.perform(multipart(UPLOAD_URL)
                        .file(file)
                        .param(MAPPING_PARAM, """
                                {"bookingDate":"Buchungsdatum","amount":"Betrag","account":"Auftragskonto","partnerIban":"Partner IBAN"}
                                """)
                        .header(HEADER_CSV_CHARSET, StandardCharsets.UTF_8.name())
                        .with(authenticatedUser(testUser)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.transactionCount").value(1));

        Transaction saved = transactionRepository.findAll().getFirst();
        assertThat(saved.getAccount(), is("DE123456"));
        assertThat(saved.getPartnerIban(), is("DE987654"));
        assertThat(saved.getIsInterAccount(), is(false));
        assertThat(bankAccountRepository.findByUserIdOrderByNameAscIbanAsc(testUser.getId()), hasSize(1));
        assertThat(bankAccountRepository.findByUserIdOrderByNameAscIbanAsc(testUser.getId()).getFirst().getIban(), is("DE123456"));
    }

    @Test
    void uploadCsv_marksInterAccountWhenPartnerIbanBelongsToOwnedBankAccount() throws Exception {
        BankAccount existingAccount = new BankAccount();
        existingAccount.setUser(testUser);
        existingAccount.setIban("DE999999");
        bankAccountRepository.save(existingAccount);

        MockMultipartFile file = CsvMother.multipartFile(
                "Buchungsdatum;Auftragskonto;Partner IBAN;Betrag",
                "15.01.2025;DE123456;de99 9999;-10,00"
        );

        mockMvc.perform(multipart(UPLOAD_URL)
                        .file(file)
                        .param(MAPPING_PARAM, """
                                {"bookingDate":"Buchungsdatum","amount":"Betrag","account":"Auftragskonto","partnerIban":"Partner IBAN"}
                                """)
                        .header(HEADER_CSV_CHARSET, StandardCharsets.UTF_8.name())
                        .with(authenticatedUser(testUser)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.transactionCount").value(1))
                .andExpect(jsonPath("$.recurringPaymentsDetected").value(0));

        Transaction saved = transactionRepository.findAll().getFirst();
        assertThat(saved.getIsInterAccount(), is(true));
    }

    @Test
    void uploadCsv_secondImportRecalculatesAndRemovesFalseRecurringPaymentForInterAccountTransfers() throws Exception {
        MockMultipartFile firstImport = CsvMother.multipartFile(
                "Buchungsdatum;Auftragskonto;Partnername;Partner IBAN;Betrag",
                "15.01.2025;DE111111;My Savings;DE222222;-500,00",
                "15.02.2025;DE111111;My Savings;DE222222;-500,00",
                "15.03.2025;DE111111;My Savings;DE222222;-500,00"
        );

        mockMvc.perform(multipart(UPLOAD_URL)
                        .file(firstImport)
                        .param(MAPPING_PARAM, ACCOUNT_MAPPING_JSON)
                        .header(HEADER_CSV_CHARSET, StandardCharsets.UTF_8.name())
                        .with(authenticatedUser(testUser)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.transactionCount").value(3))
                .andExpect(jsonPath("$.recurringPaymentsDetected").value(1))
                .andExpect(jsonPath("$.transactionsMarkedInterAccount").value(0))
                .andExpect(jsonPath("$.transactionLinksRemoved").value(0))
                .andExpect(jsonPath("$.recurringPaymentsDeleted").value(0))
                .andExpect(jsonPath("$.recalculationRecurringPaymentsDetected").value(0));

        mockMvc.perform(get("/api/recurring-payments").with(authenticatedUser(testUser)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].name").value("My Savings"));

        MockMultipartFile secondImport = CsvMother.multipartFile(
                "Buchungsdatum;Auftragskonto;Partnername;Partner IBAN;Betrag",
                "20.03.2025;DE222222;Main Checking;DE111111;500,00"
        );

        mockMvc.perform(multipart(UPLOAD_URL)
                        .file(secondImport)
                        .param(MAPPING_PARAM, ACCOUNT_MAPPING_JSON)
                        .header(HEADER_CSV_CHARSET, StandardCharsets.UTF_8.name())
                        .with(authenticatedUser(testUser)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.transactionCount").value(1))
                .andExpect(jsonPath("$.recurringPaymentsDetected").value(0))
                .andExpect(jsonPath("$.transactionsMarkedInterAccount").value(3))
                .andExpect(jsonPath("$.transactionLinksRemoved").value(3))
                .andExpect(jsonPath("$.recurringPaymentsDeleted").value(1))
                .andExpect(jsonPath("$.recalculationRecurringPaymentsDetected").value(0));

        mockMvc.perform(get("/api/recurring-payments").with(authenticatedUser(testUser)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));

        assertThat(transactionRepository.findByUserId(testUser.getId()), hasSize(4));
        assertThat(transactionRepository.findByUserId(testUser.getId()).stream()
                .filter(tx -> Boolean.TRUE.equals(tx.getIsInterAccount()))
                .count(), is(4L));
    }

    @Test
    void uploadCsv_duplicateTransactionsAreSkippedAndReported() throws Exception {
        MockMultipartFile file = CsvMother.validTwoRowFile();

        mockMvc.perform(multipart(UPLOAD_URL).file(file).param(MAPPING_PARAM, DEFAULT_MAPPING_JSON).header(HEADER_CSV_CHARSET, StandardCharsets.UTF_8.name()).with(authenticatedUser(testUser)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.transactionCount").value(2))
                .andExpect(jsonPath("$.skippedDuplicates").value(0));

        mockMvc.perform(multipart(UPLOAD_URL).file(file).param(MAPPING_PARAM, DEFAULT_MAPPING_JSON).header(HEADER_CSV_CHARSET, StandardCharsets.UTF_8.name()).with(authenticatedUser(testUser)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.transactionCount").value(0))
                .andExpect(jsonPath("$.skippedDuplicates").value(2))
                .andExpect(jsonPath("$.recurringPaymentsDetected").value(0));
    }

    @Test
    void uploadCsv_withUnsupportedCharset_returns400() throws Exception {
        MockMultipartFile file = CsvMother.validTwoRowFile();

        mockMvc.perform(multipart(UPLOAD_URL)
                        .file(file)
                        .param(MAPPING_PARAM, DEFAULT_MAPPING_JSON)
                        .header(HEADER_CSV_CHARSET, "NOT-A-CHARSET")
                        .with(authenticatedUser(testUser)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("Unsupported CSV charset")));
    }

    @Test
    void uploadCsv_corsPreflight_allowsCsvCharsetHeader() throws Exception {
        mockMvc.perform(options(UPLOAD_URL)
                        .header("Origin", "http://localhost:4200")
                        .header("Access-Control-Request-Method", "POST")
                        .header("Access-Control-Request-Headers", "X-Csv-Charset,Content-Type"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Headers", containsString(HEADER_CSV_CHARSET)));
    }

    @Test
    void getTransactions_returnsPagedResults() throws Exception {
        seedTransaction(TransactionMother.netflix());
        seedTransaction(TransactionMother.spotify());

        mockMvc.perform(get(TRANSACTIONS_URL).param(PAGE_PARAM, "0").param(SIZE_PARAM, "10")
                        .with(authenticatedUser(testUser)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.totalPages").value(1))
                .andExpect(jsonPath("$.filteredSum").value(-22.98))
                .andExpect(jsonPath("$.content", hasSize(2)))
                .andExpect(header().string(HEADER_TOTAL_ITEMS, "2"))
                .andExpect(header().string(HEADER_PAGE, "0"))
                .andExpect(header().string(HEADER_PAGE_SIZE, "10"))
                .andExpect(header().string(HEADER_TOTAL_PAGES, "1"));
    }

    @Test
    void getTransactions_pagingAcrossTwoPages() throws Exception {
        Transaction tx1 = seedTransaction(TransactionMother.transaction(NETFLIX, JAN_DATE, TEN));
        Transaction tx2 = seedTransaction(TransactionMother.transaction(SPOTIFY, FEB_DATE, TWENTY));
        Transaction tx3 = seedTransaction(TransactionMother.transaction(EMPLOYER, MAR_DATE, THIRTY));

        mockMvc.perform(get(TRANSACTIONS_URL)
                        .param(PAGE_PARAM, "0")
                        .param(SIZE_PARAM, String.valueOf(PAGE_SIZE_2))
                        .with(authenticatedUser(testUser)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(TOTAL_PAGING_ITEMS))
                .andExpect(jsonPath("$.totalPages").value(EXPECTED_PAGES))
                .andExpect(jsonPath("$.filteredSum").value(-60.00))
                .andExpect(jsonPath("$.content", hasSize(PAGE_SIZE_2)))
                .andExpect(jsonPath("$.content[0].partnerName").value(EMPLOYER))
                .andExpect(jsonPath("$.content[0].amount").value(-30.00))
                .andExpect(jsonPath("$.content[1].partnerName").value(SPOTIFY))
                .andExpect(jsonPath("$.content[1].amount").value(-20.00))
                .andExpect(header().string(HEADER_TOTAL_ITEMS, String.valueOf(TOTAL_PAGING_ITEMS)))
                .andExpect(header().string(HEADER_PAGE, "0"))
                .andExpect(header().string(HEADER_PAGE_SIZE, String.valueOf(PAGE_SIZE_2)))
                .andExpect(header().string(HEADER_TOTAL_PAGES, String.valueOf(EXPECTED_PAGES)));

        mockMvc.perform(get(TRANSACTIONS_URL)
                        .param(PAGE_PARAM, "1")
                        .param(SIZE_PARAM, String.valueOf(PAGE_SIZE_2))
                        .with(authenticatedUser(testUser)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(TOTAL_PAGING_ITEMS))
                .andExpect(jsonPath("$.totalPages").value(EXPECTED_PAGES))
                .andExpect(jsonPath("$.filteredSum").value(-60.00))
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.content[0].partnerName").value(NETFLIX))
                .andExpect(jsonPath("$.content[0].amount").value(-10.00))
                .andExpect(header().string(HEADER_TOTAL_ITEMS, String.valueOf(TOTAL_PAGING_ITEMS)))
                .andExpect(header().string(HEADER_PAGE, "1"))
                .andExpect(header().string(HEADER_PAGE_SIZE, String.valueOf(PAGE_SIZE_2)))
                .andExpect(header().string(HEADER_TOTAL_PAGES, String.valueOf(EXPECTED_PAGES)));
    }

    @Test
    void getTransactions_filterByDateRange() throws Exception {
        seedTransaction(TransactionMother.transaction(PARTNER_JAN, JAN_DATE, TEN));
        seedTransaction(TransactionMother.transaction(PARTNER_MAR, MAR_DATE, TWENTY));

        mockMvc.perform(get(TRANSACTIONS_URL)
                        .param(FROM_PARAM, "2025-02-01")
                        .param(TO_PARAM, "2025-12-31")
                        .with(authenticatedUser(testUser)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.filteredSum").value(-20.00))
                .andExpect(jsonPath("$.content[0].partnerName").value(PARTNER_MAR));
    }

    @Test
    void getTransactions_filterByText() throws Exception {
        seedTransaction(TransactionMother.netflix());
        seedTransaction(TransactionMother.spotify());

        mockMvc.perform(get(TRANSACTIONS_URL).param(TEXT_PARAM, "net")
                        .with(authenticatedUser(testUser)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.filteredSum").value(-12.99))
                .andExpect(jsonPath("$.content[0].partnerName").value(NETFLIX));
    }

    @Test
    void getTransactions_returnsNestedAccountObject() throws Exception {
        BankAccount account = new BankAccount();
        account.setUser(testUser);
        account.setIban("DE111");
        account.setName("Checking");
        bankAccountRepository.save(account);

        Transaction tx = TransactionMother.netflix();
        tx.setAccount("DE111");
        seedTransaction(tx);

        mockMvc.perform(get(TRANSACTIONS_URL)
                        .with(authenticatedUser(testUser)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].account.iban").value("DE111"))
                .andExpect(jsonPath("$.content[0].account.name").value("Checking"));
    }

    @Test
    void getTransactions_sortByPartnerNameAsc() throws Exception {
        seedTransaction(TransactionMother.transaction(NETFLIX, JAN_DATE, TEN));
        seedTransaction(TransactionMother.transaction(EMPLOYER, FEB_DATE, TWENTY));
        seedTransaction(TransactionMother.transaction(SPOTIFY, MAR_DATE, THIRTY));

        mockMvc.perform(get(TRANSACTIONS_URL)
                        .param(SORT_PARAM, "partnerName")
                        .param(SORT_DIR_PARAM, "asc")
                        .with(authenticatedUser(testUser)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].partnerName").value(EMPLOYER))
                .andExpect(jsonPath("$.content[1].partnerName").value(NETFLIX))
                .andExpect(jsonPath("$.content[2].partnerName").value(SPOTIFY));
    }

    @Test
    void getTransactions_sortByAmountDesc() throws Exception {
        seedTransaction(TransactionMother.transaction(NETFLIX, JAN_DATE, TEN));
        seedTransaction(TransactionMother.transaction(SPOTIFY, FEB_DATE, TWENTY));
        seedTransaction(TransactionMother.transaction(EMPLOYER, MAR_DATE, THIRTY));

        mockMvc.perform(get(TRANSACTIONS_URL)
                        .param(SORT_PARAM, "amount")
                        .param(SORT_DIR_PARAM, "desc")
                        .with(authenticatedUser(testUser)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].amount").value(-10.00))
                .andExpect(jsonPath("$.content[1].amount").value(-20.00))
                .andExpect(jsonPath("$.content[2].amount").value(-30.00));
    }

    @Test
    void getTransactions_transactionTypeAll_returnsEveryTransaction() throws Exception {
        Transaction regular = seedTransaction(TransactionMother.transaction(NETFLIX, LocalDate.now().minusDays(10), TEN));
        Transaction additional = seedTransaction(TransactionMother.transaction(SPOTIFY, LocalDate.now().minusDays(9), TWENTY));
        Transaction interAccount = seedTransaction(TransactionMother.transaction(EMPLOYER, LocalDate.now().minusDays(8), THIRTY));
        interAccount.setIsInterAccount(true);
        transactionRepository.save(interAccount);
        linkTransaction(regular, "Netflix");

        mockMvc.perform(get(TRANSACTIONS_URL)
                        .param(TRANSACTION_TYPE_PARAM, "ALL")
                        .with(authenticatedUser(testUser)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.filteredSum").value(-60.00))
                .andExpect(jsonPath("$.content", hasSize(3)))
                .andExpect(jsonPath("$.content[*].partnerName", contains(EMPLOYER, SPOTIFY, NETFLIX)));
    }

    @Test
    void getTransactions_transactionTypeRegular_returnsOnlyLinkedNonInterAccountTransactions() throws Exception {
        Transaction regular = seedTransaction(TransactionMother.transaction(NETFLIX, LocalDate.now().minusDays(10), TEN));
        Transaction additional = seedTransaction(TransactionMother.transaction(SPOTIFY, LocalDate.now().minusDays(9), TWENTY));
        Transaction interAccount = seedTransaction(TransactionMother.transaction(EMPLOYER, LocalDate.now().minusDays(8), THIRTY));
        interAccount.setIsInterAccount(true);
        transactionRepository.save(interAccount);
        linkTransaction(regular, "Netflix");
        linkTransaction(interAccount, "Employer");

        mockMvc.perform(get(TRANSACTIONS_URL)
                        .param(TRANSACTION_TYPE_PARAM, "REGULAR")
                        .with(authenticatedUser(testUser)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.filteredSum").value(-10.00))
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.content[0].partnerName").value(NETFLIX));
    }

    @Test
    void getTransactions_transactionTypeAdditional_returnsOnlyUnlinkedNonInterAccountTransactions() throws Exception {
        Transaction regular = seedTransaction(TransactionMother.transaction(NETFLIX, LocalDate.now().minusDays(10), TEN));
        Transaction additional = seedTransaction(TransactionMother.transaction(SPOTIFY, LocalDate.now().minusDays(9), TWENTY));
        Transaction interAccount = seedTransaction(TransactionMother.transaction(EMPLOYER, LocalDate.now().minusDays(8), THIRTY));
        interAccount.setIsInterAccount(true);
        transactionRepository.save(interAccount);
        linkTransaction(regular, "Netflix");

        mockMvc.perform(get(TRANSACTIONS_URL)
                        .param(TRANSACTION_TYPE_PARAM, "ADDITIONAL")
                        .with(authenticatedUser(testUser)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.filteredSum").value(-20.00))
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.content[0].partnerName").value(SPOTIFY));
    }

    @Test
    void getTransactions_invalidTransactionType_returnsBadRequest() throws Exception {
        seedTransaction(TransactionMother.netflix());

        mockMvc.perform(get(TRANSACTIONS_URL)
                        .param(TRANSACTION_TYPE_PARAM, "INVALID")
                        .with(authenticatedUser(testUser)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void getTransactionById_exists_returnsTransaction() throws Exception {
        Transaction tx = seedTransaction(TransactionMother.netflix());

        mockMvc.perform(get(TRANSACTIONS_URL + "/{id}", tx.getId())
                        .with(authenticatedUser(testUser)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(tx.getId().toString()))
                .andExpect(jsonPath("$.partnerName").value(NETFLIX))
                .andExpect(jsonPath("$.amount").value(NETFLIX_AMOUNT.doubleValue()));
    }

    @Test
    void getTransactionById_notFound_returns404() throws Exception {
        mockMvc.perform(get(TRANSACTIONS_URL + "/{id}", UUID.randomUUID())
                        .with(authenticatedUser(testUser)))
                .andExpect(status().isNotFound());
    }

    private Transaction seedTransaction(Transaction tx) {
        FileUpload upload = new FileUpload();
        upload.setFilename("test.csv");
        upload.setMimeType("text/csv");
        upload.setUser(testUser);
        upload = fileUploadRepository.save(upload);
        tx.setUpload(upload);
        tx.setUser(testUser);
        return transactionRepository.save(tx);
    }

    private void linkTransaction(Transaction transaction, String paymentName) {
        RecurringPayment payment = new RecurringPayment();
        payment.setName(paymentName);
        payment.setNormalizedName(paymentName.toLowerCase());
        payment.setAverageAmount(transaction.getAmount());
        payment.setFrequency(Frequency.MONTHLY);
        payment.setIsActive(true);
        payment.setUser(testUser);
        payment = recurringPaymentRepository.save(payment);

        TransactionRecurringLink link = new TransactionRecurringLink();
        link.setTransaction(transaction);
        link.setRecurringPayment(payment);
        link.setConfidenceScore(BigDecimal.ONE);
        link.setUser(testUser);
        linkRepository.save(link);
    }
}
