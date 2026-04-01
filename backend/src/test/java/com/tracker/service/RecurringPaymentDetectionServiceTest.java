package com.tracker.service;

import com.tracker.model.entity.Transaction;
import com.tracker.service.RecurringPaymentDetectionService.TransactionGroup;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import static com.tracker.service.RecurringPaymentDetectionService.*;
import static org.assertj.core.api.Assertions.assertThat;

class RecurringPaymentDetectionServiceTest {

    // ────────────────────────────────────────────────────────────────────
    // String normalization
    // ────────────────────────────────────────────────────────────────────

    @Nested
    class NormalizeTests {

        @Test
        void lowercasesInput() {
            assertThat(normalize("NETFLIX")).isEqualTo("netflix");
        }

        @Test
        void preservesGermanCharacters() {
            assertThat(normalize("Müller Bäckerei")).isEqualTo("müller bäckerei");
        }

        @Test
        void removesSpecialCharacters() {
            assertThat(normalize("Netflix Inc.")).isEqualTo("netflix inc");
        }

        @Test
        void collapsesWhitespace() {
            assertThat(normalize("Netflix   Inc")).isEqualTo("netflix inc");
        }

        @Test
        void trimsLeadingAndTrailingSpaces() {
            assertThat(normalize("  Netflix  ")).isEqualTo("netflix");
        }

        @ParameterizedTest
        @NullAndEmptySource
        void handlesNullAndEmpty(String input) {
            assertThat(normalize(input)).isEmpty();
        }

        @Test
        void removesSpecialCharactersButKeepsDigits() {
            assertThat(normalize("Paypal *12345 GmbH")).isEqualTo("paypal 12345 gmbh");
        }

        @Test
        void handlesUmlautsAndEszett() {
            assertThat(normalize("Straße Über Öl")).isEqualTo("straße über öl");
        }
    }

    // ────────────────────────────────────────────────────────────────────
    // Median calculation
    // ────────────────────────────────────────────────────────────────────

    @Nested
    class MedianTests {

        @Test
        void singleValue() {
            assertThat(median(List.of(30L))).isEqualTo(30L);
        }

        @Test
        void oddNumberOfValues() {
            assertThat(median(List.of(28L, 30L, 32L))).isEqualTo(30L);
        }

        @Test
        void evenNumberOfValues() {
            assertThat(median(List.of(28L, 32L))).isEqualTo(30L);
        }

        @Test
        void unsortedValues() {
            assertThat(median(List.of(90L, 30L, 60L))).isEqualTo(60L);
        }
    }

    // ────────────────────────────────────────────────────────────────────
    // Day gap computation
    // ────────────────────────────────────────────────────────────────────

    @Nested
    class ComputeDayGapsTests {

        private final RecurringPaymentDetectionService service = createService();

        @Test
        void computesGapsBetweenConsecutiveDates() {
            List<Transaction> txs = List.of(
                    tx("A", LocalDate.of(2025, 1, 15), "-10"),
                    tx("A", LocalDate.of(2025, 2, 15), "-10"),
                    tx("A", LocalDate.of(2025, 3, 15), "-10"));

            List<Long> gaps = service.computeDayGaps(txs);

            assertThat(gaps).containsExactly(31L, 28L);
        }

        @Test
        void sortsDatesBefore() {
            List<Transaction> txs = List.of(
                    tx("A", LocalDate.of(2025, 3, 15), "-10"),
                    tx("A", LocalDate.of(2025, 1, 15), "-10"),
                    tx("A", LocalDate.of(2025, 2, 15), "-10"));

            List<Long> gaps = service.computeDayGaps(txs);

            assertThat(gaps).containsExactly(31L, 28L);
        }

        @Test
        void singleTransactionReturnsEmptyGaps() {
            assertThat(service.computeDayGaps(List.of(tx("A", LocalDate.of(2025, 1, 1), "-10")))).isEmpty();
        }
    }

