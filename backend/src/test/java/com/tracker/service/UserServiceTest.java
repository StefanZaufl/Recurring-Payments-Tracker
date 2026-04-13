package com.tracker.service;

import com.tracker.controller.InvalidCurrentPasswordException;
import com.tracker.controller.ResourceNotFoundException;
import com.tracker.model.entity.User;
import com.tracker.model.entity.UserRole;
import com.tracker.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    private UserService userService;

    @BeforeEach
    void setUp() {
        userService = new UserService(userRepository, passwordEncoder);
    }

    @Test
    void listAllUsersDelegatesToRepository() {
        List<User> users = List.of(new User(), new User());
        when(userRepository.findAll()).thenReturn(users);

        assertThat(userService.listAllUsers()).isSameAs(users);
    }

    @Test
    void createUserSavesEncodedPasswordAndEnablesUser() {
        when(userRepository.existsByUsername("new-user")).thenReturn(false);
        when(passwordEncoder.encode("plain-password")).thenReturn("encoded-password");
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        User created = userService.createUser("new-user", "plain-password", UserRole.ADMIN);

        assertThat(created.getUsername()).isEqualTo("new-user");
        assertThat(created.getPasswordHash()).isEqualTo("encoded-password");
        assertThat(created.getRole()).isEqualTo(UserRole.ADMIN);
        assertThat(created.isEnabled()).isTrue();
    }

    @Test
    void createUserRejectsDuplicateUsername() {
        when(userRepository.existsByUsername("existing-user")).thenReturn(true);

        assertThatThrownBy(() -> userService.createUser("existing-user", "secret", UserRole.USER))
                .isInstanceOf(DataIntegrityViolationException.class)
                .hasMessageContaining("Username already taken");
    }

    @Test
    void updateUserChangesOnlyProvidedFields() {
        UUID userId = UUID.randomUUID();
        User existing = existingUser(userId, "before-user");
        LocalDateTime initialUpdatedAt = existing.getUpdatedAt();

        when(userRepository.findById(userId)).thenReturn(Optional.of(existing));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        User updated = userService.updateUser(userId, null, null, null, false);

        assertThat(updated.getUsername()).isEqualTo("before-user");
        assertThat(updated.getRole()).isEqualTo(UserRole.USER);
        assertThat(updated.isEnabled()).isFalse();
        assertThat(updated.getUpdatedAt()).isAfter(initialUpdatedAt);
    }

    @Test
    void updateUserChangesPasswordRoleAndUsername() {
        UUID userId = UUID.randomUUID();
        User existing = existingUser(userId, "before-user");

        when(userRepository.findById(userId)).thenReturn(Optional.of(existing));
        when(userRepository.existsByUsername("after-user")).thenReturn(false);
        when(passwordEncoder.encode("new-password")).thenReturn("encoded-new-password");
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        User updated = userService.updateUser(userId, "after-user", "new-password", UserRole.ADMIN, true);

        assertThat(updated.getUsername()).isEqualTo("after-user");
        assertThat(updated.getPasswordHash()).isEqualTo("encoded-new-password");
        assertThat(updated.getRole()).isEqualTo(UserRole.ADMIN);
        assertThat(updated.isEnabled()).isTrue();
    }

    @Test
    void updateUserRejectsDuplicateRenamedUsername() {
        UUID userId = UUID.randomUUID();
        User existing = existingUser(userId, "before-user");

        when(userRepository.findById(userId)).thenReturn(Optional.of(existing));
        when(userRepository.existsByUsername("taken-user")).thenReturn(true);

        assertThatThrownBy(() -> userService.updateUser(userId, "taken-user", null, null, null))
                .isInstanceOf(DataIntegrityViolationException.class)
                .hasMessageContaining("Username already taken");
    }

    @Test
    void updateUserThrowsWhenUserIsMissing() {
        UUID userId = UUID.randomUUID();
        when(userRepository.findById(userId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userService.updateUser(userId, "name", null, null, null))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining(userId.toString());
    }

    @Test
    void changePasswordUpdatesStoredHashWhenCurrentPasswordMatches() {
        UUID userId = UUID.randomUUID();
        User existing = existingUser(userId, "user");

        when(userRepository.findById(userId)).thenReturn(Optional.of(existing));
        when(passwordEncoder.matches("current-password", existing.getPasswordHash())).thenReturn(true);
        when(passwordEncoder.encode("next-password")).thenReturn("encoded-next-password");

        userService.changePassword(userId, "current-password", "next-password");

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(captor.capture());
        assertThat(captor.getValue().getPasswordHash()).isEqualTo("encoded-next-password");
    }

    @Test
    void changePasswordRejectsWrongCurrentPassword() {
        UUID userId = UUID.randomUUID();
        User existing = existingUser(userId, "user");

        when(userRepository.findById(userId)).thenReturn(Optional.of(existing));
        when(passwordEncoder.matches("wrong-password", existing.getPasswordHash())).thenReturn(false);

        assertThatThrownBy(() -> userService.changePassword(userId, "wrong-password", "next-password"))
                .isInstanceOf(InvalidCurrentPasswordException.class)
                .hasMessageContaining("Current password is incorrect");
    }

    @Test
    void changeUsernameUpdatesUsernameAndTimestamp() {
        UUID userId = UUID.randomUUID();
        User existing = existingUser(userId, "before-user");
        LocalDateTime initialUpdatedAt = existing.getUpdatedAt();

        when(userRepository.findById(userId)).thenReturn(Optional.of(existing));
        when(userRepository.existsByUsername("after-user")).thenReturn(false);
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        User updated = userService.changeUsername(userId, "after-user");

        assertThat(updated.getUsername()).isEqualTo("after-user");
        assertThat(updated.getUpdatedAt()).isAfter(initialUpdatedAt);
    }

    @Test
    void changeUsernameRejectsDuplicateUsername() {
        UUID userId = UUID.randomUUID();
        User existing = existingUser(userId, "before-user");

        when(userRepository.findById(userId)).thenReturn(Optional.of(existing));
        when(userRepository.existsByUsername("taken-user")).thenReturn(true);

        assertThatThrownBy(() -> userService.changeUsername(userId, "taken-user"))
                .isInstanceOf(DataIntegrityViolationException.class)
                .hasMessageContaining("Username already taken");
    }

    @Test
    void changeUsernameThrowsWhenUserIsMissing() {
        UUID userId = UUID.randomUUID();
        when(userRepository.findById(userId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userService.changeUsername(userId, "new-name"))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining(userId.toString());
    }

    private User existingUser(UUID id, String username) {
        User user = new User();
        user.setId(id);
        user.setUsername(username);
        user.setPasswordHash("stored-hash");
        user.setRole(UserRole.USER);
        user.setEnabled(true);
        user.setUpdatedAt(LocalDateTime.now().minusDays(1));
        return user;
    }
}
