package com.tracker.shared.migration;

import com.tracker.shared.migration.AppDataMigration;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface AppDataMigrationRepository extends JpaRepository<AppDataMigration, String> {
}
