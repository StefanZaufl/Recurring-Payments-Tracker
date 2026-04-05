#!/usr/bin/env bash
set -euo pipefail

export DOCKER_BUILDKIT=1

docker compose build

if [ "${1:-}" = "up" ]; then
  docker compose up -d
fi