    // ────────────────────────────────────────────────────────────────────
    // Frequency detection
    // ────────────────────────────────────────────────────────────────────

    @Nested
    class DetectFrequencyTests {

        private final RecurringPaymentDetectionService service = createService();

        @Test
        void detectsMonthlyPayments() {
            List<Transaction> txs = monthlyTransactions("Netflix", LocalDate.of(2025, 1, 15), 4, "-12.99");

            assertThat(service.detectFrequency(txs)).isEqualTo("MONTHLY");
        }

        @Test
        void detectsQuarterlyPayments() {
            List<Transaction> txs = List.of(
                    tx("Insurance", LocalDate.of(2025, 1, 1), "-200"),
                    tx("Insurance", LocalDate.of(2025, 4, 1), "-200"),
                    tx("Insurance", LocalDate.of(2025, 7, 1), "-200"));

            assertThat(service.detectFrequency(txs)).isEqualTo("QUARTERLY");
        }

        @Test
        void detectsYearlyPayments() {
            List<Transaction> txs = List.of(
                    tx("Domain Reg", LocalDate.of(2024, 3, 10), "-15"),
                    tx("Domain Reg", LocalDate.of(2025, 3, 10), "-15"));

            assertThat(service.detectFrequency(txs)).isEqualTo("YEARLY");
        }

        @Test
        void returnsNullForSingleTransaction() {
            assertThat(service.detectFrequency(List.of(tx("X", LocalDate.of(2025, 1, 1), "-5")))).isNull();
        }

        @Test
        void returnsNullForIrregularIntervals() {
            List<Transaction> txs = List.of(
                    tx("Random", LocalDate.of(2025, 1, 1), "-10"),
                    tx("Random", LocalDate.of(2025, 1, 10), "-10"),
                    tx("Random", LocalDate.of(2025, 3, 25), "-10"));

            assertThat(service.detectFrequency(txs)).isNull();
        }

        @Test
        void monthlyDetectionToleratesSlightVariation() {
            // Payments on the 15th but some months have different lengths
            List<Transaction> txs = List.of(
                    tx("Spotify", LocalDate.of(2025, 1, 15), "-9.99"),
                    tx("Spotify", LocalDate.of(2025, 2, 14), "-9.99"),  // 30 days
                    tx("Spotify", LocalDate.of(2025, 3, 17), "-9.99"),  // 31 days
                    tx("Spotify", LocalDate.of(2025, 4, 15), "-9.99")); // 29 days

            assertThat(service.detectFrequency(txs)).isEqualTo("MONTHLY");
        }

        @Test
        void quarterlyDetectionWithVariation() {
            List<Transaction> txs = List.of(
                    tx("Rent", LocalDate.of(2025, 1, 1), "-500"),
                    tx("Rent", LocalDate.of(2025, 4, 3), "-500"),   // 92 days
                    tx("Rent", LocalDate.of(2025, 6, 28), "-500")); // 86 days

            assertThat(service.detectFrequency(txs)).isEqualTo("QUARTERLY");
        }

        @Test
        void yearlyDetectionWithVariation() {
            List<Transaction> txs = List.of(
                    tx("Annual Sub", LocalDate.of(2023, 6, 1), "-100"),
                    tx("Annual Sub", LocalDate.of(2024, 5, 30), "-100"),  // 364 days
                    tx("Annual Sub", LocalDate.of(2025, 6, 2), "-100"));  // 368 days

            assertThat(service.detectFrequency(txs)).isEqualTo("YEARLY");
        }

        @Test
        void tooFrequentPaymentsReturnNull() {
            // Weekly payments (gap ~7 days) should not match any frequency
            List<Transaction> txs = List.of(
                    tx("Weekly", LocalDate.of(2025, 1, 1), "-10"),
                    tx("Weekly", LocalDate.of(2025, 1, 8), "-10"),
                    tx("Weekly", LocalDate.of(2025, 1, 15), "-10"));

            assertThat(service.detectFrequency(txs)).isNull();
        }
    }

