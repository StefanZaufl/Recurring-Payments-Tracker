# Docker Compose Build Notes

Use the root build script instead of calling `docker compose` directly.

## Commands

- Build images only:
  ```bash
  ./build.sh
  ```

- Build images and start the stack in detached mode:
  ```bash
  ./build.sh up
  ```

# Pre Commit Checks
Before you commit, run the "runSonar.sh" script for both the frontend and the backend. Afterwards check sonar for any findings using the query-sonar-issues.sh and fix them. You can omit this if you only made minor changes.

