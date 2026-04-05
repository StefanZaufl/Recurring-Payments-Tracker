package com.tracker.service;

import com.tracker.model.entity.RecurringPayment;
import com.tracker.model.entity.Transaction;
import com.tracker.model.entity.TransactionRecurringLink;
import com.tracker.repository.RecurringPaymentRepository;
import com.tracker.repository.TransactionRecurringLinkRepository;
import com.tracker.repository.TransactionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class AnalyticsService {

    private final TransactionRepository transactionRepository;
    private final RecurringPaymentRepository recurringPaymentRepository;
    private final TransactionRecurringLinkRepository linkRepository;
    private final UserContextService userContextService;

    public AnalyticsService(TransactionRepository transactionRepository,
                            RecurringPaymentRepository recurringPaymentRepository,
                            TransactionRecurringLinkRepository linkRepository,
                            UserContextService userContextService) {
        this.transactionRepository = transactionRepository;
        this.recurringPaymentRepository = recurringPaymentRepository;
        this.linkRepository = linkRepository;
        this.userContextService = userContextService;
    }

    @Transactional(readOnly = true)
    public AnnualOverviewResult getAnnualOverview(int year) {
        LocalDate startOfYear = LocalDate.of(year, 1, 1);
        LocalDate endOfYear = LocalDate.of(year, 12, 31);

        UUID currentUserId = userContextService.getCurrentUserId();
        List<Transaction> transactions = transactionRepository.findByUserIdAndBookingDateBetween(currentUserId, startOfYear, endOfYear);
        List<RecurringPayment> activePayments = recurringPaymentRepository.findByUserIdAndIsActiveTrue(currentUserId);

        // Presort transactions by month (index 0 = January, 11 = December)
        List<List<Transaction>> transactionsByMonth = new ArrayList<>(12);
        for (int i = 0; i < 12; i++) {
            transactionsByMonth.add(new ArrayList<>());
        }
        for (Transaction tx : transactions) {
            transactionsByMonth.get(tx.getBookingDate().getMonthValue() - 1).add(tx);
        }

        // Calculate monthly breakdown from presorted buckets
        List<MonthlyBreakdownResult> monthlyBreakdown = new ArrayList<>();
        for (int month = 1; month <= 12; month++) {
            List<Transaction> monthTransactions = transactionsByMonth.get(month - 1);

            BigDecimal income = BigDecimal.ZERO;
            BigDecimal expenses = BigDecimal.ZERO;
            for (Transaction tx : monthTransactions) {
                if (tx.getAmount().compareTo(BigDecimal.ZERO) > 0) {
                    income = income.add(tx.getAmount());
                } else if (tx.getAmount().compareTo(BigDecimal.ZERO) < 0) {
                    expenses = expenses.add(tx.getAmount());
                }
            }
            expenses = expenses.abs();

            monthlyBreakdown.add(new MonthlyBreakdownResult(month, income, expenses, income.subtract(expenses)));
        }

        // Total income and expenses for the year
        BigDecimal totalIncome = monthlyBreakdown.stream()
                .map(MonthlyBreakdownResult::income)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalExpenses = monthlyBreakdown.stream()
                .map(MonthlyBreakdownResult::expenses)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // Build map of recurring payment ID -> total amount from linked transactions within the year
        Map<UUID, BigDecimal> yearTotalByPayment = new HashMap<>();
        for (RecurringPayment payment : activePayments) {
            BigDecimal paymentTotal = BigDecimal.ZERO;
            List<TransactionRecurringLink> links = linkRepository.findByRecurringPaymentId(payment.getId());
            for (TransactionRecurringLink link : links) {
                LocalDate date = link.getTransaction().getBookingDate();
                if (!date.isBefore(startOfYear) && !date.isAfter(endOfYear)) {
                    paymentTotal = paymentTotal.add(link.getTransaction().getAmount().abs());
                }
            }
            if (paymentTotal.compareTo(BigDecimal.ZERO) > 0) {
                yearTotalByPayment.put(payment.getId(), paymentTotal);
            }
        }

        // Recurring expenses total
        BigDecimal totalRecurringExpenses = BigDecimal.ZERO;
        for (RecurringPayment payment : activePayments) {
            if (Boolean.TRUE.equals(payment.getIsIncome())) continue;
            BigDecimal amount = yearTotalByPayment.getOrDefault(payment.getId(), BigDecimal.ZERO);
            totalRecurringExpenses = totalRecurringExpenses.add(amount);
        }

        // Category breakdown (expenses only, from linked transactions within the year)
        Map<String, BigDecimal> categoryTotals = new LinkedHashMap<>();
        Map<String, String> categoryColors = new LinkedHashMap<>();
        for (RecurringPayment payment : activePayments) {
            if (Boolean.TRUE.equals(payment.getIsIncome())) continue;

            BigDecimal amount = yearTotalByPayment.getOrDefault(payment.getId(), BigDecimal.ZERO);
            if (amount.compareTo(BigDecimal.ZERO) == 0) continue;

            String categoryName = payment.getCategory() != null ? payment.getCategory().getName() : "Uncategorized";
            categoryTotals.merge(categoryName, amount, BigDecimal::add);
            if (!categoryColors.containsKey(categoryName) && payment.getCategory() != null) {
                categoryColors.put(categoryName, payment.getCategory().getColor());
            }
        }

        BigDecimal categoryTotal = categoryTotals.values().stream()
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        List<CategoryBreakdownResult> byCategory = categoryTotals.entrySet().stream()
                .map(e -> {
                    double percentage = categoryTotal.compareTo(BigDecimal.ZERO) > 0
                            ? e.getValue().multiply(BigDecimal.valueOf(100))
                                .divide(categoryTotal, 2, RoundingMode.HALF_UP).doubleValue()
                            : 0.0;
                    return new CategoryBreakdownResult(e.getKey(), e.getValue(), percentage, categoryColors.get(e.getKey()));
                })
                .sorted(Comparator.comparing(CategoryBreakdownResult::total).reversed())
                .toList();

        // Recurring payment summaries (only payments with transactions in the selected year)
        List<RecurringPaymentSummaryResult> recurringPaymentSummaries = activePayments.stream()
                .filter(p -> !Boolean.TRUE.equals(p.getIsIncome()))
                .filter(p -> yearTotalByPayment.containsKey(p.getId()))
                .map(p -> {
                    BigDecimal annualAmount = yearTotalByPayment.get(p.getId());
                    BigDecimal monthlyAmount = annualAmount.divide(BigDecimal.valueOf(12), 2, RoundingMode.HALF_UP);
                    String categoryName = p.getCategory() != null ? p.getCategory().getName() : "Uncategorized";
                    return new RecurringPaymentSummaryResult(p.getName(), monthlyAmount, annualAmount, categoryName);
                })
                .sorted(Comparator.comparing(RecurringPaymentSummaryResult::annualAmount).reversed())
                .toList();

        return new AnnualOverviewResult(totalIncome, totalExpenses, totalRecurringExpenses,
                monthlyBreakdown, byCategory, recurringPaymentSummaries);
    }

    @Transactional(readOnly = true)
    public PredictionResult getPredictions(int months) {
        List<RecurringPayment> activePayments = recurringPaymentRepository.findByUserIdAndIsActiveTrue(userContextService.getCurrentUserId());
        LocalDate today = LocalDate.now();

        // Generate upcoming individual payments
        List<UpcomingPaymentResult> upcomingPayments = new ArrayList<>();
        for (RecurringPayment payment : activePayments) {
            List<TransactionRecurringLink> links = linkRepository.findByRecurringPaymentId(payment.getId());
            if (links.isEmpty()) continue;

            LocalDate lastDate = links.stream()
                    .map(link -> link.getTransaction().getBookingDate())
                    .max(LocalDate::compareTo)
                    .orElse(today);

            List<LocalDate> nextDates = predictNextDates(lastDate, payment.getFrequency(), months);
            for (LocalDate nextDate : nextDates) {
                if (!nextDate.isAfter(today.plusMonths(months))) {
                    upcomingPayments.add(new UpcomingPaymentResult(
                            payment.getName(), nextDate, payment.getAverageAmount()));
                }
            }
        }
        upcomingPayments.sort(Comparator.comparing(UpcomingPaymentResult::date));

        // Generate monthly predictions
        List<MonthlyPredictionResult> predictions = new ArrayList<>();
        for (int i = 0; i < months; i++) {
            YearMonth ym = YearMonth.from(today).plusMonths(i + 1);
            String monthLabel = ym.toString(); // e.g. "2026-05"

            BigDecimal expectedIncome = BigDecimal.ZERO;
            BigDecimal expectedExpenses = BigDecimal.ZERO;

            for (RecurringPayment payment : activePayments) {
                BigDecimal monthlyEquivalent = monthlyEquivalent(payment.getAverageAmount().abs(), payment.getFrequency());
                if (Boolean.TRUE.equals(payment.getIsIncome())) {
                    expectedIncome = expectedIncome.add(monthlyEquivalent);
                } else {
                    expectedExpenses = expectedExpenses.add(monthlyEquivalent);
                }
            }

            predictions.add(new MonthlyPredictionResult(
                    monthLabel, expectedIncome, expectedExpenses, expectedIncome.subtract(expectedExpenses)));
        }

        return new PredictionResult(predictions, upcomingPayments);
    }

    private BigDecimal annualizeAmount(BigDecimal amount, String frequency) {
        return switch (frequency) {
            case "MONTHLY" -> amount.multiply(BigDecimal.valueOf(12));
            case "QUARTERLY" -> amount.multiply(BigDecimal.valueOf(4));
            case "YEARLY" -> amount;
            default -> amount.multiply(BigDecimal.valueOf(12));
        };
    }

    private BigDecimal monthlyEquivalent(BigDecimal amount, String frequency) {
        return switch (frequency) {
            case "MONTHLY" -> amount;
            case "QUARTERLY" -> amount.divide(BigDecimal.valueOf(3), 2, RoundingMode.HALF_UP);
            case "YEARLY" -> amount.divide(BigDecimal.valueOf(12), 2, RoundingMode.HALF_UP);
            default -> amount;
        };
    }

    private List<LocalDate> predictNextDates(LocalDate lastDate, String frequency, int monthsAhead) {
        List<LocalDate> dates = new ArrayList<>();
        LocalDate next = lastDate;
        LocalDate limit = LocalDate.now().plusMonths(monthsAhead);
        for (int i = 0; i < 100; i++) {
            next = switch (frequency) {
                case "MONTHLY" -> next.plusMonths(1);
                case "QUARTERLY" -> next.plusMonths(3);
                case "YEARLY" -> next.plusYears(1);
                default -> next.plusMonths(1);
            };
            if (next.isAfter(limit)) break;
            if (next.isAfter(LocalDate.now())) {
                dates.add(next);
            }
        }
        return dates;
    }

    // Result records
    public record AnnualOverviewResult(
            BigDecimal totalIncome,
            BigDecimal totalExpenses,
            BigDecimal totalRecurringExpenses,
            List<MonthlyBreakdownResult> monthlyBreakdown,
            List<CategoryBreakdownResult> byCategory,
            List<RecurringPaymentSummaryResult> recurringPayments) {}

    public record MonthlyBreakdownResult(int month, BigDecimal income, BigDecimal expenses, BigDecimal surplus) {}

    public record CategoryBreakdownResult(String category, BigDecimal total, double percentage, String color) {}

    public record RecurringPaymentSummaryResult(String name, BigDecimal monthlyAmount,
                                                 BigDecimal annualAmount, String category) {}

    public record PredictionResult(List<MonthlyPredictionResult> predictions,
                                    List<UpcomingPaymentResult> upcomingPayments) {}

    public record MonthlyPredictionResult(String month, BigDecimal expectedIncome,
                                           BigDecimal expectedExpenses, BigDecimal expectedSurplus) {}

    public record UpcomingPaymentResult(String name, LocalDate date, BigDecimal amount) {}
}