    // ────────────────────────────────────────────────────────────────────
    // Transaction grouping by partner name
    // ────────────────────────────────────────────────────────────────────

    @Nested
    class GroupTransactionsTests {

        private final RecurringPaymentDetectionService service = createService();

        @Test
        void groupsExactSamePartnerNames() {
            List<Transaction> txs = List.of(
                    tx("Netflix", LocalDate.of(2025, 1, 15), "-12.99"),
                    tx("Netflix", LocalDate.of(2025, 2, 15), "-12.99"),
                    tx("Spotify", LocalDate.of(2025, 1, 15), "-9.99"));

            List<TransactionGroup> groups = service.groupTransactionsByPartner(txs);

            assertThat(groups).hasSize(2);
            assertThat(groups.get(0).transactions()).hasSize(2);
            assertThat(groups.get(1).transactions()).hasSize(1);
        }

        @Test
        void groupsFuzzyMatchingPartnerNames() {
            List<Transaction> txs = List.of(
                    tx("Netflix Inc.", LocalDate.of(2025, 1, 15), "-12.99"),
                    tx("Netflix Inc", LocalDate.of(2025, 2, 15), "-12.99"),
                    tx("NETFLIX INC.", LocalDate.of(2025, 3, 15), "-12.99"));

            List<TransactionGroup> groups = service.groupTransactionsByPartner(txs);

            assertThat(groups).hasSize(1);
            assertThat(groups.get(0).transactions()).hasSize(3);
        }

        @Test
        void doesNotGroupDissimilarNames() {
            List<Transaction> txs = List.of(
                    tx("Netflix", LocalDate.of(2025, 1, 15), "-12.99"),
                    tx("Amazon", LocalDate.of(2025, 1, 15), "-25.00"),
                    tx("Spotify", LocalDate.of(2025, 1, 15), "-9.99"));

            List<TransactionGroup> groups = service.groupTransactionsByPartner(txs);

            assertThat(groups).hasSize(3);
        }

        @Test
        void skipsTransactionsWithNullPartnerName() {
            List<Transaction> txs = List.of(
                    tx(null, LocalDate.of(2025, 1, 15), "-10"),
                    tx("Netflix", LocalDate.of(2025, 1, 15), "-12.99"));

            List<TransactionGroup> groups = service.groupTransactionsByPartner(txs);

            assertThat(groups).hasSize(1);
            assertThat(groups.get(0).representativeName()).isEqualTo("Netflix");
        }

        @Test
        void skipsTransactionsWithBlankPartnerName() {
            List<Transaction> txs = List.of(
                    tx("  ", LocalDate.of(2025, 1, 15), "-10"),
                    tx("Netflix", LocalDate.of(2025, 1, 15), "-12.99"));

            List<TransactionGroup> groups = service.groupTransactionsByPartner(txs);

            assertThat(groups).hasSize(1);
        }

        @Test
        void groupsGermanPartnerNamesWithUmlauts() {
            List<Transaction> txs = List.of(
                    tx("Müller Bäckerei", LocalDate.of(2025, 1, 15), "-5.00"),
                    tx("MÜLLER BÄCKEREI", LocalDate.of(2025, 2, 15), "-5.50"),
                    tx("Mueller Baeckerei", LocalDate.of(2025, 3, 15), "-5.00"));

            List<TransactionGroup> groups = service.groupTransactionsByPartner(txs);

            // Müller and MÜLLER should group together; Mueller may or may not depending on threshold
            assertThat(groups.get(0).transactions().size()).isGreaterThanOrEqualTo(2);
        }

        @Test
        void handlesEmptyTransactionList() {
            assertThat(service.groupTransactionsByPartner(List.of())).isEmpty();
        }
    }

