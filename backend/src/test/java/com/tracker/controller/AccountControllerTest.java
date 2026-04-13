package com.tracker.controller;

import com.tracker.model.entity.User;
import com.tracker.model.entity.UserRole;
import com.tracker.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static com.tracker.testutil.SecurityTestUtil.authenticatedUser;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AccountControllerTest {

    private static final String ACCOUNT_PASSWORD_URL = "/api/account/password";
    private static final String ACCOUNT_USERNAME_URL = "/api/account/username";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private User testUser;

    @BeforeEach
    void setUp() {
        userRepository.deleteAll();

        User user = new User();
        user.setUsername("account-admin");
        user.setPasswordHash(passwordEncoder.encode("correct-password"));
        user.setRole(UserRole.ADMIN);
        user.setEnabled(true);
        testUser = userRepository.save(user);
    }

    @Test
    void returns401WhenCurrentPasswordIsWrong() throws Exception {
        mockMvc.perform(put(ACCOUNT_PASSWORD_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                            {
                              "currentPassword": "wrong-password",
                              "newPassword": "new-secure-password"
                            }
                            """)
                        .with(authenticatedUser(testUser)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message", containsString("Current password is incorrect")));
    }

    @Test
    void returns204WhenPasswordChangesSuccessfully() throws Exception {
        mockMvc.perform(put(ACCOUNT_PASSWORD_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                            {
                              "currentPassword": "correct-password",
                              "newPassword": "new-secure-password"
                            }
                            """)
                        .with(authenticatedUser(testUser)))
                .andExpect(status().isNoContent());
    }

    @Test
    void returns200WhenUsernameChangesSuccessfully() throws Exception {
        mockMvc.perform(put(ACCOUNT_USERNAME_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                            {
                              "newUsername": "renamed-admin"
                            }
                            """)
                        .with(authenticatedUser(testUser)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(testUser.getId().toString()))
                .andExpect(jsonPath("$.username").value("renamed-admin"))
                .andExpect(jsonPath("$.role").value("ADMIN"));
    }

    @Test
    void returns409WhenNewUsernameAlreadyExists() throws Exception {
        User user = new User();
        user.setUsername("taken-name");
        user.setPasswordHash(passwordEncoder.encode("another-password"));
        user.setRole(UserRole.USER);
        user.setEnabled(true);
        userRepository.save(user);

        mockMvc.perform(put(ACCOUNT_USERNAME_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                            {
                              "newUsername": "taken-name"
                            }
                            """)
                        .with(authenticatedUser(testUser)))
                .andExpect(status().isConflict());
    }

    @Test
    void returns401WhenUsernameChangeIsUnauthenticated() throws Exception {
        mockMvc.perform(put(ACCOUNT_USERNAME_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                            {
                              "newUsername": "renamed-admin"
                            }
                            """)
                        .with(csrf()))
                .andExpect(status().isUnauthorized());
    }
}
