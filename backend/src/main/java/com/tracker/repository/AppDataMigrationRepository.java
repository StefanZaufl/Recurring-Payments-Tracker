package com.tracker.repository;

import com.tracker.model.entity.AppDataMigration;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface AppDataMigrationRepository extends JpaRepository<AppDataMigration, String> {
}
