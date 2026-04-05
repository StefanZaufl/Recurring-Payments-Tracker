package com.tracker.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class DataMigrationService {

    private final JdbcTemplate jdbcTemplate;

    public DataMigrationService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Transactional
    public void assignOrphanedRecordsToUser(UUID userId) {
        String userIdStr = userId.toString();
        jdbcTemplate.update("UPDATE file_uploads SET user_id = ?::uuid WHERE user_id IS NULL", userIdStr);
        jdbcTemplate.update("UPDATE transactions SET user_id = ?::uuid WHERE user_id IS NULL", userIdStr);
        jdbcTemplate.update("UPDATE categories SET user_id = ?::uuid WHERE user_id IS NULL", userIdStr);
        jdbcTemplate.update("UPDATE recurring_payments SET user_id = ?::uuid WHERE user_id IS NULL", userIdStr);
        jdbcTemplate.update("UPDATE rules SET user_id = ?::uuid WHERE user_id IS NULL", userIdStr);
        jdbcTemplate.update("UPDATE transaction_recurring_link SET user_id = ?::uuid WHERE user_id IS NULL", userIdStr);
    }
}
