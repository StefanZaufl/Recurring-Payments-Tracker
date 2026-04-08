package com.tracker.controller;

import com.tracker.model.entity.BankAccount;
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
import static org.hamcrest.Matchers.nullValue;
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
    private UserRepository userRepository;

    private User testUser;

    @BeforeEach
    void setUp() {
        bankAccountRepository.deleteAll();
        testUser = SecurityTestUtil.createTestUser(userRepository);
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
    void updateBankAccount_returns404ForUnknownId() throws Exception {
        mockMvc.perform(put(BANK_ACCOUNTS_URL + "/{id}", UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Main Checking\"}")
                        .with(authenticatedUser(testUser)))
                .andExpect(status().isNotFound());
    }

    private BankAccount seedAccount(String iban, String name) {
        BankAccount account = new BankAccount();
        account.setUser(testUser);
        account.setIban(iban);
        account.setName(name);
        return bankAccountRepository.save(account);
    }
}
