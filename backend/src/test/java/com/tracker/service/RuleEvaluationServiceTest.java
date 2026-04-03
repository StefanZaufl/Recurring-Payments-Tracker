package com.tracker.service;

import com.tracker.model.entity.*;
import com.tracker.service.evaluation.AmountEvaluationStrategy;
import com.tracker.service.evaluation.JaroWinklerEvaluationStrategy;
import com.tracker.service.evaluation.RegexEvaluationStrategy;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class RuleEvaluationServiceTest {

    private RuleEvaluationService evaluationService;

    @BeforeEach
    void setUp() {
        evaluationService = new RuleEvaluationService(List.of(
                new RegexEvaluationStrategy(),
                new JaroWinklerEvaluationStrategy(),
                new AmountEvaluationStrategy()
        ));
    }

    // ────────────────────────────────────────────────────────────────────
    // Regex strategy
    // ────────────────────────────────────────────────────────────────────

    @Nested
    class RegexStrategyTests {

        @Test
        void matchesRegexPattern() {
            Rule rule = textRule(RuleType.REGEX, TargetField.PARTNER_NAME, "netflix.*", true, null);
            Transaction tx = tx("Netflix Inc.", "-12.99");

            assertThat(evaluationService.matches(List.of(rule), tx)).isTrue();
        }

        @Test
        void rejectsNonMatchingRegex() {
            Rule rule = textRule(RuleType.REGEX, TargetField.PARTNER_NAME, "^spotify$", true, null);
            Transaction tx = tx("Netflix", "-12.99");

            assertThat(evaluationService.matches(List.of(rule), tx)).isFalse();
        }

        @Test
        void strictModeFailsOnNullField() {
            Rule rule = textRule(RuleType.REGEX, TargetField.PARTNER_NAME, ".*", true, null);
            Transaction tx = tx(null, "-12.99");

            assertThat(evaluationService.matches(List.of(rule), tx)).isFalse();
        }

        @Test
        void nonStrictModePassesOnNullField() {
            Rule rule = textRule(RuleType.REGEX, TargetField.PARTNER_NAME, ".*", false, null);
            Transaction tx = tx(null, "-12.99");

            assertThat(evaluationService.matches(List.of(rule), tx)).isTrue();
        }

        @Test
        void invalidRegexReturnsFalse() {
            Rule rule = textRule(RuleType.REGEX, TargetField.PARTNER_NAME, "[invalid", true, null);
            Transaction tx = tx("Netflix", "-12.99");

            assertThat(evaluationService.matches(List.of(rule), tx)).isFalse();
        }

        @Test
        void matchesAgainstDetailsField() {
            Rule rule = textRule(RuleType.REGEX, TargetField.DETAILS, "subscription", true, null);
            Transaction tx = tx("Netflix", "-12.99");
            tx.setDetails("Monthly subscription payment");

            assertThat(evaluationService.matches(List.of(rule), tx)).isTrue();
        }
    }

    // ────────────────────────────────────────────────────────────────────
    // Jaro-Winkler strategy
    // ────────────────────────────────────────────────────────────────────

    @Nested
    class JaroWinklerStrategyTests {

        @Test
        void matchesSimilarText() {
            Rule rule = textRule(RuleType.JARO_WINKLER, TargetField.PARTNER_NAME, "netflix", true, 0.85);
            Transaction tx = tx("Netflix Inc.", "-12.99");

            assertThat(evaluationService.matches(List.of(rule), tx)).isTrue();
        }

        @Test
        void rejectsDissimilarText() {
            Rule rule = textRule(RuleType.JARO_WINKLER, TargetField.PARTNER_NAME, "netflix", true, 0.85);
            Transaction tx = tx("Amazon", "-12.99");

            assertThat(evaluationService.matches(List.of(rule), tx)).isFalse();
        }

        @Test
        void respectsThreshold() {
            Rule lowThreshold = textRule(RuleType.JARO_WINKLER, TargetField.PARTNER_NAME, "netflix", true, 0.5);
            Rule highThreshold = textRule(RuleType.JARO_WINKLER, TargetField.PARTNER_NAME, "netflix", true, 0.99);
            Transaction tx = tx("Netflix GmbH", "-12.99");

            assertThat(evaluationService.matches(List.of(lowThreshold), tx)).isTrue();
            assertThat(evaluationService.matches(List.of(highThreshold), tx)).isFalse();
        }

        @Test
        void strictModeFailsOnNull() {
            Rule rule = textRule(RuleType.JARO_WINKLER, TargetField.PARTNER_NAME, "test", true, 0.85);
            Transaction tx = tx(null, "-10");

            assertThat(evaluationService.matches(List.of(rule), tx)).isFalse();
        }

        @Test
        void nonStrictModePassesOnNull() {
            Rule rule = textRule(RuleType.JARO_WINKLER, TargetField.PARTNER_NAME, "test", false, 0.85);
            Transaction tx = tx(null, "-10");

            assertThat(evaluationService.matches(List.of(rule), tx)).isTrue();
        }
    }

    // ────────────────────────────────────────────────────────────────────
    // Amount strategy
    // ────────────────────────────────────────────────────────────────────

    @Nested
    class AmountStrategyTests {

        @Test
        void matchesExactAmount() {
            Rule rule = amountRule("-12.99", "1.50");
            Transaction tx = tx("Netflix", "-12.99");

            assertThat(evaluationService.matches(List.of(rule), tx)).isTrue();
        }

        @Test
        void matchesWithinFluctuationRange() {
            Rule rule = amountRule("-12.99", "2.00");
            Transaction tx = tx("Netflix", "-14.50");

            assertThat(evaluationService.matches(List.of(rule), tx)).isTrue();
        }

        @Test
        void rejectsOutsideFluctuationRange() {
            Rule rule = amountRule("-12.99", "1.00");
            Transaction tx = tx("Netflix", "-20.00");

            assertThat(evaluationService.matches(List.of(rule), tx)).isFalse();
        }

        @Test
        void matchesAtBoundary() {
            Rule rule = amountRule("-10.00", "2.50");
            Transaction tx = tx("X", "-12.50");

            assertThat(evaluationService.matches(List.of(rule), tx)).isTrue();
        }

        @Test
        void rejectsNullAmount() {
            Rule rule = amountRule("-12.99", "1.00");
            Transaction tx = tx("X", null);

            assertThat(evaluationService.matches(List.of(rule), tx)).isFalse();
        }
    }

    // ────────────────────────────────────────────────────────────────────
    // Combined rule evaluation (AND logic)
    // ────────────────────────────────────────────────────────────────────

    @Nested
    class CombinedRuleTests {

        @Test
        void allRulesMustMatch() {
            Rule jwRule = textRule(RuleType.JARO_WINKLER, TargetField.PARTNER_NAME, "netflix", true, 0.85);
            Rule amtRule = amountRule("-12.99", "2.00");
            Transaction tx = tx("Netflix Inc.", "-13.50");

            assertThat(evaluationService.matches(List.of(jwRule, amtRule), tx)).isTrue();
        }

        @Test
        void failsIfOneRuleDoesNotMatch() {
            Rule jwRule = textRule(RuleType.JARO_WINKLER, TargetField.PARTNER_NAME, "netflix", true, 0.85);
            Rule amtRule = amountRule("-12.99", "1.00");
            Transaction tx = tx("Netflix Inc.", "-50.00"); // name matches, amount doesn't

            assertThat(evaluationService.matches(List.of(jwRule, amtRule), tx)).isFalse();
        }

        @Test
        void emptyRulesReturnsFalse() {
            Transaction tx = tx("Netflix", "-12.99");

            assertThat(evaluationService.matches(List.of(), tx)).isFalse();
        }
    }

    // ────────────────────────────────────────────────────────────────────
    // findMatchingTransactions
    // ────────────────────────────────────────────────────────────────────

    @Nested
    class FindMatchingTests {

        @Test
        void findsAllMatchingTransactions() {
            Rule jwRule = textRule(RuleType.JARO_WINKLER, TargetField.PARTNER_NAME, "netflix", true, 0.85);
            Rule amtRule = amountRule("-12.99", "2.00");

            List<Transaction> candidates = List.of(
                    tx("Netflix", "-12.99"),
                    tx("Netflix Inc.", "-13.50"),
                    tx("Amazon", "-25.00"),
                    tx("Netflix", "-50.00")   // amount mismatch
            );

            List<Transaction> matches = evaluationService.findMatchingTransactions(
                    List.of(jwRule, amtRule), candidates);

            assertThat(matches).hasSize(2);
        }

        @Test
        void returnsEmptyForNoMatches() {
            Rule rule = textRule(RuleType.REGEX, TargetField.PARTNER_NAME, "^xyz$", true, null);

            List<Transaction> matches = evaluationService.findMatchingTransactions(
                    List.of(rule), List.of(tx("Netflix", "-10")));

            assertThat(matches).isEmpty();
        }
    }

    // ────────────────────────────────────────────────────────────────────
    // Test helpers
    // ────────────────────────────────────────────────────────────────────

    private static Transaction tx(String partnerName, String amount) {
        Transaction tx = new Transaction();
        tx.setPartnerName(partnerName);
        tx.setBookingDate(LocalDate.of(2025, 1, 15));
        if (amount != null) {
            tx.setAmount(new BigDecimal(amount));
        }
        return tx;
    }

    private static Rule textRule(RuleType type, TargetField field, String text, boolean strict, Double threshold) {
        Rule rule = new Rule();
        rule.setRuleType(type);
        rule.setTargetField(field);
        rule.setText(text);
        rule.setStrict(strict);
        rule.setThreshold(threshold);
        return rule;
    }

    private static Rule amountRule(String amount, String fluctuation) {
        Rule rule = new Rule();
        rule.setRuleType(RuleType.AMOUNT);
        rule.setAmount(new BigDecimal(amount));
        rule.setFluctuationRange(new BigDecimal(fluctuation));
        return rule;
    }
}
