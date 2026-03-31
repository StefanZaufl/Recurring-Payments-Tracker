# Project Guidelines

## Exception Handling

When wrapping an exception, always pass the original exception as the cause:

```java
// Correct
throw new CustomException("message: " + e.getMessage(), e);

// Wrong - loses the original stack trace
throw new CustomException("message: " + e.getMessage());
```
