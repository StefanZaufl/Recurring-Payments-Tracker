package com.tracker.repository;

import com.tracker.model.entity.CsvUpload;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface CsvUploadRepository extends JpaRepository<CsvUpload, UUID> {
}
