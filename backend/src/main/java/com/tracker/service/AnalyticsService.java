package com.tracker.service;

import com.tracker.model.entity.Frequency;
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
import java.time.temporal.ChronoUnit;
import java.util.*;

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
        List<Transaction> transactions = loadTransactions(currentUserId, startOfYear, endOfYear);
        List<RecurringPayment> activePayments = loadActivePayments(currentUserId);
        List<List<Transaction>> transactionsByMonth = bucketByMonth(transactions);
        RecurringTotals recurringTotals = summarizeRecurring(activePayments, startOfYear, endOfYear);
        List<MonthlyBreakdownResult> monthlyBreakdown = buildMonthlyBreakdown(transactionsByMonth, recurringTotals.monthlyExpenses());

        return new AnnualOverviewResult(
                sumIncome(monthlyBreakdown),
                sumExpenses(monthlyBreakdown),
                sumRecurringIncome(activePayments, recurringTotals.totalsByPayment()),
                sumRecurringExpenses(activePayments, recurringTotals.totalsByPayment()),
                monthlyBreakdown,
                buildCategoryBreakdown(activePayments, recurringTotals.totalsByPayment()),
                buildRecurringExpenseSummaries(activePayments, recurringTotals.totalsByPayment()),
                buildRecurringIncomeSummaries(activePayments, recurringTotals.totalsByPayment())
        );
    }

    @Transactional(readOnly = true)
    public PredictionResult getPredictions(int months) {
        UUID currentUserId = userContextService.getCurrentUserId();
        List<RecurringPayment> activePayments = recurringPaymentRepository.findByUserIdAndIsActiveTrue(currentUserId);
        LocalDate today = LocalDate.now();
        AdditionalBaseline additionalBaseline = additionalBaseline(currentUserId, today);

        return new PredictionResult(
                buildMonthlyPredictions(activePayments, additionalBaseline, today, months),
                buildUpcomingPayments(activePayments, today, months));
    }

    private List<UpcomingPaymentResult> buildUpcomingPayments(List<RecurringPayment> activePayments, LocalDate today, int months) {
        List<UpcomingPaymentResult> upcomingPayments = new ArrayList<>();
        for (RecurringPayment payment : activePayments) {
            List<TransactionRecurringLink> links = linkRepository.findWithTransactionByRecurringPaymentId(payment.getId());
            if (!links.isEmpty()) {
                addUpcomingPaymentDates(upcomingPayments, payment, links, today, months);
            }
        }
        upcomingPayments.sort(Comparator.comparing(UpcomingPaymentResult::date));
        return upcomingPayments;
    }

    private void addUpcomingPaymentDates(List<UpcomingPaymentResult> upcomingPayments, RecurringPayment payment,
                                         List<TransactionRecurringLink> links, LocalDate today, int months) {
        LocalDate lastDate = links.stream()
                .map(link -> link.getTransaction().getBookingDate())
                .max(LocalDate::compareTo)
                .orElse(today);

        for (LocalDate nextDate : predictNextDates(lastDate, payment.getFrequency(), months)) {
            if (!nextDate.isAfter(today.plusMonths(months)) && isOccurrenceWithinLifecycle(payment, nextDate)) {
                upcomingPayments.add(new UpcomingPaymentResult(payment.getName(), nextDate, payment.getAverageAmount()));
            }
        }
    }

    private List<MonthlyPredictionResult> buildMonthlyPredictions(List<RecurringPayment> activePayments,
                                                                  AdditionalBaseline additionalBaseline,
                                                                  LocalDate today,
                                                                  int months) {
        List<MonthlyPredictionResult> predictions = new ArrayList<>();
        for (int i = 0; i < months; i++) {
            YearMonth ym = YearMonth.from(today).plusMonths(i + 1);
            RecurringPredictionAmounts recurring = recurringPredictionAmounts(activePayments, ym);
            BigDecimal expectedIncome = recurring.income().add(additionalBaseline.income());
            BigDecimal expectedExpenses = recurring.expenses().add(additionalBaseline.expenses());

            predictions.add(new MonthlyPredictionResult(
                    ym.toString(),
                    expectedIncome,
                    expectedExpenses,
                    expectedIncome.subtract(expectedExpenses),
                    recurring.income(),
                    recurring.expenses(),
                    additionalBaseline.income(),
                    additionalBaseline.expenses()));
        }
        return predictions;
    }

    private RecurringPredictionAmounts recurringPredictionAmounts(List<RecurringPayment> activePayments, YearMonth month) {
        BigDecimal income = BigDecimal.ZERO;
        BigDecimal expenses = BigDecimal.ZERO;
        for (RecurringPayment payment : activePayments) {
            if (isActiveDuringMonth(payment, month)) {
                BigDecimal amount = monthlyEquivalent(payment.getAverageAmount().abs(), payment.getFrequency());
                if (Boolean.TRUE.equals(payment.getIsIncome())) {
                    income = income.add(amount);
                } else {
                    expenses = expenses.add(amount);
                }
            }
        }
        return new RecurringPredictionAmounts(income, expenses);
    }

    private BigDecimal annualizeAmount(BigDecimal amount, Frequency frequency) {
        return switch (frequency) {
            case MONTHLY -> amount.multiply(BigDecimal.valueOf(12));
            case QUARTERLY -> amount.multiply(BigDecimal.valueOf(4));
            case YEARLY -> amount;
        };
    }

    private List<Transaction> loadTransactions(UUID userId, LocalDate startOfYear, LocalDate endOfYear) {
        return transactionRepository.findByUserIdAndBookingDateBetweenAndIsInterAccountFalse(userId, startOfYear, endOfYear);
    }

    private List<RecurringPayment> loadActivePayments(UUID userId) {
        return recurringPaymentRepository.findByUserIdAndIsActiveTrue(userId);
    }

    private List<List<Transaction>> bucketByMonth(List<Transaction> transactions) {
        List<List<Transaction>> transactionsByMonth = new ArrayList<>(12);
        for (int i = 0; i < 12; i++) {
            transactionsByMonth.add(new ArrayList<>());
        }
        for (Transaction transaction : transactions) {
            transactionsByMonth.get(transaction.getBookingDate().getMonthValue() - 1).add(transaction);
        }
        return transactionsByMonth;
    }

    private RecurringTotals summarizeRecurring(List<RecurringPayment> activePayments, LocalDate startOfYear, LocalDate endOfYear) {
        List<BigDecimal> monthlyExpenses = new ArrayList<>(Collections.nCopies(12, BigDecimal.ZERO));

        Map<UUID, PaymentYearTotal> totalsByPayment = new HashMap<>();
        for (RecurringPayment payment : activePayments) {
            BigDecimal paymentTotal = BigDecimal.ZERO;
            List<TransactionRecurringLink> allLinks = linkRepository.findWithTransactionByRecurringPaymentId(payment.getId());
            List<TransactionRecurringLink> links = allLinks.stream()
                    .filter(link -> isWithin(link.getTransaction().getBookingDate(), startOfYear, endOfYear))
                    .toList();
            for (TransactionRecurringLink link : links) {
                LocalDate bookingDate = link.getTransaction().getBookingDate();
                BigDecimal amount = link.getTransaction().getAmount().abs();
                paymentTotal = paymentTotal.add(amount);
                if (!Boolean.TRUE.equals(payment.getIsIncome())) {
                    int monthIndex = bookingDate.getMonthValue() - 1;
                    monthlyExpenses.set(monthIndex, monthlyExpenses.get(monthIndex).add(amount));
                }
            }
            if (paymentTotal.compareTo(BigDecimal.ZERO) > 0) {
                totalsByPayment.put(payment.getId(), new PaymentYearTotal(paymentTotal, allLinks, startOfYear, endOfYear));
            }
        }

        return new RecurringTotals(totalsByPayment, monthlyExpenses);
    }

    private boolean isWithin(LocalDate date, LocalDate from, LocalDate to) {
        return !date.isBefore(from) && !date.isAfter(to);
    }

    private List<MonthlyBreakdownResult> buildMonthlyBreakdown(List<List<Transaction>> transactionsByMonth, List<BigDecimal> monthlyRecurringExpenses) {
        List<MonthlyBreakdownResult> monthlyBreakdown = new ArrayList<>();
        for (int month = 1; month <= 12; month++) {
            BigDecimal income = BigDecimal.ZERO;
            BigDecimal expenses = BigDecimal.ZERO;

            for (Transaction transaction : transactionsByMonth.get(month - 1)) {
                if (transaction.getAmount().compareTo(BigDecimal.ZERO) > 0) {
                    income = income.add(transaction.getAmount());
                } else if (transaction.getAmount().compareTo(BigDecimal.ZERO) < 0) {
                    expenses = expenses.add(transaction.getAmount());
                }
            }

            expenses = expenses.abs();
            monthlyBreakdown.add(new MonthlyBreakdownResult(
                    month,
                    income,
                    expenses,
                    income.subtract(expenses),
                    monthlyRecurringExpenses.get(month - 1)
            ));
        }
        return monthlyBreakdown;
    }

    private BigDecimal sumIncome(List<MonthlyBreakdownResult> monthlyBreakdown) {
        return monthlyBreakdown.stream()
                .map(MonthlyBreakdownResult::income)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private BigDecimal sumExpenses(List<MonthlyBreakdownResult> monthlyBreakdown) {
        return monthlyBreakdown.stream()
                .map(MonthlyBreakdownResult::expenses)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private BigDecimal sumRecurringIncome(List<RecurringPayment> activePayments, Map<UUID, PaymentYearTotal> totalsByPayment) {
        return sumRecurringByType(activePayments, totalsByPayment, true);
    }

    private BigDecimal sumRecurringExpenses(List<RecurringPayment> activePayments, Map<UUID, PaymentYearTotal> totalsByPayment) {
        return sumRecurringByType(activePayments, totalsByPayment, false);
    }

    private BigDecimal sumRecurringByType(List<RecurringPayment> activePayments, Map<UUID, PaymentYearTotal> totalsByPayment, boolean income) {
        BigDecimal total = BigDecimal.ZERO;
        for (RecurringPayment payment : activePayments) {
            if (Boolean.TRUE.equals(payment.getIsIncome()) != income) {
                continue;
            }
            PaymentYearTotal yearTotal = totalsByPayment.get(payment.getId());
            if (yearTotal != null) {
                total = total.add(yearTotal.amount());
            }
        }
        return total;
    }

    private List<CategoryBreakdownResult> buildCategoryBreakdown(List<RecurringPayment> activePayments, Map<UUID, PaymentYearTotal> totalsByPayment) {
        Map<CategoryKey, BigDecimal> categoryTotals = new LinkedHashMap<>();
        Map<CategoryKey, String> categoryNames = new LinkedHashMap<>();
        Map<CategoryKey, String> categoryColors = new LinkedHashMap<>();

        for (RecurringPayment payment : activePayments) {
            if (Boolean.TRUE.equals(payment.getIsIncome())) {
                continue;
            }

            PaymentYearTotal yearTotal = totalsByPayment.get(payment.getId());
            BigDecimal amount = yearTotal != null ? yearTotal.amount() : BigDecimal.ZERO;
            if (amount.compareTo(BigDecimal.ZERO) == 0) {
                continue;
            }

            String category = categoryName(payment);
            CategoryKey categoryKey = categoryKey(payment);
            categoryTotals.merge(categoryKey, amount, BigDecimal::add);
            categoryNames.putIfAbsent(categoryKey, category);
            if (!categoryColors.containsKey(categoryKey) && payment.getCategory() != null) {
                categoryColors.put(categoryKey, payment.getCategory().getColor());
            }
        }

        BigDecimal categoryTotal = categoryTotals.values().stream()
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return categoryTotals.entrySet().stream()
                .map(entry -> new CategoryBreakdownResult(
                        entry.getKey().id(),
                        categoryNames.get(entry.getKey()),
                        entry.getValue(),
                        toPercentage(entry.getValue(), categoryTotal),
                        categoryColors.get(entry.getKey())
                ))
                .sorted(Comparator.comparing(CategoryBreakdownResult::total).reversed())
                .toList();
    }

    private List<RecurringPaymentSummaryResult> buildRecurringExpenseSummaries(List<RecurringPayment> activePayments, Map<UUID, PaymentYearTotal> totalsByPayment) {
        return buildRecurringSummariesByType(activePayments, totalsByPayment, false);
    }

    private List<RecurringPaymentSummaryResult> buildRecurringIncomeSummaries(List<RecurringPayment> activePayments, Map<UUID, PaymentYearTotal> totalsByPayment) {
        return buildRecurringSummariesByType(activePayments, totalsByPayment, true);
    }

    private List<RecurringPaymentSummaryResult> buildRecurringSummariesByType(List<RecurringPayment> activePayments, Map<UUID, PaymentYearTotal> totalsByPayment, boolean income) {
        return activePayments.stream()
                .filter(payment -> Boolean.TRUE.equals(payment.getIsIncome()) == income)
                .filter(payment -> totalsByPayment.containsKey(payment.getId()))
                .map(payment -> toRecurringSummary(payment, totalsByPayment.get(payment.getId())))
                .sorted(Comparator.comparing(RecurringPaymentSummaryResult::annualAmount).reversed())
                .toList();
    }

    private RecurringPaymentSummaryResult toRecurringSummary(RecurringPayment payment, PaymentYearTotal yearTotal) {
        BigDecimal annualAmount = yearTotal.amount();
        BigDecimal coveredMonthEquivalent = coveredMonthEquivalent(payment, yearTotal);
        BigDecimal monthlyAmount = coveredMonthEquivalent.compareTo(BigDecimal.ZERO) > 0
                ? annualAmount.divide(coveredMonthEquivalent, 2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;
        return new RecurringPaymentSummaryResult(
                payment.getId(),
                payment.getName(),
                monthlyAmount,
                annualAmount,
                categoryName(payment)
        );
    }

    private BigDecimal coveredMonthEquivalent(RecurringPayment payment, PaymentYearTotal yearTotal) {
        List<LocalDate> dates = yearTotal.allLinks().stream()
                .map(TransactionRecurringLink::getTransaction)
                .map(Transaction::getBookingDate)
                .sorted()
                .toList();
        if (dates.isEmpty()) {
            return BigDecimal.ZERO;
        }

        LocalDate observedStart = dates.getFirst();
        LocalDate observedEnd = dates.getLast();
        LocalDate yearStart = yearTotal.startOfYear();
        LocalDate yearEnd = yearTotal.endOfYear();
        LocalDate overlapStart = observedStart.isAfter(yearStart) ? observedStart : yearStart;
        LocalDate overlapEnd = observedEnd.isBefore(yearEnd) ? observedEnd : yearEnd;
        if (overlapStart.isAfter(overlapEnd)) {
            return BigDecimal.ZERO;
        }

        Frequency frequency = payment.getFrequency() != null ? payment.getFrequency() : Frequency.MONTHLY;
        if (frequency == Frequency.MONTHLY) {
            long months = ChronoUnit.MONTHS.between(YearMonth.from(overlapStart), YearMonth.from(overlapEnd)) + 1;
            return BigDecimal.valueOf(months);
        }

        long distinctPeriods = dates.stream()
                .map(date -> PaymentPeriodHistoryService.computePeriodStart(date, frequency))
                .filter(periodStart -> periodsOverlap(
                        periodStart,
                        PaymentPeriodHistoryService.computePeriodEnd(periodStart, frequency),
                        overlapStart,
                        overlapEnd))
                .distinct()
                .count();
        return BigDecimal.valueOf(distinctPeriods * monthsPerPeriod(frequency));
    }

    private boolean periodsOverlap(LocalDate periodStart, LocalDate periodEnd, LocalDate from, LocalDate to) {
        return !periodStart.isAfter(to) && !periodEnd.isBefore(from);
    }

    private int monthsPerPeriod(Frequency frequency) {
        return switch (frequency) {
            case MONTHLY -> 1;
            case QUARTERLY -> 3;
            case YEARLY -> 12;
        };
    }

    private String categoryName(RecurringPayment payment) {
        return payment.getCategory() != null ? payment.getCategory().getName() : "Uncategorized";
    }

    private CategoryKey categoryKey(RecurringPayment payment) {
        if (payment.getCategory() == null) {
            return new CategoryKey(null, "Uncategorized");
        }
        return new CategoryKey(payment.getCategory().getId(), payment.getCategory().getName());
    }

    private double toPercentage(BigDecimal amount, BigDecimal total) {
        if (total.compareTo(BigDecimal.ZERO) == 0) {
            return 0.0;
        }
        return amount.multiply(BigDecimal.valueOf(100))
                .divide(total, 2, RoundingMode.HALF_UP)
                .doubleValue();
    }

    private BigDecimal monthlyEquivalent(BigDecimal amount, Frequency frequency) {
        return switch (frequency) {
            case MONTHLY -> amount;
            case QUARTERLY -> amount.divide(BigDecimal.valueOf(3), 2, RoundingMode.HALF_UP);
            case YEARLY -> amount.divide(BigDecimal.valueOf(12), 2, RoundingMode.HALF_UP);
        };
    }

    private AdditionalBaseline additionalBaseline(UUID userId, LocalDate today) {
        YearMonth currentMonth = YearMonth.from(today);
        YearMonth firstBaselineMonth = currentMonth.minusMonths(3);
        LocalDate from = firstBaselineMonth.atDay(1);
        LocalDate to = currentMonth.minusMonths(1).atEndOfMonth();
        List<Transaction> additionalTransactions = transactionRepository.findUnlinkedTransactionsBetweenForUser(from, to, userId);
        if (additionalTransactions.isEmpty()) {
            return new AdditionalBaseline(BigDecimal.ZERO, BigDecimal.ZERO);
        }

        BigDecimal income = BigDecimal.ZERO;
        BigDecimal expenses = BigDecimal.ZERO;
        Set<YearMonth> monthsWithData = new HashSet<>();
        for (Transaction transaction : additionalTransactions) {
            monthsWithData.add(YearMonth.from(transaction.getBookingDate()));
            if (transaction.getAmount().compareTo(BigDecimal.ZERO) > 0) {
                income = income.add(transaction.getAmount());
            } else if (transaction.getAmount().compareTo(BigDecimal.ZERO) < 0) {
                expenses = expenses.add(transaction.getAmount().abs());
            }
        }

        BigDecimal divisor = BigDecimal.valueOf(monthsWithData.size());
        return new AdditionalBaseline(
                income.divide(divisor, 2, RoundingMode.HALF_UP),
                expenses.divide(divisor, 2, RoundingMode.HALF_UP));
    }

    private boolean isActiveDuringMonth(RecurringPayment payment, YearMonth month) {
        LocalDate monthStart = month.atDay(1);
        LocalDate monthEnd = month.atEndOfMonth();
        return (payment.getStartDate() == null || !payment.getStartDate().isAfter(monthEnd))
                && (payment.getEndDate() == null || !payment.getEndDate().isBefore(monthStart));
    }

    private boolean isOccurrenceWithinLifecycle(RecurringPayment payment, LocalDate occurrenceDate) {
        return (payment.getStartDate() == null || !occurrenceDate.isBefore(payment.getStartDate()))
                && (payment.getEndDate() == null || !occurrenceDate.isAfter(payment.getEndDate()));
    }

    private List<LocalDate> predictNextDates(LocalDate lastDate, Frequency frequency, int monthsAhead) {
        List<LocalDate> dates = new ArrayList<>();
        LocalDate next = lastDate;
        LocalDate limit = LocalDate.now().plusMonths(monthsAhead);
        for (int i = 0; i < 100; i++) {
            next = switch (frequency) {
                case MONTHLY -> next.plusMonths(1);
                case QUARTERLY -> next.plusMonths(3);
                case YEARLY -> next.plusYears(1);
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
            BigDecimal totalRecurringIncome,
            BigDecimal totalRecurringExpenses,
            List<MonthlyBreakdownResult> monthlyBreakdown,
            List<CategoryBreakdownResult> byCategory,
            List<RecurringPaymentSummaryResult> recurringExpenses,
            List<RecurringPaymentSummaryResult> recurringIncome) {}

    public record MonthlyBreakdownResult(int month, BigDecimal income, BigDecimal expenses, BigDecimal surplus, BigDecimal recurringExpenses) {}

    public record CategoryBreakdownResult(UUID categoryId, String category, BigDecimal total, double percentage, String color) {}

    public record RecurringPaymentSummaryResult(UUID id, String name, BigDecimal monthlyAmount,
                                                 BigDecimal annualAmount, String category) {}

    private record RecurringTotals(Map<UUID, PaymentYearTotal> totalsByPayment, List<BigDecimal> monthlyExpenses) {}

    private record PaymentYearTotal(BigDecimal amount, List<TransactionRecurringLink> allLinks,
                                    LocalDate startOfYear, LocalDate endOfYear) {}

    private record CategoryKey(UUID id, String fallbackName) {}

    public record PredictionResult(List<MonthlyPredictionResult> predictions,
                                    List<UpcomingPaymentResult> upcomingPayments) {}

    public record MonthlyPredictionResult(String month, BigDecimal expectedIncome,
                                           BigDecimal expectedExpenses,
                                           BigDecimal expectedSurplus,
                                           BigDecimal recurringIncome,
                                           BigDecimal recurringExpenses,
                                           BigDecimal additionalIncome,
                                           BigDecimal additionalExpenses) {}

    public record UpcomingPaymentResult(String name, LocalDate date, BigDecimal amount) {}

    private record AdditionalBaseline(BigDecimal income, BigDecimal expenses) {}

    private record RecurringPredictionAmounts(BigDecimal income, BigDecimal expenses) {}
}
