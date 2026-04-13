package com.tracker.service;

import com.tracker.model.entity.User;
import com.tracker.model.entity.UserRole;
import com.tracker.security.AppUserDetails;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private AuthenticationManager authenticationManager;

    @Mock
    private HttpServletRequest request;

    @Mock
    private HttpSession session;

    private AuthService authService;

    @BeforeEach
    void setUp() {
        authService = new AuthService(authenticationManager);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void authenticateStoresPrincipalInSecurityContextAndSession() {
        AppUserDetails userDetails = new AppUserDetails(testUser());
        Authentication authentication = new UsernamePasswordAuthenticationToken(
                userDetails, null, userDetails.getAuthorities());

        when(authenticationManager.authenticate(any(UsernamePasswordAuthenticationToken.class)))
                .thenReturn(authentication);
        when(request.getSession(true)).thenReturn(session);

        AppUserDetails result = authService.authenticate("admin", "secret", request);

        assertThat(result).isSameAs(userDetails);
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isSameAs(authentication);
        verify(session).setAttribute(
                org.mockito.ArgumentMatchers.eq(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY),
                any());
    }

    @Test
    void programmaticLoginStoresPrincipalInSecurityContextAndSessionWithoutAuthenticationManager() {
        AppUserDetails userDetails = new AppUserDetails(testUser());
        when(request.getSession(true)).thenReturn(session);

        authService.programmaticLogin(userDetails, request);

        assertThat(SecurityContextHolder.getContext().getAuthentication().getPrincipal()).isSameAs(userDetails);
        verify(session).setAttribute(
                org.mockito.ArgumentMatchers.eq(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY),
                any());
        verify(authenticationManager, never()).authenticate(any());
    }

    private User testUser() {
        User user = new User();
        user.setUsername("admin");
        user.setPasswordHash("hash");
        user.setRole(UserRole.ADMIN);
        user.setEnabled(true);
        return user;
    }
}
