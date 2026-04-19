#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ -f "${SCRIPT_DIR}/sonar.env" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "${SCRIPT_DIR}/sonar.env"
  set +a
fi

: "${SONAR_SCANNER_BIN:=sonar}"

if [[ -z "${SONAR_TOKEN:-}" ]]; then
  echo "SONAR_TOKEN is required. Copy sonar.env.example to sonar.env and set your token." >&2
  exit 1
fi

if [[ -z "${SONAR_HOST_URL:-}" ]]; then
  echo "SONAR_HOST_URL is required. Copy sonar.env.example to sonar.env and set your Sonar server URL." >&2
  exit 1
fi

npm test -- --coverage --watch=false

"${SONAR_SCANNER_BIN}" \
  -Dsonar.host.url="${SONAR_HOST_URL}" \
  -Dsonar.token="${SONAR_TOKEN}" \
  -Dsonar.projectKey=Recurring-Payments-Tracker-Frontend \
  -Dsonar.projectName='Recurring Payments Tracker Frontend' \
  -Dsonar.sources=src \
  -Dsonar.tests=src \
  -Dsonar.test.inclusions='**/*.spec.ts' \
  -Dsonar.exclusions='src/app/api/generated/**,dist/**,coverage/**' \
  -Dsonar.javascript.lcov.reportPaths=coverage/lcov.info \
  -Dsonar.sourceEncoding=UTF-8
