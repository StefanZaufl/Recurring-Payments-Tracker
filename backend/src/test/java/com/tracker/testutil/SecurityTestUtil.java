package com.tracker.testutil;

import com.tracker.model.entity.User;
import com.tracker.model.entity.UserRole;
import com.tracker.repository.UserRepository;
import com.tracker.security.AppUserDetails;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

public class SecurityTestUtil {

    public static final String TEST_USERNAME = "testuser";
    public static final String TEST_PASSWORD_HASH = "$2a$10$dummyhashfortest";

    public static User createTestUser(UserRepository userRepository) {
        return userRepository.findByUsername(TEST_USERNAME).orElseGet(() -> {
            User user = new User();
            user.setUsername(TEST_USERNAME);
            user.setPasswordHash(TEST_PASSWORD_HASH);
            user.setRole(UserRole.ADMIN);
            user.setEnabled(true);
            return userRepository.save(user);
        });
    }

    public static void setSecurityContext(User user) {
        AppUserDetails userDetails = new AppUserDetails(user);
        UsernamePasswordAuthenticationToken auth =
                new UsernamePasswordAuthenticationToken(userDetails, null, userDetails.getAuthorities());
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    public static RequestPostProcessor authenticatedUser(User user) {
        AppUserDetails userDetails = new AppUserDetails(user);
        RequestPostProcessor userProcessor = SecurityMockMvcRequestPostProcessors.user(userDetails);
        RequestPostProcessor csrfProcessor = SecurityMockMvcRequestPostProcessors.csrf();
        return (MockHttpServletRequest request) -> {
            request = userProcessor.postProcessRequest(request);
            request = csrfProcessor.postProcessRequest(request);
            return request;
        };
    }
}
