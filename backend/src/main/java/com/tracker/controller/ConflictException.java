package com.tracker.controller;

public class ConflictException extends RuntimeException {
    public ConflictException(String message) {
        super(message);
    }
}
