package com.tracker.users.exception;

public class UnauthenticatedUserException extends RuntimeException {

    public UnauthenticatedUserException(String message) {
        super(message);
    }
}
