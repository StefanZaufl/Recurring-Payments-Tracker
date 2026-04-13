package com.tracker.service;

import com.tracker.controller.SetupAlreadyCompleteException;
import com.tracker.model.entity.SetupState;
import com.tracker.model.entity.User;
import com.tracker.model.entity.UserRole;
import com.tracker.repository.SetupStateRepository;
import com.tracker.repository.UserRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SetupServiceBranchTest {

    @Mock
    private UserRepository userRepository;
    @Mock
    private SetupStateRepository setupStateRepository;
    @Mock
    private PasswordEncoder passwordEncoder;
    @Mock
    private DataMigrationService dataMigrationService;
    @Mock
    private EntityManager entityManager;

    private SetupService setupService;

    @BeforeEach
    void setUp() {
        setupService = new SetupService(
                userRepository,
                setupStateRepository,
                passwordEncoder,
                dataMigrationService,
                entityManager
        );
    }

    @Test
    void needsSetup_returnsTrueWhenStateMissingAndNoUsersExist() {
        when(setupStateRepository.findById(SetupState.SINGLETON_ID)).thenReturn(Optional.empty());
        when(userRepository.count()).thenReturn(0L);

        assertThat(setupService.needsSetup()).isTrue();
    }

    @Test
    void needsSetup_returnsFalseWhenStateMarkedComplete() {
        SetupState state = new SetupState();
        state.setCompleted(true);
        when(setupStateRepository.findById(SetupState.SINGLETON_ID)).thenReturn(Optional.of(state));

        assertThat(setupService.needsSetup()).isFalse();
    }

    @Test
    void needsSetup_returnsFalseWhenStateMissingButUsersAlreadyExist() {
        when(setupStateRepository.findById(SetupState.SINGLETON_ID)).thenReturn(Optional.empty());
        when(userRepository.count()).thenReturn(2L);

        assertThat(setupService.needsSetup()).isFalse();
    }

    @Test
    void createFirstAdmin_validatesRequiredFields() {
        assertThatThrownBy(() -> setupService.createFirstAdmin(" ", "secret"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("username is required");
        assertThatThrownBy(() -> setupService.createFirstAdmin("admin", " "))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("password is required");
    }

    @Test
    void createFirstAdmin_createsAdminAndMarksSetupComplete() {
        SetupState state = new SetupState();
        when(setupStateRepository.findByIdForUpdate(SetupState.SINGLETON_ID)).thenReturn(Optional.of(state));
        when(userRepository.count()).thenReturn(0L);
        when(passwordEncoder.encode("secret")).thenReturn("encoded");
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> {
            User user = invocation.getArgument(0);
            user.setId(UUID.randomUUID());
            return user;
        });

        User created = setupService.createFirstAdmin("admin", "secret");

        assertThat(created.getUsername()).isEqualTo("admin");
        assertThat(created.getPasswordHash()).isEqualTo("encoded");
        assertThat(created.getRole()).isEqualTo(UserRole.ADMIN);
        assertThat(created.isEnabled()).isTrue();
        assertThat(state.isCompleted()).isTrue();
        verify(entityManager).flush();
        verify(dataMigrationService).assignOrphanedRecordsToUser(created.getId());
        verify(setupStateRepository).save(state);
    }

    @Test
    void createFirstAdmin_marksSetupCompleteBeforeThrowingWhenAlreadyCompleted() {
        SetupState state = new SetupState();
        state.setCompleted(true);
        when(setupStateRepository.findByIdForUpdate(SetupState.SINGLETON_ID)).thenReturn(Optional.of(state));

        assertThatThrownBy(() -> setupService.createFirstAdmin("admin", "secret"))
                .isInstanceOf(SetupAlreadyCompleteException.class)
                .hasMessage("Setup has already been completed");

        assertThat(state.isCompleted()).isTrue();
        verify(setupStateRepository).save(state);
    }

    @Test
    void createFirstAdmin_marksSetupCompleteBeforeThrowingWhenUserAlreadyExists() {
        SetupState state = new SetupState();
        when(setupStateRepository.findByIdForUpdate(SetupState.SINGLETON_ID)).thenReturn(Optional.of(state));
        when(userRepository.count()).thenReturn(1L);

        assertThatThrownBy(() -> setupService.createFirstAdmin("admin", "secret"))
                .isInstanceOf(SetupAlreadyCompleteException.class)
                .hasMessage("Setup has already been completed");

        assertThat(state.isCompleted()).isTrue();
        verify(setupStateRepository).save(state);
    }

    @Test
    void createFirstAdmin_throwsWhenSetupStateRowMissing() {
        when(setupStateRepository.findByIdForUpdate(SetupState.SINGLETON_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> setupService.createFirstAdmin("admin", "secret"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("Setup state row is missing");
    }
}