    // ────────────────────────────────────────────────────────────────────
    // Income vs expense detection
    // ────────────────────────────────────────────────────────────────────

    @Nested
    class IncomeDetectionTests {

        private final RecurringPaymentDetectionService service = createService();

        @Test
        void detectsIncomeFromPositiveAmounts() {
            List<Transaction> txs = monthlyTransactions("Arbeitgeber GmbH", LocalDate.of(2025, 1, 1), 3, "3500.00");

            List<TransactionGroup> groups = service.groupTransactionsByPartner(txs);
            assertThat(groups).hasSize(1);
            // Average amount should be positive
            BigDecimal avg = averageAmount(groups.get(0).transactions());
            assertThat(avg).isPositive();
        }

        @Test
        void detectsExpenseFromNegativeAmounts() {
            List<Transaction> txs = monthlyTransactions("Netflix", LocalDate.of(2025, 1, 15), 3, "-12.99");

            List<TransactionGroup> groups = service.groupTransactionsByPartner(txs);
            assertThat(groups).hasSize(1);
            BigDecimal avg = averageAmount(groups.get(0).transactions());
            assertThat(avg).isNegative();
        }
    }

    // ────────────────────────────────────────────────────────────────────
    // Edge cases
    // ────────────────────────────────────────────────────────────────────

    @Nested
    class EdgeCaseTests {

        private final RecurringPaymentDetectionService service = createService();

        @Test
        void twoTransactionsMeetsMinimumOccurrences() {
            List<Transaction> txs = List.of(
                    tx("Netflix", LocalDate.of(2025, 1, 15), "-12.99"),
                    tx("Netflix", LocalDate.of(2025, 2, 15), "-12.99"));

            assertThat(service.detectFrequency(txs)).isEqualTo("MONTHLY");
        }

        @Test
        void handlesTransactionsWithVaryingAmounts() {
            // Same partner, monthly, but amounts vary slightly
            List<Transaction> txs = List.of(
                    tx("Electric Co", LocalDate.of(2025, 1, 15), "-95.00"),
                    tx("Electric Co", LocalDate.of(2025, 2, 15), "-102.50"),
                    tx("Electric Co", LocalDate.of(2025, 3, 15), "-88.75"));

            assertThat(service.detectFrequency(txs)).isEqualTo("MONTHLY");
        }

        @Test
        void frequencyBoundaryMonthlyMin() {
            // Exactly at MONTHLY_MIN_DAYS boundary
            LocalDate start = LocalDate.of(2025, 1, 1);
            List<Transaction> txs = List.of(
                    tx("A", start, "-10"),
                    tx("A", start.plusDays(MONTHLY_MIN_DAYS), "-10"));

            assertThat(service.detectFrequency(txs)).isEqualTo("MONTHLY");
        }

        @Test
        void frequencyBoundaryMonthlyMax() {
            // Exactly at MONTHLY_MAX_DAYS boundary
            LocalDate start = LocalDate.of(2025, 1, 1);
            List<Transaction> txs = List.of(
                    tx("A", start, "-10"),
                    tx("A", start.plusDays(MONTHLY_MAX_DAYS), "-10"));

            assertThat(service.detectFrequency(txs)).isEqualTo("MONTHLY");
        }

        @Test
        void gapBetweenMonthlyAndQuarterlyReturnsNull() {
            // Gap of 50 days: too long for monthly, too short for quarterly
            LocalDate start = LocalDate.of(2025, 1, 1);
            List<Transaction> txs = List.of(
                    tx("A", start, "-10"),
                    tx("A", start.plusDays(50), "-10"),
                    tx("A", start.plusDays(100), "-10"));

            assertThat(service.detectFrequency(txs)).isNull();
        }
    }

    // ────────────────────────────────────────────────────────────────────
    // Mixed scenario: realistic bank data
    // ────────────────────────────────────────────────────────────────────

    @Nested
    class RealisticScenarioTests {

        private final RecurringPaymentDetectionService service = createService();

