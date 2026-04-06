package com.tracker.controller;

import com.tracker.model.entity.*;
import com.tracker.model.entity.PaymentPeriodHistory;
import com.tracker.repository.*;
import com.tracker.testutil.CsvMother;
import com.tracker.testutil.FileUploadMother;
import com.tracker.testutil.SecurityTestUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

import static com.tracker.testutil.SecurityTestUtil.authenticatedUser;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class RecurringPaymentControllerTest {

    private static final String RECURRING_URL = "/api/recurring-payments";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private RecurringPaymentRepository recurringPaymentRepository;

    @Autowired
    private TransactionRepository transactionRepository;

    @Autowired
    private TransactionRecurringLinkRepository linkRepository;

    @Autowired
    private CategoryRepository categoryRepository;

    @Autowired
    private FileUploadRepository fileUploadRepository;

    @Autowired
    private RuleRepository ruleRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PaymentPeriodHistoryRepository historyRepository;

    private User testUser;

    @BeforeEach
    void setUp() {
        historyRepository.deleteAll();
        linkRepository.deleteAll();
        ruleRepository.deleteAll();
        recurringPaymentRepository.deleteAll();
        transactionRepository.deleteAll();
        fileUploadRepository.deleteAll();
        categoryRepository.deleteAll();
        testUser = SecurityTestUtil.createTestUser(userRepository);
    }

    // ────────────────────────────────────────────────────────────────────
    // GET /api/recurring-payments
    // ────────────────────────────────────────────────────────────────────

    @Nested
    class GetRecurringPayments {

        @Test
        void returnsEmptyListWhenNoneExist() throws Exception {
            mockMvc.perform(get(RECURRING_URL).with(authenticatedUser(testUser)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$", hasSize(0)));
        }

        @Test
        void returnsAllRecurringPayments() throws Exception {
            seedRecurringPayment("Netflix", "MONTHLY", "-12.99", false);
            seedRecurringPayment("Salary", "MONTHLY", "3500.00", true);

            mockMvc.perform(get(RECURRING_URL).with(authenticatedUser(testUser)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$", hasSize(2)))
                    .andExpect(jsonPath("$[*].name", containsInAnyOrder("Netflix", "Salary")));
        }

        @Test
        void returnsCorrectDtoFields() throws Exception {
            RecurringPayment payment = seedRecurringPayment("Netflix", "MONTHLY", "-12.99", false);

            mockMvc.perform(get(RECURRING_URL).with(authenticatedUser(testUser)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$[0].id").value(payment.getId().toString()))
                    .andExpect(jsonPath("$[0].name").value("Netflix"))
                    .andExpect(jsonPath("$[0].frequency").value("MONTHLY"))
                    .andExpect(jsonPath("$[0].averageAmount").value(-12.99))
                    .andExpect(jsonPath("$[0].isIncome").value(false))
                    .andExpect(jsonPath("$[0].isActive").value(true));
        }
    }

    // ────────────────────────────────────────────────────────────────────
    // PUT /api/recurring-payments/{id}
    // ────────────────────────────────────────────────────────────────────

    @Nested
    class UpdateRecurringPayment {

        @Test
        void updatesName() throws Exception {
            RecurringPayment payment = seedRecurringPayment("Netflix", "MONTHLY", "-12.99", false);

            mockMvc.perform(put(RECURRING_URL + "/{id}", payment.getId())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"name\": \"Netflix Premium\"}")
                            .with(authenticatedUser(testUser)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.name").value("Netflix Premium"));
        }

        @Test
        void updatesIsActive() throws Exception {
            RecurringPayment payment = seedRecurringPayment("Netflix", "MONTHLY", "-12.99", false);

            mockMvc.perform(put(RECURRING_URL + "/{id}", payment.getId())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"isActive\": false}")
                            .with(authenticatedUser(testUser)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.isActive").value(false));
        }

        @Test
        void returns404ForNonExistentId() throws Exception {
            mockMvc.perform(put(RECURRING_URL + "/{id}", UUID.randomUUID())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"name\": \"Test\"}")
                            .with(authenticatedUser(testUser)))
                    .andExpect(status().isNotFound());
        }

        @Test
        void partialUpdatePreservesOtherFields() throws Exception {
            RecurringPayment payment = seedRecurringPayment("Netflix", "MONTHLY", "-12.99", false);

            mockMvc.perform(put(RECURRING_URL + "/{id}", payment.getId())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"name\": \"Netflix HD\"}")
                            .with(authenticatedUser(testUser)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.name").value("Netflix HD"))
                    .andExpect(jsonPath("$.frequency").value("MONTHLY"))
                    .andExpect(jsonPath("$.averageAmount").value(-12.99))
                    .andExpect(jsonPath("$.isActive").value(true));
        }
    }

    // ────────────────────────────────────────────────────────────────────
    // GET /api/recurring-payments/{id}/transactions
    // ────────────────────────────────────────────────────────────────────

    @Nested
    class GetRecurringPaymentTransactions {

        @Test
        void returnsLinkedTransactions() throws Exception {
            RecurringPayment payment = seedRecurringPayment("Netflix", "MONTHLY", "-12.99", false);
            Transaction tx1 = seedTransaction("Netflix", LocalDate.of(2025, 1, 15), "-12.99");
            Transaction tx2 = seedTransaction("Netflix", LocalDate.of(2025, 2, 15), "-12.99");
            seedLink(tx1, payment);
            seedLink(tx2, payment);

            mockMvc.perform(get(RECURRING_URL + "/{id}/transactions", payment.getId()).with(authenticatedUser(testUser)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$", hasSize(2)))
                    .andExpect(jsonPath("$[*].partnerName", everyItem(is("Netflix"))));
        }

        @Test
        void returnsEmptyListWhenNoLinkedTransactions() throws Exception {
            RecurringPayment payment = seedRecurringPayment("Netflix", "MONTHLY", "-12.99", false);

            mockMvc.perform(get(RECURRING_URL + "/{id}/transactions", payment.getId()).with(authenticatedUser(testUser)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$", hasSize(0)));
        }

        @Test
        void returns404ForNonExistentPayment() throws Exception {
            mockMvc.perform(get(RECURRING_URL + "/{id}/transactions", UUID.randomUUID()).with(authenticatedUser(testUser)))
                    .andExpect(status().isNotFound());
        }
    }

    // ────────────────────────────────────────────────────────────────────
    // POST /api/recurring-payments (create)
    // ────────────────────────────────────────────────────────────────────

    @Nested
    class CreateRecurringPayment {

        @Test
        void createsRecurringPaymentWithRules() throws Exception {
            mockMvc.perform(post(RECURRING_URL)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                {
                                  "name": "Groceries",
                                  "paymentType": "GROUPED",
                                  "frequency": "MONTHLY",
                                  "rules": [
                                    {
                                      "ruleType": "JARO_WINKLER",
                                      "targetField": "PARTNER_NAME",
                                      "text": "rewe",
                                      "threshold": 0.85,
                                      "strict": true
                                    }
                                  ]
                                }
                                """)
                            .with(authenticatedUser(testUser)))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.name").value("Groceries"))
                    .andExpect(jsonPath("$.paymentType").value("GROUPED"))
                    .andExpect(jsonPath("$.frequency").value("MONTHLY"))
                    .andExpect(jsonPath("$.ruleCount").value(1))
                    .andExpect(jsonPath("$.isActive").value(true));
        }

        @Test
        void createsRecurringTypePayment() throws Exception {
            mockMvc.perform(post(RECURRING_URL)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                {
                                  "name": "Netflix",
                                  "paymentType": "RECURRING",
                                  "frequency": "MONTHLY",
                                  "rules": [
                                    {
                                      "ruleType": "REGEX",
                                      "targetField": "PARTNER_NAME",
                                      "text": "netflix.*",
                                      "strict": true
                                    }
                                  ]
                                }
                                """)
                            .with(authenticatedUser(testUser)))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.paymentType").value("RECURRING"));
        }
    }

    // ────────────────────────────────────────────────────────────────────
    // DELETE /api/recurring-payments/{id}
    // ────────────────────────────────────────────────────────────────────

    @Nested
    class DeleteRecurringPayment {

        @Test
        void deletesExistingPayment() throws Exception {
            RecurringPayment payment = seedRecurringPayment("Netflix", "MONTHLY", "-12.99", false);

            mockMvc.perform(delete(RECURRING_URL + "/{id}", payment.getId()).with(authenticatedUser(testUser)))
                    .andExpect(status().isNoContent());

            mockMvc.perform(get(RECURRING_URL).with(authenticatedUser(testUser)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$", hasSize(0)));
        }

        @Test
        void deletesPaymentWithLinkedTransactions() throws Exception {
            RecurringPayment payment = seedRecurringPayment("Netflix", "MONTHLY", "-12.99", false);
            Transaction tx = seedTransaction("Netflix", LocalDate.of(2025, 1, 15), "-12.99");
            seedLink(tx, payment);

            mockMvc.perform(delete(RECURRING_URL + "/{id}", payment.getId()).with(authenticatedUser(testUser)))
                    .andExpect(status().isNoContent());

            // Payment gone
            mockMvc.perform(get(RECURRING_URL).with(authenticatedUser(testUser)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$", hasSize(0)));
        }

        @Test
        void returns404ForNonExistentPayment() throws Exception {
            mockMvc.perform(delete(RECURRING_URL + "/{id}", UUID.randomUUID()).with(authenticatedUser(testUser)))
                    .andExpect(status().isNotFound());
        }
    }

    // ────────────────────────────────────────────────────────────────────
    // POST /api/recurring-payments/simulate
    // ────────────────────────────────────────────────────────────────────

    @Nested
    class SimulateRules {

        @Test
        void returnsMatchingTransactions() throws Exception {
            seedTransaction("Netflix", LocalDate.now().minusDays(10), "-12.99");
            seedTransaction("Spotify", LocalDate.now().minusDays(10), "-9.99");

            mockMvc.perform(post(RECURRING_URL + "/simulate")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                {
                                  "rules": [
                                    {
                                      "ruleType": "JARO_WINKLER",
                                      "targetField": "PARTNER_NAME",
                                      "text": "netflix",
                                      "threshold": 0.85,
                                      "strict": true
                                    }
                                  ]
                                }
                                """)
                            .with(authenticatedUser(testUser)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.totalMatchCount").value(1))
                    .andExpect(jsonPath("$.matchingTransactions", hasSize(1)))
                    .andExpect(jsonPath("$.matchingTransactions[0].partnerName").value("Netflix"));
        }

        @Test
        void detectsOverlappingPayments() throws Exception {
            // Create an existing payment with a rule that matches Netflix
            RecurringPayment existing = seedRecurringPayment("Netflix Subscription", "MONTHLY", "-12.99", false);
            Rule rule = new Rule();
            rule.setRecurringPayment(existing);
            rule.setRuleType(RuleType.JARO_WINKLER);
            rule.setTargetField(TargetField.PARTNER_NAME);
            rule.setText("netflix");
            rule.setThreshold(0.85);
            rule.setStrict(true);
            rule.setUser(testUser);
            ruleRepository.save(rule);

            // Seed an unlinked Netflix transaction
            seedTransaction("Netflix", LocalDate.now().minusDays(10), "-12.99");

            mockMvc.perform(post(RECURRING_URL + "/simulate")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                {
                                  "rules": [
                                    {
                                      "ruleType": "JARO_WINKLER",
                                      "targetField": "PARTNER_NAME",
                                      "text": "netflix",
                                      "threshold": 0.85,
                                      "strict": true
                                    }
                                  ]
                                }
                                """)
                            .with(authenticatedUser(testUser)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.overlappingPayments", hasSize(1)))
                    .andExpect(jsonPath("$.overlappingPayments[0].name").value("Netflix Subscription"));
        }

        @Test
        void detectsOverlapViaLinkedTransactions() throws Exception {
            // Create an existing payment with a linked Netflix transaction (no unlinked ones)
            RecurringPayment existing = seedRecurringPayment("Netflix Subscription", "MONTHLY", "-12.99", false);
            Transaction linkedTx = seedTransaction("Netflix", LocalDate.now().minusDays(10), "-12.99");
            seedLink(linkedTx, existing);

            // Seed an unlinked Spotify transaction so the simulation has something to match
            seedTransaction("Spotify", LocalDate.now().minusDays(5), "-9.99");

            // Simulate rules that would match Netflix (which is already linked to the existing payment)
            mockMvc.perform(post(RECURRING_URL + "/simulate")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                {
                                  "rules": [
                                    {
                                      "ruleType": "JARO_WINKLER",
                                      "targetField": "PARTNER_NAME",
                                      "text": "netflix",
                                      "threshold": 0.85,
                                      "strict": true
                                    }
                                  ]
                                }
                                """)
                            .with(authenticatedUser(testUser)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.matchingTransactions", hasSize(0)))
                    .andExpect(jsonPath("$.overlappingPayments", hasSize(1)))
                    .andExpect(jsonPath("$.overlappingPayments[0].name").value("Netflix Subscription"));
        }
    }

    // ────────────────────────────────────────────────────────────────────
    // PaymentType in DTO
    // ────────────────────────────────────────────────────────────────────

    @Nested
    class PaymentTypeInDto {

        @Test
        void returnsPaymentTypeInGetResponse() throws Exception {
            seedRecurringPayment("Netflix", "MONTHLY", "-12.99", false);

            mockMvc.perform(get(RECURRING_URL).with(authenticatedUser(testUser)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$[0].paymentType").value("RECURRING"));
        }

        @Test
        void groupedPaymentTypeIsReturned() throws Exception {
            RecurringPayment payment = seedRecurringPayment("Groceries", "MONTHLY", "-200", false);
            payment.setPaymentType(PaymentType.GROUPED);
            recurringPaymentRepository.save(payment);

            mockMvc.perform(get(RECURRING_URL).with(authenticatedUser(testUser)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$[0].paymentType").value("GROUPED"));
        }
    }

    // ────────────────────────────────────────────────────────────────────
    // End-to-end: CSV upload triggers detection
    // ────────────────────────────────────────────────────────────────────

    @Nested
    class EndToEndDetection {

        @Test
        void csvUploadTriggersRecurringPaymentDetection() throws Exception {
            // Build CSV with monthly Netflix transactions over 3 months
            String header = "Buchungsdatum;Partnername;Betrag";
            String row1 = "15.01.2025;Netflix;-12,99";
            String row2 = "15.02.2025;Netflix;-12,99";
            String row3 = "15.03.2025;Netflix;-12,99";
            // Add salary (monthly income)
            String row4 = "01.01.2025;Arbeitgeber GmbH;3500,00";
            String row5 = "01.02.2025;Arbeitgeber GmbH;3500,00";
            String row6 = "01.03.2025;Arbeitgeber GmbH;3500,00";
            // Add one-off (should not create recurring)
            String row7 = "10.02.2025;Amazon;-45,99";

            byte[] csvBytes = CsvMother.bytes(header, row1, row2, row3, row4, row5, row6, row7);
            MockMultipartFile file = new MockMultipartFile("file", "export.csv", "text/csv", csvBytes);

            mockMvc.perform(multipart("/api/transactions/csv").file(file).with(authenticatedUser(testUser)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.transactionCount").value(7))
                    .andExpect(jsonPath("$.recurringPaymentsDetected").value(2));

            // Verify recurring payments were persisted
            mockMvc.perform(get(RECURRING_URL).with(authenticatedUser(testUser)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$", hasSize(2)))
                    .andExpect(jsonPath("$[*].frequency", everyItem(is("MONTHLY"))));
        }

        @Test
        void csvUploadWithNoRecurringPatterns() throws Exception {
            String header = "Buchungsdatum;Partnername;Betrag";
            String row1 = "15.01.2025;Amazon;-12,99";
            String row2 = "20.02.2025;REWE;-45,00";

            byte[] csvBytes = CsvMother.bytes(header, row1, row2);
            MockMultipartFile file = new MockMultipartFile("file", "export.csv", "text/csv", csvBytes);

            mockMvc.perform(multipart("/api/transactions/csv").file(file).with(authenticatedUser(testUser)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.recurringPaymentsDetected").value(0));
        }

        @Test
        void secondUploadAddsNewRecurringPaymentIncrementally() throws Exception {
            // First upload: Netflix monthly
            String header = "Buchungsdatum;Partnername;Betrag";
            byte[] csv1 = CsvMother.bytes(header,
                    "15.01.2025;Netflix;-12,99",
                    "15.02.2025;Netflix;-12,99",
                    "15.03.2025;Netflix;-12,99");
            MockMultipartFile file1 = new MockMultipartFile("file", "export1.csv", "text/csv", csv1);

            mockMvc.perform(multipart("/api/transactions/csv").file(file1).with(authenticatedUser(testUser)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.recurringPaymentsDetected").value(1));

            // Second upload: adds Spotify monthly — incremental detection creates new RT
            byte[] csv2 = CsvMother.bytes(header,
                    "05.01.2025;Spotify;-9,99",
                    "05.02.2025;Spotify;-9,99",
                    "05.03.2025;Spotify;-9,99");
            MockMultipartFile file2 = new MockMultipartFile("file", "export2.csv", "text/csv", csv2);

            mockMvc.perform(multipart("/api/transactions/csv").file(file2).with(authenticatedUser(testUser)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.recurringPaymentsDetected").value(1));

            // Should have exactly 2 recurring payments total (Netflix from first, Spotify from second)
            mockMvc.perform(get(RECURRING_URL).with(authenticatedUser(testUser)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$", hasSize(2)));
        }
    }

    // ────────────────────────────────────────────────────────────────────
    // GET /api/recurring-payments/{id}/history
    // ────────────────────────────────────────────────────────────────────

    @Nested
    class GetRecurringPaymentHistory {

        @Test
        void returnsHistoryForPaymentWithLinkedTransactions() throws Exception {
            RecurringPayment payment = seedRecurringPayment("Netflix", "MONTHLY", "-12.99", false);
            Transaction tx1 = seedTransaction("Netflix", LocalDate.of(2025, 1, 15), "-12.99");
            Transaction tx2 = seedTransaction("Netflix", LocalDate.of(2025, 2, 15), "-12.99");
            Transaction tx3 = seedTransaction("Netflix", LocalDate.of(2025, 3, 15), "-12.99");
            seedLink(tx1, payment);
            seedLink(tx2, payment);
            seedLink(tx3, payment);

            // Seed history entries
            seedHistory(payment, LocalDate.of(2025, 1, 1), LocalDate.of(2025, 1, 31), "-12.99");
            seedHistory(payment, LocalDate.of(2025, 2, 1), LocalDate.of(2025, 2, 28), "-12.99");
            seedHistory(payment, LocalDate.of(2025, 3, 1), LocalDate.of(2025, 3, 31), "-12.99");

            mockMvc.perform(get(RECURRING_URL + "/{id}/history", payment.getId()).with(authenticatedUser(testUser)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$", hasSize(3)))
                    .andExpect(jsonPath("$[0].periodStart").value("2025-01-01"))
                    .andExpect(jsonPath("$[0].periodEnd").value("2025-01-31"))
                    .andExpect(jsonPath("$[0].amount").value(-12.99))
                    .andExpect(jsonPath("$[1].periodStart").value("2025-02-01"))
                    .andExpect(jsonPath("$[2].periodStart").value("2025-03-01"));
        }

        @Test
        void returnsEmptyListForPaymentWithNoHistory() throws Exception {
            RecurringPayment payment = seedRecurringPayment("Netflix", "MONTHLY", "-12.99", false);

            mockMvc.perform(get(RECURRING_URL + "/{id}/history", payment.getId()).with(authenticatedUser(testUser)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$", hasSize(0)));
        }
    }

    // ────────────────────────────────────────────────────────────────────
    // Test helpers
    // ────────────────────────────────────────────────────────────────────

    private RecurringPayment seedRecurringPayment(String name, String frequency, String amount, boolean isIncome) {
        RecurringPayment payment = new RecurringPayment();
        payment.setName(name);
        payment.setNormalizedName(name.toLowerCase());
        payment.setAverageAmount(new BigDecimal(amount));
        payment.setFrequency(frequency);
        payment.setIsIncome(isIncome);
        payment.setIsActive(true);
        payment.setUser(testUser);
        return recurringPaymentRepository.save(payment);
    }

    private Transaction seedTransaction(String partnerName, LocalDate date, String amount) {
        FileUpload upload = FileUploadMother.csvUpload();
        upload.setUser(testUser);
        upload = fileUploadRepository.save(upload);
        Transaction tx = new Transaction();
        tx.setPartnerName(partnerName);
        tx.setBookingDate(date);
        tx.setAmount(new BigDecimal(amount));
        tx.setUpload(upload);
        tx.setUser(testUser);
        return transactionRepository.save(tx);
    }

    private void seedLink(Transaction tx, RecurringPayment payment) {
        TransactionRecurringLink link = new TransactionRecurringLink();
        link.setTransaction(tx);
        link.setRecurringPayment(payment);
        link.setConfidenceScore(new BigDecimal("0.95"));
        link.setUser(testUser);
        linkRepository.save(link);
    }

    private void seedHistory(RecurringPayment payment, LocalDate periodStart, LocalDate periodEnd, String amount) {
        PaymentPeriodHistory history = new PaymentPeriodHistory();
        history.setRecurringPayment(payment);
        history.setPeriodStart(periodStart);
        history.setPeriodEnd(periodEnd);
        history.setAmount(new BigDecimal(amount));
        history.setUser(testUser);
        historyRepository.save(history);
    }
}
