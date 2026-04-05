# Project Guidelines

## General Information
For more information about the project and its build commands consult the README.md - keep it it up to date if you change something fundamental about the project setup, but keep it short - only the most relevant info. Not every change is worth noting down.

## Exception Handling

When wrapping an exception, always pass the original exception as the cause:

```java
// Correct
throw new CustomException("message: " + e.getMessage(), e);

// Wrong - loses the original stack trace
throw new CustomException("message: " + e.getMessage());
```

## Testing
When changing code always execute the tests afterwards - in the frontend as well as in the backend. Always extend/adapt the tests when changing code.
