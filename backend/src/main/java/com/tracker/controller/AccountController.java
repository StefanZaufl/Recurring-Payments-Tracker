package com.tracker.controller;

import com.tracker.api.AccountApi;
import com.tracker.api.model.ChangePasswordRequest;
import com.tracker.api.model.ChangeUsernameRequest;
import com.tracker.api.model.CurrentUserResponse;
import com.tracker.model.entity.User;
import com.tracker.service.UserContextService;
import com.tracker.service.UserService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class AccountController implements AccountApi {

    private final UserService userService;
    private final UserContextService userContextService;
    private final UserMapper userMapper;

    public AccountController(UserService userService, UserContextService userContextService,
                             UserMapper userMapper) {
        this.userService = userService;
        this.userContextService = userContextService;
        this.userMapper = userMapper;
    }

    @Override
    public ResponseEntity<Void> changePassword(ChangePasswordRequest changePasswordRequest) {
        userService.changePassword(
                userContextService.getCurrentUserId(),
                changePasswordRequest.getCurrentPassword(),
                changePasswordRequest.getNewPassword());
        return ResponseEntity.noContent().build();
    }

    @Override
    public ResponseEntity<CurrentUserResponse> changeUsername(ChangeUsernameRequest changeUsernameRequest) {
        User updated = userService.changeUsername(
                userContextService.getCurrentUserId(),
                changeUsernameRequest.getNewUsername());
        return ResponseEntity.ok(userMapper.toCurrentUserResponse(updated));
    }
}
