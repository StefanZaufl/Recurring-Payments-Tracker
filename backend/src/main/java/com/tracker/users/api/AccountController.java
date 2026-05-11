package com.tracker.users.api;

import com.tracker.api.AccountApi;
import com.tracker.api.model.ChangePasswordRequest;
import com.tracker.api.model.ChangeUsernameRequest;
import com.tracker.api.model.CurrentUserResponse;
import com.tracker.users.domain.User;
import com.tracker.users.application.UserContextService;
import com.tracker.users.application.UserService;
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
