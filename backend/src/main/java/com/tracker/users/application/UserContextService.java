package com.tracker.users.application;

import com.tracker.users.exception.UnauthenticatedUserException;

import com.tracker.users.domain.User;
import com.tracker.users.persistence.UserRepository;
import com.tracker.security.AppUserDetails;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class UserContextService {

    private final UserRepository userRepository;

    public UserContextService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public UUID getCurrentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof AppUserDetails userDetails) {
            return userDetails.getId();
        }
        throw new UnauthenticatedUserException("Authentication required");
    }

    public User getCurrentUser() {
        UUID userId = getCurrentUserId();
        return userRepository.findById(userId)
                .orElseThrow(() -> new IllegalStateException("Authenticated user not found in database"));
    }
}
