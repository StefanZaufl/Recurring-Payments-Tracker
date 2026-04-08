package com.tracker.service;

import com.tracker.controller.SetupAlreadyCompleteException;
import com.tracker.model.entity.SetupState;
import com.tracker.model.entity.User;
import com.tracker.model.entity.UserRole;
import com.tracker.repository.SetupStateRepository;
import com.tracker.repository.UserRepository;
import jakarta.persistence.EntityManager;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
public class SetupService {

    private static final long SETUP_STATE_ID = SetupState.SINGLETON_ID;

    private final UserRepository userRepository;
    private final SetupStateRepository setupStateRepository;
    private final PasswordEncoder passwordEncoder;
    private final DataMigrationService dataMigrationService;
    private final EntityManager entityManager;

    public SetupService(UserRepository userRepository, SetupStateRepository setupStateRepository,
                        PasswordEncoder passwordEncoder,
                        DataMigrationService dataMigrationService, EntityManager entityManager) {
        this.userRepository = userRepository;
        this.setupStateRepository = setupStateRepository;
        this.passwordEncoder = passwordEncoder;
        this.dataMigrationService = dataMigrationService;
        this.entityManager = entityManager;
    }

    public boolean needsSetup() {
        return setupStateRepository.findById(SETUP_STATE_ID)
                .map(state -> !state.isCompleted())
                .orElseGet(() -> userRepository.count() == 0);
    }

    @Transactional
    public User createFirstAdmin(String username, String password) {
        if (username == null || username.isBlank()) {
            throw new IllegalArgumentException("username is required");
        }
        if (password == null || password.isBlank()) {
            throw new IllegalArgumentException("password is required");
        }

        SetupState setupState = getSetupStateForUpdate();
        if (setupState.isCompleted() || userRepository.count() != 0) {
            markSetupComplete(setupState);
            throw new SetupAlreadyCompleteException("Setup has already been completed");
        }

        User admin = new User();
        admin.setUsername(username);
        admin.setPasswordHash(passwordEncoder.encode(password));
        admin.setRole(UserRole.ADMIN);
        admin.setEnabled(true);
        admin = userRepository.save(admin);
        entityManager.flush();

        dataMigrationService.assignOrphanedRecordsToUser(admin.getId());
        markSetupComplete(setupState);

        return admin;
    }

    private SetupState getSetupStateForUpdate() {
        return setupStateRepository.findByIdForUpdate(SETUP_STATE_ID)
                .orElseThrow(() -> new IllegalStateException("Setup state row is missing"));
    }

    private void markSetupComplete(SetupState setupState) {
        setupState.setCompleted(true);
        setupState.setUpdatedAt(LocalDateTime.now());
        setupStateRepository.save(setupState);
    }
}
