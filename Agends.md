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

## Behavior

- The script enables Docker BuildKit via `DOCKER_BUILDKIT=1`.
- It always runs `docker compose build`.
- If the first argument is exactly `up`, it then runs `docker compose up -d`.

## Source

The behavior above comes from [`build.sh`](/home/claude/projects/Recurring-Payments-Tracker/build.sh).
