package com.tracker.controller;

import com.tracker.model.entity.FileUpload;
import com.tracker.model.entity.RecurringPayment;
import com.tracker.model.entity.Transaction;
import com.tracker.model.entity.TransactionRecurringLink;
import com.tracker.repository.*;
import com.tracker.testutil.CsvMother;
import com.tracker.testutil.FileUploadMother;
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

    @BeforeEach
    void setUp() {
        linkRepository.deleteAll();
        recurringPaymentRepository.deleteAll();
        transactionRepository.deleteAll();
        fileUploadRepository.deleteAll();
        categoryRepository.deleteAll();
    }

    // ────────────────────────────────────────────────────────────────────
    // GET /api/recurring-payments
    // ────────────────────────────────────────────────────────────────────

    @Nested
    class GetRecurringPayments {

        @Test
        void returnsEmptyListWhenNoneExist() throws Exception {
            mockMvc.perform(get(RECURRING_URL))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$", hasSize(0)));
        }

        @Test
        void returnsAllRecurringPayments() throws Exception {
            seedRecurringPayment("Netflix", "MONTHLY", "-12.99", false);
            seedRecurringPayment("Salary", "MONTHLY", "3500.00", true);

            mockMvc.perform(get(RECURRING_URL))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$", hasSize(2)))
                    .andExpect(jsonPath("$[*].name", containsInAnyOrder("Netflix", "Salary")));
        }

        @Test
        void returnsCorrectDtoFields() throws Exception {
            RecurringPayment payment = seedRecurringPayment("Netflix", "MONTHLY", "-12.99", false);

            mockMvc.perform(get(RECURRING_URL))
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
                            .content("{\"name\": \"Netflix Premium\"}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.name").value("Netflix Premium"));
        }

        @Test
        void updatesIsActive() throws Exception {
            RecurringPayment payment = seedRecurringPayment("Netflix", "MONTHLY", "-12.99", false);

            mockMvc.perform(put(RECURRING_URL + "/{id}", payment.getId())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"isActive\": false}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.isActive").value(false));
        }

        @Test
        void returns404ForNonExistentId() throws Exception {
            mockMvc.perform(put(RECURRING_URL + "/{id}", UUID.randomUUID())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"name\": \"Test\"}"))
                    .andExpect(status().isNotFound());
        }

        @Test
        void partialUpdatePreservesOtherFields() throws Exception {
            RecurringPayment payment = seedRecurringPayment("Netflix", "MONTHLY", "-12.99", false);

            mockMvc.perform(put(RECURRING_URL + "/{id}", payment.getId())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"name\": \"Netflix HD\"}"))
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

            mockMvc.perform(get(RECURRING_URL + "/{id}/transactions", payment.getId()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$", hasSize(2)))
                    .andExpect(jsonPath("$[*].partnerName", everyItem(is("Netflix"))));
        }

        @Test
        void returnsEmptyListWhenNoLinkedTransactions() throws Exception {
            RecurringPayment payment = seedRecurringPayment("Netflix", "MONTHLY", "-12.99", false);

            mockMvc.perform(get(RECURRING_URL + "/{id}/transactions", payment.getId()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$", hasSize(0)));
        }

        @Test
        void returns404ForNonExistentPayment() throws Exception {
            mockMvc.perform(get(RECURRING_URL + "/{id}/transactions", UUID.randomUUID()))
                    .andExpect(status().isNotFound());
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

            mockMvc.perform(multipart("/api/transactions/csv").file(file))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.transactionCount").value(7))
                    .andExpect(jsonPath("$.recurringPaymentsDetected").value(2));

            // Verify recurring payments were persisted
            mockMvc.perform(get(RECURRING_URL))
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

            mockMvc.perform(multipart("/api/transactions/csv").file(file))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.recurringPaymentsDetected").value(0));
        }

        @Test
        void secondUploadReplacesDetectedPayments() throws Exception {
            // First upload: Netflix monthly
            String header = "Buchungsdatum;Partnername;Betrag";
            byte[] csv1 = CsvMother.bytes(header,
                    "15.01.2025;Netflix;-12,99",
                    "15.02.2025;Netflix;-12,99",
                    "15.03.2025;Netflix;-12,99");
            MockMultipartFile file1 = new MockMultipartFile("file", "export1.csv", "text/csv", csv1);

            mockMvc.perform(multipart("/api/transactions/csv").file(file1))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.recurringPaymentsDetected").value(1));

            // Second upload: adds Spotify monthly, detection should re-run on all transactions
            byte[] csv2 = CsvMother.bytes(header,
                    "05.01.2025;Spotify;-9,99",
                    "05.02.2025;Spotify;-9,99",
                    "05.03.2025;Spotify;-9,99");
            MockMultipartFile file2 = new MockMultipartFile("file", "export2.csv", "text/csv", csv2);

            mockMvc.perform(multipart("/api/transactions/csv").file(file2))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.recurringPaymentsDetected").value(2));

            // Should have exactly 2 recurring payments total (not 3)
            mockMvc.perform(get(RECURRING_URL))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$", hasSize(2)));
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
        return recurringPaymentRepository.save(payment);
    }

    private Transaction seedTransaction(String partnerName, LocalDate date, String amount) {
        FileUpload upload = fileUploadRepository.save(FileUploadMother.csvUpload());
        Transaction tx = new Transaction();
        tx.setPartnerName(partnerName);
        tx.setBookingDate(date);
        tx.setAmount(new BigDecimal(amount));
        tx.setUpload(upload);
        return transactionRepository.save(tx);
    }

    private void seedLink(Transaction tx, RecurringPayment payment) {
        TransactionRecurringLink link = new TransactionRecurringLink();
        link.setTransaction(tx);
        link.setRecurringPayment(payment);
        link.setConfidenceScore(new BigDecimal("0.95"));
        linkRepository.save(link);
    }
}
