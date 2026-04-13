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

import java.util.UUID;

import static com.tracker.testutil.SecurityTestUtil.authenticatedUser;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AdminUserControllerTest {

    private static final String ADMIN_USERS_URL = "/api/admin/users";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private User adminUser;
    private User regularUser;

    @BeforeEach
    void setUp() {
        userRepository.deleteAll();
        adminUser = saveUser("admin-user", "admin-password", UserRole.ADMIN, true);
        regularUser = saveUser("regular-user", "user-password", UserRole.USER, true);
    }

    @Test
    void listUsersReturnsMappedUsersForAdmin() throws Exception {
        mockMvc.perform(get(ADMIN_USERS_URL).with(authenticatedUser(adminUser)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].username", containsInAnyOrder("admin-user", "regular-user")))
                .andExpect(jsonPath("$[*].role", containsInAnyOrder("ADMIN", "USER")));
    }

    @Test
    void createUserReturns201AndLocationHeader() throws Exception {
        mockMvc.perform(post(ADMIN_USERS_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                            {
                              "username": "new-user",
                              "password": "secure-password",
                              "role": "USER"
                            }
                            """)
                        .with(authenticatedUser(adminUser)))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", containsString("/api/admin/users/")))
                .andExpect(jsonPath("$.username").value("new-user"))
                .andExpect(jsonPath("$.role").value("USER"))
                .andExpect(jsonPath("$.enabled").value(true));
    }

    @Test
    void createUserPersistsEncodedPassword() throws Exception {
        mockMvc.perform(post(ADMIN_USERS_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                            {
                              "username": "created-user",
                              "password": "plain-secret",
                              "role": "USER"
                            }
                            """)
                        .with(authenticatedUser(adminUser)))
                .andExpect(status().isCreated());

        User createdUser = userRepository.findByUsername("created-user").orElseThrow();
        org.assertj.core.api.Assertions.assertThat(passwordEncoder.matches("plain-secret", createdUser.getPasswordHash()))
                .isTrue();
    }

    @Test
    void createUserReturns409ForDuplicateUsername() throws Exception {
        mockMvc.perform(post(ADMIN_USERS_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                            {
                              "username": "regular-user",
                              "password": "secure-password",
                              "role": "USER"
                            }
                            """)
                        .with(authenticatedUser(adminUser)))
                .andExpect(status().isConflict());
    }

    @Test
    void updateUserChangesProvidedFields() throws Exception {
        mockMvc.perform(put(ADMIN_USERS_URL + "/{id}", regularUser.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                            {
                              "username": "renamed-user",
                              "password": "changed-password",
                              "role": "ADMIN",
                              "enabled": false
                            }
                            """)
                        .with(authenticatedUser(adminUser)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(regularUser.getId().toString()))
                .andExpect(jsonPath("$.username").value("renamed-user"))
                .andExpect(jsonPath("$.role").value("ADMIN"))
                .andExpect(jsonPath("$.enabled").value(false));

        User updatedUser = userRepository.findById(regularUser.getId()).orElseThrow();
        org.assertj.core.api.Assertions.assertThat(passwordEncoder.matches("changed-password", updatedUser.getPasswordHash()))
                .isTrue();
    }

    @Test
    void updateUserReturns404ForUnknownId() throws Exception {
        mockMvc.perform(put(ADMIN_USERS_URL + "/{id}", UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                            {
                              "username": "missing-user"
                            }
                            """)
                        .with(authenticatedUser(adminUser)))
                .andExpect(status().isNotFound());
    }

    @Test
    void updateUserReturns409ForDuplicateUsername() throws Exception {
        User otherUser = saveUser("other-user", "other-password", UserRole.USER, true);

        mockMvc.perform(put(ADMIN_USERS_URL + "/{id}", otherUser.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                            {
                              "username": "regular-user"
                            }
                            """)
                        .with(authenticatedUser(adminUser)))
                .andExpect(status().isConflict());
    }

    @Test
    void adminEndpointsReturn403ForNonAdminUser() throws Exception {
        mockMvc.perform(get(ADMIN_USERS_URL).with(authenticatedUser(regularUser)))
                .andExpect(status().isForbidden());
    }

    @Test
    void adminEndpointsReturn401WhenUnauthenticated() throws Exception {
        mockMvc.perform(get(ADMIN_USERS_URL))
                .andExpect(status().isUnauthorized());
    }

    private User saveUser(String username, String password, UserRole role, boolean enabled) {
        User user = new User();
        user.setUsername(username);
        user.setPasswordHash(passwordEncoder.encode(password));
        user.setRole(role);
        user.setEnabled(enabled);
        return userRepository.save(user);
    }
}
