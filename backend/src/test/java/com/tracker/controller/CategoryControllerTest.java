package com.tracker.controller;

import com.tracker.model.entity.Category;
import com.tracker.model.entity.User;
import com.tracker.repository.CategoryRepository;
import com.tracker.repository.RecurringPaymentRepository;
import com.tracker.repository.TransactionRecurringLinkRepository;
import com.tracker.repository.UserRepository;
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

import java.util.UUID;

import static com.tracker.testutil.SecurityTestUtil.authenticatedUser;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class CategoryControllerTest {

    private static final String CATEGORIES_URL = "/api/categories";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private CategoryRepository categoryRepository;

    @Autowired
    private TransactionRecurringLinkRepository linkRepository;

    @Autowired
    private RecurringPaymentRepository recurringPaymentRepository;

    @Autowired
    private UserRepository userRepository;

    private User testUser;

    @BeforeEach
    void setUp() {
        linkRepository.deleteAll();
        recurringPaymentRepository.deleteAll();
        categoryRepository.deleteAll();
        testUser = SecurityTestUtil.createTestUser(userRepository);
    }

    // ────────────────────────────────────────────────────────────────────
    // GET /api/categories
    // ────────────────────────────────────────────────────────────────────

    @Nested
    class GetCategories {

        @Test
        void returnsEmptyListWhenNoneExist() throws Exception {
            mockMvc.perform(get(CATEGORIES_URL).with(authenticatedUser(testUser)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$", hasSize(0)));
        }

        @Test
        void returnsAllCategories() throws Exception {
            seedCategory("Streaming", "#FF0000");
            seedCategory("Insurance", "#00FF00");

            mockMvc.perform(get(CATEGORIES_URL).with(authenticatedUser(testUser)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$", hasSize(2)))
                    .andExpect(jsonPath("$[*].name", containsInAnyOrder("Streaming", "Insurance")));
        }

        @Test
        void returnsCorrectDtoFields() throws Exception {
            Category category = seedCategory("Streaming", "#FF0000");

            mockMvc.perform(get(CATEGORIES_URL).with(authenticatedUser(testUser)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$[0].id").value(category.getId().toString()))
                    .andExpect(jsonPath("$[0].name").value("Streaming"))
                    .andExpect(jsonPath("$[0].color").value("#FF0000"));
        }
    }

    // ────────────────────────────────────────────────────────────────────
    // GET /api/categories/{id}
    // ────────────────────────────────────────────────────────────────────

    @Nested
    class GetCategoryById {

        @Test
        void returnsCategory() throws Exception {
            Category category = seedCategory("Streaming", "#FF0000");

            mockMvc.perform(get(CATEGORIES_URL + "/{id}", category.getId()).with(authenticatedUser(testUser)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.id").value(category.getId().toString()))
                    .andExpect(jsonPath("$.name").value("Streaming"))
                    .andExpect(jsonPath("$.color").value("#FF0000"));
        }

        @Test
        void returns404ForNonExistentId() throws Exception {
            mockMvc.perform(get(CATEGORIES_URL + "/{id}", UUID.randomUUID()).with(authenticatedUser(testUser)))
                    .andExpect(status().isNotFound());
        }
    }

    // ────────────────────────────────────────────────────────────────────
    // POST /api/categories
    // ────────────────────────────────────────────────────────────────────

    @Nested
    class CreateCategory {

        @Test
        void createsCategory() throws Exception {
            mockMvc.perform(post(CATEGORIES_URL)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"name\": \"Streaming\", \"color\": \"#FF0000\"}")
                            .with(authenticatedUser(testUser)))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.id").isNotEmpty())
                    .andExpect(jsonPath("$.name").value("Streaming"))
                    .andExpect(jsonPath("$.color").value("#FF0000"));
        }

        @Test
        void createsCategoryWithoutColor() throws Exception {
            mockMvc.perform(post(CATEGORIES_URL)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"name\": \"Streaming\"}")
                            .with(authenticatedUser(testUser)))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.name").value("Streaming"))
                    .andExpect(jsonPath("$.color").isEmpty());
        }

        @Test
        void returns409ForDuplicateName() throws Exception {
            seedCategory("Streaming", "#FF0000");

            mockMvc.perform(post(CATEGORIES_URL)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"name\": \"Streaming\"}")
                            .with(authenticatedUser(testUser)))
                    .andExpect(status().isConflict());
        }
    }

    // ────────────────────────────────────────────────────────────────────
    // PUT /api/categories/{id}
    // ────────────────────────────────────────────────────────────────────

    @Nested
    class UpdateCategory {

        @Test
        void updatesName() throws Exception {
            Category category = seedCategory("Streaming", "#FF0000");

            mockMvc.perform(put(CATEGORIES_URL + "/{id}", category.getId())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"name\": \"Entertainment\"}")
                            .with(authenticatedUser(testUser)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.name").value("Entertainment"))
                    .andExpect(jsonPath("$.color").value("#FF0000"));
        }

        @Test
        void updatesColor() throws Exception {
            Category category = seedCategory("Streaming", "#FF0000");

            mockMvc.perform(put(CATEGORIES_URL + "/{id}", category.getId())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"color\": \"#0000FF\"}")
                            .with(authenticatedUser(testUser)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.name").value("Streaming"))
                    .andExpect(jsonPath("$.color").value("#0000FF"));
        }

        @Test
        void returns404ForNonExistentId() throws Exception {
            mockMvc.perform(put(CATEGORIES_URL + "/{id}", UUID.randomUUID())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"name\": \"Test\"}")
                            .with(authenticatedUser(testUser)))
                    .andExpect(status().isNotFound());
        }

        @Test
        void returns409ForDuplicateName() throws Exception {
            seedCategory("Streaming", "#FF0000");
            Category other = seedCategory("Insurance", "#00FF00");

            mockMvc.perform(put(CATEGORIES_URL + "/{id}", other.getId())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"name\": \"Streaming\"}")
                            .with(authenticatedUser(testUser)))
                    .andExpect(status().isConflict());
        }
    }

    // ────────────────────────────────────────────────────────────────────
    // DELETE /api/categories/{id}
    // ────────────────────────────────────────────────────────────────────

    @Nested
    class DeleteCategory {

        @Test
        void deletesCategory() throws Exception {
            Category category = seedCategory("Streaming", "#FF0000");

            mockMvc.perform(delete(CATEGORIES_URL + "/{id}", category.getId()).with(authenticatedUser(testUser)))
                    .andExpect(status().isNoContent());

            mockMvc.perform(get(CATEGORIES_URL).with(authenticatedUser(testUser)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$", hasSize(0)));
        }

        @Test
        void returns404ForNonExistentId() throws Exception {
            mockMvc.perform(delete(CATEGORIES_URL + "/{id}", UUID.randomUUID()).with(authenticatedUser(testUser)))
                    .andExpect(status().isNotFound());
        }
    }

    // ────────────────────────────────────────────────────────────────────
    // Test helpers
    // ────────────────────────────────────────────────────────────────────

    private Category seedCategory(String name, String color) {
        Category category = new Category();
        category.setName(name);
        category.setColor(color);
        category.setUser(testUser);
        return categoryRepository.save(category);
    }
}
