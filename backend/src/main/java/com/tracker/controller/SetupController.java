package com.tracker.controller;

import com.tracker.api.SetupApi;
import com.tracker.api.model.CurrentUserResponse;
import com.tracker.api.model.SetupRequest;
import com.tracker.api.model.SetupStatusResponse;
import com.tracker.model.entity.User;
import com.tracker.security.AppUserDetails;
import com.tracker.service.AuthService;
import com.tracker.service.SetupService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class SetupController implements SetupApi {

    private final SetupService setupService;
    private final AuthService authService;
    private final UserMapper userMapper;
    private final HttpServletRequest request;

    public SetupController(SetupService setupService, AuthService authService,
                           UserMapper userMapper, HttpServletRequest request) {
        this.setupService = setupService;
        this.authService = authService;
        this.userMapper = userMapper;
        this.request = request;
    }

    @Override
    public ResponseEntity<SetupStatusResponse> getSetupStatus() {
        SetupStatusResponse response = new SetupStatusResponse(setupService.needsSetup());
        return ResponseEntity.ok(response);
    }

    @Override
    public ResponseEntity<CurrentUserResponse> initializeSetup(SetupRequest setupRequest) {
        User admin = setupService.createFirstAdmin(setupRequest.getUsername(), setupRequest.getPassword());
        authService.programmaticLogin(new AppUserDetails(admin), request);
        return ResponseEntity.ok(userMapper.toCurrentUserResponse(admin));
    }
}
