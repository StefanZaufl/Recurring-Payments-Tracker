package com.tracker.controller;

public class SetupAlreadyCompleteException extends RuntimeException {
    public SetupAlreadyCompleteException(String message) {
        super(message);
    }
}
