package com.tracker.users.api;

import com.tracker.api.model.AdminUserDto;
import com.tracker.api.model.CurrentUserResponse;
import com.tracker.users.domain.User;
import com.tracker.users.domain.UserRole;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.util.List;

@Mapper(componentModel = "spring")
public interface UserMapper {

    @Mapping(target = "role", expression = "java(mapRole(user.getRole()))")
    CurrentUserResponse toCurrentUserResponse(User user);

    @Mapping(target = "role", expression = "java(mapRole(user.getRole()))")
    AdminUserDto toAdminUserDto(User user);

    List<AdminUserDto> toAdminUserDtoList(List<User> users);

    default com.tracker.api.model.UserRole mapRole(UserRole role) {
        return com.tracker.api.model.UserRole.fromValue(role.name());
    }

    default UserRole mapApiRole(com.tracker.api.model.UserRole role) {
        return UserRole.valueOf(role.getValue());
    }
}
