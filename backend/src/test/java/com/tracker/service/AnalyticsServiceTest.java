package com.tracker.service;

import com.tracker.model.entity.Category;
import com.tracker.model.entity.Frequency;
import com.tracker.model.entity.RecurringPayment;
import com.tracker.model.entity.Transaction;
import com.tracker.model.entity.TransactionRecurringLink;
import com.tracker.repository.RecurringPaymentRepository;
import com.tracker.repository.TransactionRecurringLinkRepository;
import com.tracker.repository.TransactionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AnalyticsServiceTest {

    @Mock
    private TransactionRepository transactionRepository;
    @Mock
    private RecurringPaymentRepository recurringPaymentRepository;
    @Mock
    private TransactionRecurringLinkRepository linkRepository;
    @Mock
    private UserContextService userContextService;

    private AnalyticsService analyticsService;
    private UUID userId;

    @BeforeEach
    void setUp() {
        analyticsService = new AnalyticsService(
                transactionRepository,
                recurringPaymentRepository,
                linkRepository,
                userContextService
        );
        userId = UUID.randomUUID();
        when(userContextService.getCurrentUserId()).thenReturn(userId);
    }

    @Test
    void getAnnualOverview_groupsCategoriesAndIgnoresIncomeAndOutOfYearLinks() {
        RecurringPayment rent = payment("Rent", Frequency.MONTHLY, false, "1200.00", category("Housing", "#111111"));
        RecurringPayment gym = payment("Gym", Frequency.MONTHLY, false, "50.00", null);
        RecurringPayment salary = payment("Salary", Frequency.MONTHLY, true, "3000.00", category("Income", "#00ff00"));
        RecurringPayment orphan = payment("Unused", Frequency.MONTHLY, false, "10.00", category("Ignored", "#cccccc"));

        List<Transaction> transactions = List.of(
                transaction(LocalDate.of(2025, 1, 3), "Salary", "3000.00"),
                transaction(LocalDate.of(2025, 1, 5), "Groceries", "-100.00"),
                transaction(LocalDate.of(2025, 2, 1), "Rent", "-1200.00")
        );

        when(transactionRepository.findByUserIdAndBookingDateBetweenAndIsInterAccountFalse(
                userId, LocalDate.of(2025, 1, 1), LocalDate.of(2025, 12, 31)))
                .thenReturn(transactions);
        when(recurringPaymentRepository.findByUserIdAndIsActiveTrue(userId))
                .thenReturn(List.of(rent, gym, salary, orphan));
        when(linkRepository.findWithTransactionByRecurringPaymentId(rent.getId()))
                .thenReturn(List.of(
                        link(transaction(LocalDate.of(2025, 2, 1), "Rent", "-1200.00")),
                        link(transaction(LocalDate.of(2024, 12, 1), "Rent", "-1200.00"))
                ));
        when(linkRepository.findWithTransactionByRecurringPaymentId(gym.getId()))
                .thenReturn(List.of(link(transaction(LocalDate.of(2025, 2, 10), "Gym", "-50.00"))));
        when(linkRepository.findWithTransactionByRecurringPaymentId(salary.getId()))
                .thenReturn(List.of(link(transaction(LocalDate.of(2025, 1, 3), "Salary", "3000.00"))));
        when(linkRepository.findWithTransactionByRecurringPaymentId(orphan.getId()))
                .thenReturn(List.of());

        AnalyticsService.AnnualOverviewResult result = analyticsService.getAnnualOverview(2025);

        assertThat(result.totalIncome()).isEqualByComparingTo("3000.00");
        assertThat(result.totalExpenses()).isEqualByComparingTo("1300.00");
        assertThat(result.totalRecurringExpenses()).isEqualByComparingTo("1250.00");
        assertThat(result.monthlyBreakdown()).hasSize(12);
        assertThat(result.monthlyBreakdown().get(0).income()).isEqualByComparingTo("3000.00");
        assertThat(result.monthlyBreakdown().get(0).expenses()).isEqualByComparingTo("100.00");
        assertThat(result.monthlyBreakdown().get(1).recurringExpenses()).isEqualByComparingTo("1250.00");
        assertThat(result.byCategory())
                .extracting(AnalyticsService.CategoryBreakdownResult::category)
                .containsExactly("Housing", "Uncategorized");
        assertThat(result.byCategory().get(0).percentage()).isEqualTo(96.0);
        assertThat(result.byCategory().get(0).color()).isEqualTo("#111111");
        assertThat(result.byCategory().get(1).percentage()).isEqualTo(4.0);
        assertThat(result.recurringPayments())
                .extracting(AnalyticsService.RecurringPaymentSummaryResult::name)
                .containsExactly("Rent", "Gym");
        assertThat(result.recurringPayments().get(0).annualAmount()).isEqualByComparingTo("1200.00");
        assertThat(result.recurringPayments().get(0).monthlyAmount()).isEqualByComparingTo("100.00");
    }

    @Test
    void getPredictions_generatesMonthlyEquivalentsForDifferentFrequenciesAndSkipsUnlinkedPayments() {
        RecurringPayment monthlyExpense = payment("Internet", Frequency.MONTHLY, false, "-45.00", null);
        RecurringPayment quarterlyIncome = payment("Bonus", Frequency.QUARTERLY, true, "900.00", null);
        RecurringPayment yearlyExpense = payment("Insurance", Frequency.YEARLY, false, "-1200.00", null);
        RecurringPayment withoutLinks = payment("Ghost", Frequency.MONTHLY, false, "-10.00", null);

        when(recurringPaymentRepository.findByUserIdAndIsActiveTrue(userId))
                .thenReturn(List.of(monthlyExpense, quarterlyIncome, yearlyExpense, withoutLinks));
        when(linkRepository.findWithTransactionByRecurringPaymentId(monthlyExpense.getId()))
                .thenReturn(List.of(link(transaction(LocalDate.now().minusDays(10), "Internet", "-45.00"))));
        when(linkRepository.findWithTransactionByRecurringPaymentId(quarterlyIncome.getId()))
                .thenReturn(List.of(link(transaction(LocalDate.now().minusMonths(1), "Bonus", "900.00"))));
        when(linkRepository.findWithTransactionByRecurringPaymentId(yearlyExpense.getId()))
                .thenReturn(List.of(link(transaction(LocalDate.now().minusMonths(2), "Insurance", "-1200.00"))));
        when(linkRepository.findWithTransactionByRecurringPaymentId(withoutLinks.getId()))
                .thenReturn(List.of());

        AnalyticsService.PredictionResult result = analyticsService.getPredictions(14);

        assertThat(result.predictions()).hasSize(14);
        assertThat(result.predictions()).allSatisfy(prediction -> {
            assertThat(prediction.expectedIncome()).isEqualByComparingTo("300.00");
            assertThat(prediction.expectedExpenses()).isEqualByComparingTo("155.00");
            assertThat(prediction.expectedSurplus()).isEqualByComparingTo("145.00");
        });
        assertThat(result.upcomingPayments())
                .extracting(AnalyticsService.UpcomingPaymentResult::name)
                .contains("Internet", "Bonus", "Insurance")
                .doesNotContain("Ghost");
        assertThat(result.upcomingPayments())
                .extracting(payment -> YearMonth.from(payment.date()))
                .isSorted();
    }

    private RecurringPayment payment(String name, Frequency frequency, boolean income, String averageAmount, Category category) {
        RecurringPayment payment = new RecurringPayment();
        payment.setId(UUID.randomUUID());
        payment.setName(name);
        payment.setFrequency(frequency);
        payment.setAverageAmount(new BigDecimal(averageAmount));
        payment.setIsIncome(income);
        payment.setCategory(category);
        payment.setIsActive(true);
        return payment;
    }

    private Category category(String name, String color) {
        Category category = new Category();
        category.setName(name);
        category.setColor(color);
        return category;
    }

    private Transaction transaction(LocalDate bookingDate, String partnerName, String amount) {
        Transaction transaction = new Transaction();
        transaction.setId(UUID.randomUUID());
        transaction.setBookingDate(bookingDate);
        transaction.setPartnerName(partnerName);
        transaction.setAmount(new BigDecimal(amount));
        return transaction;
    }

    private TransactionRecurringLink link(Transaction transaction) {
        TransactionRecurringLink link = new TransactionRecurringLink();
        link.setTransaction(transaction);
        return link;
    }
}
