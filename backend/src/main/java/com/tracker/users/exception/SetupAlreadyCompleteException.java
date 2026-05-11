package com.tracker.users.exception;

public class SetupAlreadyCompleteException extends RuntimeException {
    public SetupAlreadyCompleteException(String message) {
        super(message);
    }
}
