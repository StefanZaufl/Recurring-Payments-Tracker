package com.tracker.controller;

import com.tracker.api.AdminUsersApi;
import com.tracker.api.model.AdminUserDto;
import com.tracker.api.model.CreateUserRequest;
import com.tracker.api.model.UpdateUserRequest;
import com.tracker.model.entity.User;
import com.tracker.model.entity.UserRole;
import com.tracker.service.UserService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.util.List;
import java.util.UUID;

@RestController
public class AdminUserController implements AdminUsersApi {

    private final UserService userService;
    private final UserMapper userMapper;

    public AdminUserController(UserService userService, UserMapper userMapper) {
        this.userService = userService;
        this.userMapper = userMapper;
    }

    @Override
    public ResponseEntity<List<AdminUserDto>> listUsers() {
        return ResponseEntity.ok(userMapper.toAdminUserDtoList(userService.listAllUsers()));
    }

    @Override
    public ResponseEntity<AdminUserDto> createUser(CreateUserRequest createUserRequest) {
        UserRole role = userMapper.mapApiRole(createUserRequest.getRole());
        User user = userService.createUser(
                createUserRequest.getUsername(),
                createUserRequest.getPassword(),
                role);
        return ResponseEntity.created(URI.create("/api/admin/users/" + user.getId()))
                .body(userMapper.toAdminUserDto(user));
    }

    @Override
    public ResponseEntity<AdminUserDto> updateUser(UUID id, UpdateUserRequest updateUserRequest) {
        UserRole role = updateUserRequest.getRole() != null
                ? userMapper.mapApiRole(updateUserRequest.getRole()) : null;
        User user = userService.updateUser(id,
                updateUserRequest.getUsername(),
                updateUserRequest.getPassword(),
                role,
                updateUserRequest.getEnabled());
        return ResponseEntity.ok(userMapper.toAdminUserDto(user));
    }
}
