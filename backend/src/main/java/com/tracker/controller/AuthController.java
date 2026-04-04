package com.tracker.controller;

import com.tracker.api.AuthApi;
import com.tracker.api.model.CurrentUserResponse;
import com.tracker.api.model.LoginRequest;
import com.tracker.security.AppUserDetails;
import com.tracker.service.AuthService;
import com.tracker.service.UserContextService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class AuthController implements AuthApi {

    private final AuthService authService;
    private final UserContextService userContextService;
    private final UserMapper userMapper;
    private final HttpServletRequest request;

    public AuthController(AuthService authService, UserContextService userContextService,
                          UserMapper userMapper, HttpServletRequest request) {
        this.authService = authService;
        this.userContextService = userContextService;
        this.userMapper = userMapper;
        this.request = request;
    }

    @Override
    public ResponseEntity<CurrentUserResponse> login(LoginRequest loginRequest) {
        AppUserDetails userDetails = authService.authenticate(
                loginRequest.getUsername(), loginRequest.getPassword(), request);
        return ResponseEntity.ok(userMapper.toCurrentUserResponse(userDetails.getUser()));
    }

    @Override
    public ResponseEntity<Void> logout() {
        HttpSession session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }
        SecurityContextHolder.clearContext();
        return ResponseEntity.noContent().build();
    }

    @Override
    public ResponseEntity<CurrentUserResponse> getCurrentUser() {
        return ResponseEntity.ok(userMapper.toCurrentUserResponse(userContextService.getCurrentUser()));
    }
}
