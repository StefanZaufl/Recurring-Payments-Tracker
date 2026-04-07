package com.tracker.service;

import com.tracker.model.entity.Frequency;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static com.tracker.service.PaymentPeriodHistoryService.computePeriodEnd;
import static com.tracker.service.PaymentPeriodHistoryService.computePeriodStart;
import static org.assertj.core.api.Assertions.assertThat;

class PaymentPeriodHistoryServiceTest {

    // ────────────────────────────────────────────────────────────────────
    // Period start computation
    // ────────────────────────────────────────────────────────────────────

    @Nested
    class ComputePeriodStartTests {

        @Test
        void monthlyReturnsFirstOfMonth() {
            assertThat(computePeriodStart(LocalDate.of(2025, 3, 15), Frequency.MONTHLY))
                    .isEqualTo(LocalDate.of(2025, 3, 1));
        }

        @Test
        void monthlyFirstDayOfMonthReturnsSameDate() {
            assertThat(computePeriodStart(LocalDate.of(2025, 3, 1), Frequency.MONTHLY))
                    .isEqualTo(LocalDate.of(2025, 3, 1));
        }

        @Test
        void monthlyLastDayOfMonthReturnsFirstOfSameMonth() {
            assertThat(computePeriodStart(LocalDate.of(2025, 3, 31), Frequency.MONTHLY))
                    .isEqualTo(LocalDate.of(2025, 3, 1));
        }

        @Test
        void quarterlyQ1ReturnsJan1() {
            assertThat(computePeriodStart(LocalDate.of(2025, 2, 15), Frequency.QUARTERLY))
                    .isEqualTo(LocalDate.of(2025, 1, 1));
        }

        @Test
        void quarterlyQ2ReturnsApr1() {
            assertThat(computePeriodStart(LocalDate.of(2025, 5, 10), Frequency.QUARTERLY))
                    .isEqualTo(LocalDate.of(2025, 4, 1));
        }

        @Test
        void quarterlyQ3ReturnsJul1() {
            assertThat(computePeriodStart(LocalDate.of(2025, 9, 30), Frequency.QUARTERLY))
                    .isEqualTo(LocalDate.of(2025, 7, 1));
        }

        @Test
        void quarterlyQ4ReturnsOct1() {
            assertThat(computePeriodStart(LocalDate.of(2025, 12, 25), Frequency.QUARTERLY))
                    .isEqualTo(LocalDate.of(2025, 10, 1));
        }

        @Test
        void yearlyReturnsJan1() {
            assertThat(computePeriodStart(LocalDate.of(2025, 7, 15), Frequency.YEARLY))
                    .isEqualTo(LocalDate.of(2025, 1, 1));
        }

        @Test
        void nullFrequencyDefaultsToMonthly() {
            assertThat(computePeriodStart(LocalDate.of(2025, 3, 15), null))
                    .isEqualTo(LocalDate.of(2025, 3, 1));
        }
    }

    // ────────────────────────────────────────────────────────────────────
    // Period end computation
    // ────────────────────────────────────────────────────────────────────

    @Nested
    class ComputePeriodEndTests {

        @Test
        void monthlyReturnsLastDayOfMonth() {
            assertThat(computePeriodEnd(LocalDate.of(2025, 3, 1), Frequency.MONTHLY))
                    .isEqualTo(LocalDate.of(2025, 3, 31));
        }

        @Test
        void monthlyFebruaryNonLeapYear() {
            assertThat(computePeriodEnd(LocalDate.of(2025, 2, 1), Frequency.MONTHLY))
                    .isEqualTo(LocalDate.of(2025, 2, 28));
        }

        @Test
        void monthlyFebruaryLeapYear() {
            assertThat(computePeriodEnd(LocalDate.of(2024, 2, 1), Frequency.MONTHLY))
                    .isEqualTo(LocalDate.of(2024, 2, 29));
        }

        @Test
        void quarterlyQ1EndsMarc31() {
            assertThat(computePeriodEnd(LocalDate.of(2025, 1, 1), Frequency.QUARTERLY))
                    .isEqualTo(LocalDate.of(2025, 3, 31));
        }

        @Test
        void quarterlyQ2EndsJun30() {
            assertThat(computePeriodEnd(LocalDate.of(2025, 4, 1), Frequency.QUARTERLY))
                    .isEqualTo(LocalDate.of(2025, 6, 30));
        }

        @Test
        void yearlyEndsDec31() {
            assertThat(computePeriodEnd(LocalDate.of(2025, 1, 1), Frequency.YEARLY))
                    .isEqualTo(LocalDate.of(2025, 12, 31));
        }
    }
}
