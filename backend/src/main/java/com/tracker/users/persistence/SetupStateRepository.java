package com.tracker.users.persistence;

import com.tracker.users.domain.SetupState;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface SetupStateRepository extends JpaRepository<SetupState, Long> {

    @Query(value = "select * from setup_state where id = :id for update", nativeQuery = true)
    Optional<SetupState> findByIdForUpdate(Long id);
}
