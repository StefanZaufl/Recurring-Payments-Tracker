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
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static com.tracker.testutil.SecurityTestUtil.authenticatedUser;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class AuthControllerTest {

    private static final String AUTH_ME_URL = "/api/auth/me";
    private static final String AUTH_LOGIN_URL = "/api/auth/login";
    private static final String AUTH_LOGOUT_URL = "/api/auth/logout";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private User testUser;

    @BeforeEach
    void setUp() {
        User user = new User();
        user.setUsername("auth-admin");
        user.setPasswordHash(passwordEncoder.encode("correct-password"));
        user.setRole(UserRole.ADMIN);
        user.setEnabled(true);
        testUser = userRepository.save(user);
    }

    @Test
    void returns401WhenCurrentUserRequestedWithoutAuthentication() throws Exception {
        mockMvc.perform(get(AUTH_ME_URL))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Authentication required"));
    }

    @Test
    void returnsCurrentUserWhenAuthenticated() throws Exception {
        mockMvc.perform(get(AUTH_ME_URL).with(authenticatedUser(testUser)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(testUser.getId().toString()))
                .andExpect(jsonPath("$.username").value("auth-admin"))
                .andExpect(jsonPath("$.role").value("ADMIN"));
    }

    @Test
    void logoutInvalidatesSessionAndSubsequentCurrentUserRequestReturns401() throws Exception {
        MockHttpSession session = (MockHttpSession) mockMvc.perform(post(AUTH_LOGIN_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                            {
                              "username": "auth-admin",
                              "password": "correct-password"
                            }
                            """))
                .andExpect(status().isOk())
                .andReturn()
                .getRequest()
                .getSession(false);

        mockMvc.perform(post(AUTH_LOGOUT_URL).session(session).with(csrf()))
                .andExpect(status().isNoContent());

        mockMvc.perform(get(AUTH_ME_URL).session(session))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Authentication required"));
    }

    @Test
    void returns401WhenLoginCredentialsAreInvalid() throws Exception {
        mockMvc.perform(post(AUTH_LOGIN_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                            {
                              "username": "auth-admin",
                              "password": "wrong-password"
                            }
                            """))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Invalid username or password"));
    }

    @Test
    void loginStoresSecurityContextInSession() throws Exception {
        MockHttpSession session = (MockHttpSession) mockMvc.perform(post(AUTH_LOGIN_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                            {
                              "username": "auth-admin",
                              "password": "correct-password"
                            }
                            """))
                .andExpect(status().isOk())
                .andReturn()
                .getRequest()
                .getSession(false);

        mockMvc.perform(get(AUTH_ME_URL).session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("auth-admin"));
        org.assertj.core.api.Assertions.assertThat(session)
                .isNotNull();
        org.assertj.core.api.Assertions.assertThat(session.getAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY))
                .isNotNull();
    }
}