        @Test
        void groupsAndDetectsFromMixedTransactions() {
            List<Transaction> txs = new ArrayList<>();

            // Monthly Netflix subscriptions
            txs.addAll(monthlyTransactions("Netflix", LocalDate.of(2025, 1, 15), 4, "-12.99"));

            // Monthly salary
            txs.addAll(monthlyTransactions("Arbeitgeber GmbH", LocalDate.of(2025, 1, 1), 4, "3500.00"));

            // Monthly Spotify
            txs.addAll(monthlyTransactions("Spotify AB", LocalDate.of(2025, 1, 5), 3, "-9.99"));

            // Quarterly insurance
            txs.add(tx("ERGO Versicherung", LocalDate.of(2025, 1, 1), "-250.00"));
            txs.add(tx("ERGO Versicherung", LocalDate.of(2025, 4, 1), "-250.00"));
            txs.add(tx("ERGO Versicherung", LocalDate.of(2025, 7, 1), "-250.00"));

            // One-off purchases (should not form recurring patterns)
            txs.add(tx("Amazon", LocalDate.of(2025, 2, 10), "-45.99"));
            txs.add(tx("REWE", LocalDate.of(2025, 1, 20), "-82.30"));

            List<TransactionGroup> groups = service.groupTransactionsByPartner(txs);

            // Should have groups for: Netflix (4), Arbeitgeber (4), Spotify (3),
            // ERGO (3), Amazon (1), REWE (1)
            assertThat(groups.size()).isGreaterThanOrEqualTo(5);

            // Netflix group should have 4 transactions
            TransactionGroup netflixGroup = groups.stream()
                    .filter(g -> g.normalizedName().contains("netflix"))
                    .findFirst().orElseThrow();
            assertThat(netflixGroup.transactions()).hasSize(4);

            // Netflix should be detected as monthly
            assertThat(service.detectFrequency(netflixGroup.transactions())).isEqualTo("MONTHLY");

            // ERGO should be detected as quarterly
            TransactionGroup ergoGroup = groups.stream()
                    .filter(g -> g.normalizedName().contains("ergo"))
                    .findFirst().orElseThrow();
            assertThat(service.detectFrequency(ergoGroup.transactions())).isEqualTo("QUARTERLY");
        }

        @Test
        void groupsFuzzyMatchedPartnerNameVariations() {
            List<Transaction> txs = List.of(
                    tx("PayPal *NETFLIX", LocalDate.of(2025, 1, 15), "-12.99"),
                    tx("PAYPAL *NETFLIX", LocalDate.of(2025, 2, 15), "-12.99"),
                    tx("Paypal *Netflix", LocalDate.of(2025, 3, 15), "-12.99"));

            List<TransactionGroup> groups = service.groupTransactionsByPartner(txs);

            assertThat(groups).hasSize(1);
            assertThat(groups.get(0).transactions()).hasSize(3);
        }
    }

    // ────────────────────────────────────────────────────────────────────
    // Test helpers
    // ────────────────────────────────────────────────────────────────────

    private static RecurringPaymentDetectionService createService() {
        return new RecurringPaymentDetectionService(null, null, null);
    }

    private static Transaction tx(String partnerName, LocalDate date, String amount) {
        Transaction tx = new Transaction();
        tx.setPartnerName(partnerName);
        tx.setBookingDate(date);
        tx.setAmount(new BigDecimal(amount));
        return tx;
    }

    static List<Transaction> monthlyTransactions(String partner, LocalDate startDate, int count, String amount) {
        List<Transaction> txs = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            txs.add(tx(partner, startDate.plusMonths(i), amount));
        }
        return txs;
    }

    private static BigDecimal averageAmount(List<Transaction> transactions) {
        return transactions.stream()
                .map(Transaction::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .divide(BigDecimal.valueOf(transactions.size()), 2, java.math.RoundingMode.HALF_UP);
    }
}
