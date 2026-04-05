package com.tracker.controller;

import com.tracker.model.entity.*;
import com.tracker.repository.*;
import com.tracker.testutil.SecurityTestUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.LocalDate;

import static com.tracker.testutil.SecurityTestUtil.authenticatedUser;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AnalyticsControllerTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private TransactionRepository transactionRepository;
    @Autowired private RecurringPaymentRepository recurringPaymentRepository;
    @Autowired private TransactionRecurringLinkRepository linkRepository;
    @Autowired private CategoryRepository categoryRepository;
    @Autowired private FileUploadRepository fileUploadRepository;
    @Autowired private UserRepository userRepository;

    private User testUser;

    @BeforeEach
    void setUp() {
        linkRepository.deleteAll();
        transactionRepository.deleteAll();
        recurringPaymentRepository.deleteAll();
        categoryRepository.deleteAll();
        fileUploadRepository.deleteAll();
        testUser = SecurityTestUtil.createTestUser(userRepository);
    }

    @Nested
    class GetAnnualOverview {

        @Test
        void returnsOverviewWithNoData() throws Exception {
            mockMvc.perform(get("/api/analytics/annual-overview").param("year", "2025").with(authenticatedUser(testUser)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.totalIncome").value(0.0))
                    .andExpect(jsonPath("$.totalExpenses").value(0.0))
                    .andExpect(jsonPath("$.totalRecurringExpenses").value(0.0))
                    .andExpect(jsonPath("$.monthlyBreakdown", hasSize(12)))
                    .andExpect(jsonPath("$.byCategory", hasSize(0)))
                    .andExpect(jsonPath("$.recurringPayments", hasSize(0)));
        }

        @Test
        void calculatesMonthlyBreakdownFromTransactions() throws Exception {
            FileUpload upload = seedUpload();
            seedTransaction(upload, LocalDate.of(2025, 3, 15), "Salary", new BigDecimal("3000.00"));
            seedTransaction(upload, LocalDate.of(2025, 3, 20), "Netflix", new BigDecimal("-12.99"));

            mockMvc.perform(get("/api/analytics/annual-overview").param("year", "2025").with(authenticatedUser(testUser)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.totalIncome").value(3000.0))
                    .andExpect(jsonPath("$.totalExpenses").value(12.99))
                    .andExpect(jsonPath("$.monthlyBreakdown[2].month").value(3))
                    .andExpect(jsonPath("$.monthlyBreakdown[2].income").value(3000.0))
                    .andExpect(jsonPath("$.monthlyBreakdown[2].expenses").value(12.99));
        }

        @Test
        void includesRecurringPaymentSummaries() throws Exception {
            Category category = seedCategory("Streaming");
            RecurringPayment payment = seedRecurringPayment("Netflix", "MONTHLY",
                    new BigDecimal("-12.99"), false, category);

            // Seed 12 monthly linked transactions for 2025 so recurring expenses total = 12 * 12.99 = 155.88
            FileUpload upload = seedUpload();
            for (int month = 1; month <= 12; month++) {
                Transaction tx = seedTransaction(upload, LocalDate.of(2025, month, 15),
                        "Netflix", new BigDecimal("-12.99"));
                seedLink(tx, payment);
            }

            mockMvc.perform(get("/api/analytics/annual-overview").param("year", "2025").with(authenticatedUser(testUser)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.totalRecurringExpenses").value(closeTo(155.88, 0.01)))
                    .andExpect(jsonPath("$.recurringPayments", hasSize(1)))
                    .andExpect(jsonPath("$.recurringPayments[0].name").value("Netflix"))
                    .andExpect(jsonPath("$.recurringPayments[0].category").value("Streaming"))
                    .andExpect(jsonPath("$.byCategory", hasSize(1)))
                    .andExpect(jsonPath("$.byCategory[0].category").value("Streaming"))
                    .andExpect(jsonPath("$.byCategory[0].percentage").value(100.0));
        }
    }

    @Nested
    class GetPredictions {

        @Test
        void returnsEmptyPredictionsWithNoData() throws Exception {
            mockMvc.perform(get("/api/analytics/predictions").param("months", "3").with(authenticatedUser(testUser)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.predictions", hasSize(3)))
                    .andExpect(jsonPath("$.upcomingPayments", hasSize(0)));
        }

        @Test
        void returnsMonthlyPredictionsBasedOnRecurringPayments() throws Exception {
            seedRecurringPayment("Salary", "MONTHLY", new BigDecimal("3000.00"), true, null);
            seedRecurringPayment("Netflix", "MONTHLY", new BigDecimal("-12.99"), false, null);

            mockMvc.perform(get("/api/analytics/predictions").param("months", "3").with(authenticatedUser(testUser)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.predictions", hasSize(3)))
                    .andExpect(jsonPath("$.predictions[0].expectedIncome").value(3000.0))
                    .andExpect(jsonPath("$.predictions[0].expectedExpenses").value(12.99));
        }

        @Test
        void defaultsToSixMonths() throws Exception {
            mockMvc.perform(get("/api/analytics/predictions").with(authenticatedUser(testUser)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.predictions", hasSize(6)));
        }

        @Test
        void generatesUpcomingPayments() throws Exception {
            RecurringPayment payment = seedRecurringPayment("Netflix", "MONTHLY",
                    new BigDecimal("-12.99"), false, null);
            FileUpload upload = seedUpload();
            Transaction tx = seedTransaction(upload, LocalDate.now().minusDays(10), "Netflix",
                    new BigDecimal("-12.99"));
            seedLink(tx, payment);

            mockMvc.perform(get("/api/analytics/predictions").param("months", "3").with(authenticatedUser(testUser)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.upcomingPayments", hasSize(greaterThanOrEqualTo(1))))
                    .andExpect(jsonPath("$.upcomingPayments[0].name").value("Netflix"));
        }
    }

    // ── Helpers ──

    private FileUpload seedUpload() {
        FileUpload upload = new FileUpload();
        upload.setFilename("test.csv");
        upload.setRowCount(0);
        upload.setUser(testUser);
        return fileUploadRepository.save(upload);
    }

    private Transaction seedTransaction(FileUpload upload, LocalDate date, String partner, BigDecimal amount) {
        Transaction tx = new Transaction();
        tx.setUpload(upload);
        tx.setBookingDate(date);
        tx.setPartnerName(partner);
        tx.setAmount(amount);
        tx.setUser(testUser);
        return transactionRepository.save(tx);
    }

    private Category seedCategory(String name) {
        Category category = new Category();
        category.setName(name);
        category.setColor("#FF0000");
        category.setUser(testUser);
        return categoryRepository.save(category);
    }

    private RecurringPayment seedRecurringPayment(String name, String frequency, BigDecimal amount,
                                                    boolean isIncome, Category category) {
        RecurringPayment payment = new RecurringPayment();
        payment.setName(name);
        payment.setNormalizedName(name.toLowerCase());
        payment.setFrequency(frequency);
        payment.setAverageAmount(amount);
        payment.setIsIncome(isIncome);
        payment.setIsActive(true);
        payment.setCategory(category);
        payment.setUser(testUser);
        return recurringPaymentRepository.save(payment);
    }

    private void seedLink(Transaction tx, RecurringPayment payment) {
        TransactionRecurringLink link = new TransactionRecurringLink();
        link.setTransaction(tx);
        link.setRecurringPayment(payment);
        link.setConfidenceScore(new BigDecimal("0.95"));
        link.setUser(testUser);
        linkRepository.save(link);
    }
}
