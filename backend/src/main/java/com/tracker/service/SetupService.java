package com.tracker.service;

import com.tracker.controller.SetupAlreadyCompleteException;
import com.tracker.model.entity.User;
import com.tracker.model.entity.UserRole;
import com.tracker.repository.UserRepository;
import jakarta.persistence.EntityManager;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SetupService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final DataMigrationService dataMigrationService;
    private final EntityManager entityManager;

    public SetupService(UserRepository userRepository, PasswordEncoder passwordEncoder,
                        DataMigrationService dataMigrationService, EntityManager entityManager) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.dataMigrationService = dataMigrationService;
        this.entityManager = entityManager;
    }

    public boolean needsSetup() {
        return userRepository.count() == 0;
    }

    @Transactional
    public User createFirstAdmin(String username, String password) {
        if (userRepository.count() != 0) {
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

        return admin;
    }
}
