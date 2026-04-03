package com.tracker.service;

import com.tracker.model.entity.Transaction;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;

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
            List<Transaction> txs = List.of(
                    tx("Spotify", LocalDate.of(2025, 1, 15), "-9.99"),
                    tx("Spotify", LocalDate.of(2025, 2, 14), "-9.99"),
                    tx("Spotify", LocalDate.of(2025, 3, 17), "-9.99"),
                    tx("Spotify", LocalDate.of(2025, 4, 15), "-9.99"));
            assertThat(service.detectFrequency(txs)).isEqualTo("MONTHLY");
        }

        @Test
        void frequencyBoundaryMonthlyMin() {
            LocalDate start = LocalDate.of(2025, 1, 1);
            List<Transaction> txs = List.of(
                    tx("A", start, "-10"),
                    tx("A", start.plusDays(MONTHLY_MIN_DAYS), "-10"));
            assertThat(service.detectFrequency(txs)).isEqualTo("MONTHLY");
        }

        @Test
        void frequencyBoundaryMonthlyMax() {
            LocalDate start = LocalDate.of(2025, 1, 1);
            List<Transaction> txs = List.of(
                    tx("A", start, "-10"),
                    tx("A", start.plusDays(MONTHLY_MAX_DAYS), "-10"));
            assertThat(service.detectFrequency(txs)).isEqualTo("MONTHLY");
        }

        @Test
        void gapBetweenMonthlyAndQuarterlyReturnsNull() {
            LocalDate start = LocalDate.of(2025, 1, 1);
            List<Transaction> txs = List.of(
                    tx("A", start, "-10"),
                    tx("A", start.plusDays(50), "-10"),
                    tx("A", start.plusDays(100), "-10"));
            assertThat(service.detectFrequency(txs)).isNull();
        }

        @Test
        void tooFrequentPaymentsReturnNull() {
            List<Transaction> txs = List.of(
                    tx("Weekly", LocalDate.of(2025, 1, 1), "-10"),
                    tx("Weekly", LocalDate.of(2025, 1, 8), "-10"),
                    tx("Weekly", LocalDate.of(2025, 1, 15), "-10"));
            assertThat(service.detectFrequency(txs)).isNull();
        }
    }

    // ────────────────────────────────────────────────────────────────────
    // Test helpers
    // ────────────────────────────────────────────────────────────────────

    private static RecurringPaymentDetectionService createService() {
        return new RecurringPaymentDetectionService(null, null, null, null, null);
    }

    static Transaction tx(String partnerName, LocalDate date, String amount) {
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
}
