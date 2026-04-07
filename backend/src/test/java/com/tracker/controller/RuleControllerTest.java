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
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.util.UUID;

import static com.tracker.testutil.SecurityTestUtil.authenticatedUser;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class RuleControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private RecurringPaymentRepository recurringPaymentRepository;

    @Autowired
    private RuleRepository ruleRepository;

    @Autowired
    private TransactionRecurringLinkRepository linkRepository;

    @Autowired
    private TransactionRepository transactionRepository;

    @Autowired
    private FileUploadRepository fileUploadRepository;

    @Autowired
    private UserRepository userRepository;

    private User testUser;

    @BeforeEach
    void setUp() {
        linkRepository.deleteAll();
        ruleRepository.deleteAll();
        recurringPaymentRepository.deleteAll();
        transactionRepository.deleteAll();
        fileUploadRepository.deleteAll();
        testUser = SecurityTestUtil.createTestUser(userRepository);
    }

    private String rulesUrl(UUID paymentId) {
        return "/api/recurring-payments/" + paymentId + "/rules";
    }

    private String ruleUrl(UUID paymentId, UUID ruleId) {
        return "/api/recurring-payments/" + paymentId + "/rules/" + ruleId;
    }

    private String reEvaluateUrl(UUID paymentId) {
        return "/api/recurring-payments/" + paymentId + "/re-evaluate";
    }

    // ────────────────────────────────────────────────────────────────────
    // GET /api/recurring-payments/{id}/rules
    // ────────────────────────────────────────────────────────────────────

    @Nested
    class GetRules {

        @Test
        void returnsEmptyListWhenNoRules() throws Exception {
            RecurringPayment payment = seedPayment("Netflix");

            mockMvc.perform(get(rulesUrl(payment.getId())).with(authenticatedUser(testUser)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$", hasSize(0)));
        }

        @Test
        void returnsAllRulesForPayment() throws Exception {
            RecurringPayment payment = seedPayment("Netflix");
            seedJaroWinklerRule(payment, "netflix", 0.85);
            seedAmountRule(payment, "-12.99", "1.30");

            mockMvc.perform(get(rulesUrl(payment.getId())).with(authenticatedUser(testUser)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$", hasSize(2)))
                    .andExpect(jsonPath("$[*].ruleType", containsInAnyOrder("JARO_WINKLER", "AMOUNT")));
        }

        @Test
        void returns404ForNonExistentPayment() throws Exception {
            mockMvc.perform(get(rulesUrl(UUID.randomUUID())).with(authenticatedUser(testUser)))
                    .andExpect(status().isNotFound());
        }
    }

    // ────────────────────────────────────────────────────────────────────
    // POST /api/recurring-payments/{id}/rules
    // ────────────────────────────────────────────────────────────────────

    @Nested
    class CreateRule {

        @Test
        void createsJaroWinklerRule() throws Exception {
            RecurringPayment payment = seedPayment("Netflix");

            mockMvc.perform(post(rulesUrl(payment.getId()))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                {
                                    "ruleType": "JARO_WINKLER",
                                    "targetField": "PARTNER_NAME",
                                    "text": "netflix",
                                    "strict": true,
                                    "threshold": 0.85
                                }
                                """)
                            .with(authenticatedUser(testUser)))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.ruleType").value("JARO_WINKLER"))
                    .andExpect(jsonPath("$.targetField").value("PARTNER_NAME"))
                    .andExpect(jsonPath("$.text").value("netflix"))
                    .andExpect(jsonPath("$.threshold").value(0.85));
        }

        @Test
        void createsAmountRule() throws Exception {
            RecurringPayment payment = seedPayment("Netflix");

            mockMvc.perform(post(rulesUrl(payment.getId()))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                {
                                    "ruleType": "AMOUNT",
                                    "amount": -12.99,
                                    "fluctuationRange": 1.30
                                }
                                """)
                            .with(authenticatedUser(testUser)))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.ruleType").value("AMOUNT"))
                    .andExpect(jsonPath("$.amount").value(-12.99));
        }

        @Test
        void createsRegexRule() throws Exception {
            RecurringPayment payment = seedPayment("Netflix");

            mockMvc.perform(post(rulesUrl(payment.getId()))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                {
                                    "ruleType": "REGEX",
                                    "targetField": "PARTNER_NAME",
                                    "text": "netflix.*",
                                    "strict": true
                                }
                                """)
                            .with(authenticatedUser(testUser)))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.ruleType").value("REGEX"));
        }

        @Test
        void returns400ForInvalidRegex() throws Exception {
            RecurringPayment payment = seedPayment("Netflix");

            mockMvc.perform(post(rulesUrl(payment.getId()))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                {
                                    "ruleType": "REGEX",
                                    "targetField": "PARTNER_NAME",
                                    "text": "[invalid"
                                }
                                """)
                            .with(authenticatedUser(testUser)))
                    .andExpect(status().isBadRequest());
        }

        @Test
        void returns404ForNonExistentPayment() throws Exception {
            mockMvc.perform(post(rulesUrl(UUID.randomUUID()))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                {
                                    "ruleType": "AMOUNT",
                                    "amount": -10,
                                    "fluctuationRange": 1
                                }
                                """)
                            .with(authenticatedUser(testUser)))
                    .andExpect(status().isNotFound());
        }
    }

    // ────────────────────────────────────────────────────────────────────
    // PUT /api/recurring-payments/{id}/rules/{ruleId}
    // ────────────────────────────────────────────────────────────────────

    @Nested
    class UpdateRule {

        @Test
        void updatesRuleFields() throws Exception {
            RecurringPayment payment = seedPayment("Netflix");
            Rule rule = seedJaroWinklerRule(payment, "netflix", 0.85);

            mockMvc.perform(put(ruleUrl(payment.getId(), rule.getId()))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                {
                                    "text": "netflix inc",
                                    "threshold": 0.90
                                }
                                """)
                            .with(authenticatedUser(testUser)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.text").value("netflix inc"))
                    .andExpect(jsonPath("$.threshold").value(0.90));
        }

        @Test
        void returns404ForNonExistentRule() throws Exception {
            RecurringPayment payment = seedPayment("Netflix");

            mockMvc.perform(put(ruleUrl(payment.getId(), UUID.randomUUID()))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"text\": \"test\"}")
                            .with(authenticatedUser(testUser)))
                    .andExpect(status().isNotFound());
        }
    }

    // ────────────────────────────────────────────────────────────────────
    // DELETE /api/recurring-payments/{id}/rules/{ruleId}
    // ────────────────────────────────────────────────────────────────────

    @Nested
    class DeleteRule {

        @Test
        void deletesRule() throws Exception {
            RecurringPayment payment = seedPayment("Netflix");
            Rule rule = seedJaroWinklerRule(payment, "netflix", 0.85);

            mockMvc.perform(delete(ruleUrl(payment.getId(), rule.getId())).with(authenticatedUser(testUser)))
                    .andExpect(status().isNoContent());

            mockMvc.perform(get(rulesUrl(payment.getId())).with(authenticatedUser(testUser)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$", hasSize(0)));
        }

        @Test
        void returns404ForNonExistentRule() throws Exception {
            RecurringPayment payment = seedPayment("Netflix");

            mockMvc.perform(delete(ruleUrl(payment.getId(), UUID.randomUUID())).with(authenticatedUser(testUser)))
                    .andExpect(status().isNotFound());
        }
    }

    // ────────────────────────────────────────────────────────────────────
    // POST /api/recurring-payments/{id}/re-evaluate
    // ────────────────────────────────────────────────────────────────────

    @Nested
    class ReEvaluate {

        @Test
        void returnsUpdatedPayment() throws Exception {
            RecurringPayment payment = seedPayment("Netflix");

            mockMvc.perform(post(reEvaluateUrl(payment.getId())).with(authenticatedUser(testUser)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.id").value(payment.getId().toString()))
                    .andExpect(jsonPath("$.name").value("Netflix"));
        }

        @Test
        void returns404ForNonExistentPayment() throws Exception {
            mockMvc.perform(post(reEvaluateUrl(UUID.randomUUID())).with(authenticatedUser(testUser)))
                    .andExpect(status().isNotFound());
        }
    }

    // ────────────────────────────────────────────────────────────────────
    // ruleCount in RecurringPaymentDto
    // ────────────────────────────────────────────────────────────────────

    @Nested
    class RuleCountDto {

        @Test
        void returnsRuleCountInPaymentDto() throws Exception {
            RecurringPayment payment = seedPayment("Netflix");
            seedJaroWinklerRule(payment, "netflix", 0.85);
            seedAmountRule(payment, "-12.99", "1.30");

            mockMvc.perform(get("/api/recurring-payments").with(authenticatedUser(testUser)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$[0].ruleCount").value(2));
        }

        @Test
        void returnsZeroRuleCountWhenNoRules() throws Exception {
            seedPayment("Netflix");

            mockMvc.perform(get("/api/recurring-payments").with(authenticatedUser(testUser)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$[0].ruleCount").value(0));
        }
    }

    // ────────────────────────────────────────────────────────────────────
    // Test helpers
    // ────────────────────────────────────────────────────────────────────

    private RecurringPayment seedPayment(String name) {
        RecurringPayment payment = new RecurringPayment();
        payment.setName(name);
        payment.setNormalizedName(name.toLowerCase());
        payment.setAverageAmount(new BigDecimal("-12.99"));
        payment.setFrequency(Frequency.MONTHLY);
        payment.setIsIncome(false);
        payment.setIsActive(true);
        payment.setUser(testUser);
        return recurringPaymentRepository.save(payment);
    }

    private Rule seedJaroWinklerRule(RecurringPayment payment, String text, double threshold) {
        Rule rule = new Rule();
        rule.setRecurringPayment(payment);
        rule.setRuleType(RuleType.JARO_WINKLER);
        rule.setTargetField(TargetField.PARTNER_NAME);
        rule.setText(text);
        rule.setStrict(true);
        rule.setThreshold(threshold);
        rule.setUser(testUser);
        return ruleRepository.save(rule);
    }

    private Rule seedAmountRule(RecurringPayment payment, String amount, String fluctuation) {
        Rule rule = new Rule();
        rule.setRecurringPayment(payment);
        rule.setRuleType(RuleType.AMOUNT);
        rule.setAmount(new BigDecimal(amount));
        rule.setFluctuationRange(new BigDecimal(fluctuation));
        rule.setUser(testUser);
        return ruleRepository.save(rule);
    }
}
