package com.tracker.repository;

import com.tracker.model.entity.BankAccount;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Repository
public interface BankAccountRepository extends JpaRepository<BankAccount, UUID> {

    List<BankAccount> findByUserIdOrderByNameAscIbanAsc(UUID userId);

    Optional<BankAccount> findByIdAndUserId(UUID id, UUID userId);

    Optional<BankAccount> findByUserIdAndIban(UUID userId, String iban);

    List<BankAccount> findByUserIdAndIbanIn(UUID userId, Set<String> ibans);
}
