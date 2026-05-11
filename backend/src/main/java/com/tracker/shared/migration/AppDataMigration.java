package com.tracker.shared.migration;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "app_data_migrations")
@Getter
@NoArgsConstructor
public class AppDataMigration {

    @Id
    @Column(name = "migration_key", length = 120)
    private String migrationKey;

    @Column(name = "applied_at", nullable = false)
    private LocalDateTime appliedAt = LocalDateTime.now();

    public AppDataMigration(String migrationKey) {
        this.migrationKey = migrationKey;
    }
}
