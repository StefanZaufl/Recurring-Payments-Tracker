package com.tracker.controller;

import com.tracker.model.entity.SetupState;
import com.tracker.repository.CategoryRepository;
import com.tracker.repository.FileUploadRepository;
import com.tracker.repository.PaymentPeriodHistoryRepository;
import com.tracker.repository.RecurringPaymentRepository;
import com.tracker.repository.RuleRepository;
import com.tracker.repository.SetupStateRepository;
import com.tracker.repository.TransactionRecurringLinkRepository;
import com.tracker.repository.TransactionRepository;
import com.tracker.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SetupControllerTest {

    private static final String SETUP_URL = "/api/setup/init";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PaymentPeriodHistoryRepository historyRepository;

    @Autowired
    private TransactionRecurringLinkRepository linkRepository;

    @Autowired
    private RuleRepository ruleRepository;

    @Autowired
    private RecurringPaymentRepository recurringPaymentRepository;

    @Autowired
    private TransactionRepository transactionRepository;

    @Autowired
    private FileUploadRepository fileUploadRepository;

    @Autowired
    private CategoryRepository categoryRepository;

    @Autowired
    private SetupStateRepository setupStateRepository;

    @BeforeEach
    void setUp() {
        historyRepository.deleteAll();
        linkRepository.deleteAll();
        ruleRepository.deleteAll();
        recurringPaymentRepository.deleteAll();
        transactionRepository.deleteAll();
        fileUploadRepository.deleteAll();
        categoryRepository.deleteAll();
        userRepository.deleteAll();
        setupStateRepository.deleteAll();
        setupStateRepository.save(new SetupState());
    }

    @Test
    void returns400WhenUsernameIsMissing() throws Exception {
        mockMvc.perform(post(SETUP_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                            {
                              "password": "securepass"
                            }
                            """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("username")));
    }

    @Test
    void returns400WhenPasswordIsMissing() throws Exception {
        mockMvc.perform(post(SETUP_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                            {
                              "username": "admin"
                            }
                            """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("password")));
    }
}
