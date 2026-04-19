#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ -f "${SCRIPT_DIR}/sonar.env" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "${SCRIPT_DIR}/sonar.env"
  set +a
fi

if [[ -z "${SONAR_TOKEN:-}" ]]; then
  echo "SONAR_TOKEN is required. Copy sonar.env.example to sonar.env and set your token." >&2
  exit 1
fi

if [[ -z "${SONAR_HOST_URL:-}" ]]; then
  echo "SONAR_HOST_URL is required. Copy sonar.env.example to sonar.env and set your Sonar server URL." >&2
  exit 1
fi

mvn clean verify org.sonarsource.scanner.maven:sonar-maven-plugin:sonar \
  -Dsonar.projectKey=Recurring-Payment-Tracker-Backend \
  -Dsonar.projectName='Recurring Payment Tracker Backend' \
  -Dsonar.host.url="${SONAR_HOST_URL}" \
  -Dsonar.token="${SONAR_TOKEN}" \
  -Dsonar.coverage.jacoco.xmlReportPaths=target/site/jacoco/jacoco.xml
