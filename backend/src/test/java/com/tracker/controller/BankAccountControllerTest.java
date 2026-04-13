package com.tracker.controller;

import com.tracker.model.entity.BankAccount;
import com.tracker.repository.FileUploadRepository;
import com.tracker.repository.PaymentPeriodHistoryRepository;
import com.tracker.repository.RecurringPaymentRepository;
import com.tracker.repository.RuleRepository;
import com.tracker.repository.TransactionRecurringLinkRepository;
import com.tracker.repository.TransactionRepository;
import com.tracker.model.entity.User;
import com.tracker.repository.BankAccountRepository;
import com.tracker.repository.UserRepository;
import com.tracker.testutil.SecurityTestUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static com.tracker.testutil.SecurityTestUtil.authenticatedUser;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class BankAccountControllerTest {

    private static final String BANK_ACCOUNTS_URL = "/api/bank-accounts";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private BankAccountRepository bankAccountRepository;
    @Autowired
    private TransactionRepository transactionRepository;
    @Autowired
    private TransactionRecurringLinkRepository linkRepository;
    @Autowired
    private RuleRepository ruleRepository;
    @Autowired
    private RecurringPaymentRepository recurringPaymentRepository;
    @Autowired
    private FileUploadRepository fileUploadRepository;
    @Autowired
    private PaymentPeriodHistoryRepository historyRepository;

    @Autowired
    private UserRepository userRepository;

    private User testUser;

    @BeforeEach
    void setUp() {
        historyRepository.deleteAll();
        linkRepository.deleteAll();
        ruleRepository.deleteAll();
        recurringPaymentRepository.deleteAll();
        transactionRepository.deleteAll();
        fileUploadRepository.deleteAll();
        bankAccountRepository.deleteAll();
        testUser = SecurityTestUtil.createTestUser(userRepository);
    }

    @Test
    void createBankAccount_returnsCreatedAccountAndRecalculationSummary() throws Exception {
        mockMvc.perform(post(BANK_ACCOUNTS_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"iban\":\"DE111\",\"name\":\"Checking\"}")
                        .with(authenticatedUser(testUser)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.bankAccount.iban").value("DE111"))
                .andExpect(jsonPath("$.bankAccount.name").value("Checking"))
                .andExpect(jsonPath("$.recalculationSummary.transactionsMarkedInterAccount").value(0))
                .andExpect(jsonPath("$.recalculationSummary.transactionLinksRemoved").value(0))
                .andExpect(jsonPath("$.recalculationSummary.recurringPaymentsDeleted").value(0))
                .andExpect(jsonPath("$.recalculationSummary.recurringPaymentsDetected").value(0));
    }

    @Test
    void createBankAccount_allowsMissingName() throws Exception {
        mockMvc.perform(post(BANK_ACCOUNTS_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"iban\":\"DE333\"}")
                        .with(authenticatedUser(testUser)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.bankAccount.iban").value("DE333"))
                .andExpect(jsonPath("$.bankAccount.name").doesNotExist());
    }

    @Test
    void updateBankAccount_updatesName() throws Exception {
        BankAccount account = seedAccount("DE111", "Checking");

        mockMvc.perform(put(BANK_ACCOUNTS_URL + "/{id}", account.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Main Checking\"}")
                        .with(authenticatedUser(testUser)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.iban").value("DE111"))
                .andExpect(jsonPath("$.name").value("Main Checking"));
    }

    @Test
    void updateBankAccount_clearsNameWhenNullProvided() throws Exception {
        BankAccount account = seedAccount("DE111", "Checking");

        mockMvc.perform(put(BANK_ACCOUNTS_URL + "/{id}", account.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":null}")
                        .with(authenticatedUser(testUser)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.iban").value("DE111"))
                .andExpect(jsonPath("$.name").value(nullValue()));
    }

    @Test
    void updateBankAccount_preservesExistingNameWhenFieldOmitted() throws Exception {
        BankAccount account = seedAccount("DE111", "Checking");

        mockMvc.perform(put(BANK_ACCOUNTS_URL + "/{id}", account.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}")
                        .with(authenticatedUser(testUser)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.iban").value("DE111"))
                .andExpect(jsonPath("$.name").value("Checking"));
    }

    @Test
    void updateBankAccount_returns404ForUnknownId() throws Exception {
        mockMvc.perform(put(BANK_ACCOUNTS_URL + "/{id}", UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Main Checking\"}")
                        .with(authenticatedUser(testUser)))
                .andExpect(status().isNotFound());
    }

    @Test
    void deleteBankAccount_returnsSummary() throws Exception {
        BankAccount account = seedAccount("DE111", "Checking");

        mockMvc.perform(delete(BANK_ACCOUNTS_URL + "/{id}", account.getId())
                        .with(authenticatedUser(testUser)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.transactionsMarkedInterAccount", is(0)))
                .andExpect(jsonPath("$.transactionLinksRemoved", is(0)))
                .andExpect(jsonPath("$.recurringPaymentsDeleted", is(0)))
                .andExpect(jsonPath("$.recurringPaymentsDetected", is(0)));
    }

    @Test
    void deleteBankAccount_returns404ForUnknownId() throws Exception {
        mockMvc.perform(delete(BANK_ACCOUNTS_URL + "/{id}", UUID.randomUUID())
                        .with(authenticatedUser(testUser)))
                .andExpect(status().isNotFound());
    }

    @Test
    void getBankAccounts_returnsCurrentUsersAccounts() throws Exception {
        seedAccount("DE111", "Checking");
        seedAccount("DE222", "Savings");

        mockMvc.perform(get(BANK_ACCOUNTS_URL).with(authenticatedUser(testUser)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2));
    }

    private BankAccount seedAccount(String iban, String name) {
        BankAccount account = new BankAccount();
        account.setUser(testUser);
        account.setIban(iban);
        account.setName(name);
        return bankAccountRepository.save(account);
    }
}
