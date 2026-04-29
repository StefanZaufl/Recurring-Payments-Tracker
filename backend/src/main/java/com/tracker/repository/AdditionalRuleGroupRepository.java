package com.tracker.repository;

import com.tracker.model.entity.AdditionalRuleGroup;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface AdditionalRuleGroupRepository extends JpaRepository<AdditionalRuleGroup, UUID> {

    @EntityGraph(attributePaths = "rules")
    List<AdditionalRuleGroup> findByUserIdOrderByNameAsc(UUID userId);

    @EntityGraph(attributePaths = "rules")
    Optional<AdditionalRuleGroup> findByIdAndUserId(UUID id, UUID userId);

    boolean existsByUserIdAndNormalizedName(UUID userId, String normalizedName);

    boolean existsByUserIdAndNormalizedNameAndIdNot(UUID userId, String normalizedName, UUID id);
}
