#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODE="new"
FAIL_ON_ISSUES=false
PROJECTS=("backend" "frontend")

usage() {
  cat <<'EOF'
Usage: tooling/query-sonar-issues.sh [options]

Queries SonarQube issues for the backend and frontend projects using:
  - <project>/sonar.env for SONAR_HOST_URL and SONAR_TOKEN
  - <project>/runSonar.sh for sonar.projectKey

Options:
  --new-code        Query unresolved issues in the new-code period. Default.
  --all             Query all unresolved issues.
  --backend         Query only the backend project.
  --frontend        Query only the frontend project.
  --fail-on-issues  Exit with status 1 if any queried issues are found.
  -h, --help        Show this help text.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --new-code)
      MODE="new"
      shift
      ;;
    --all)
      MODE="all"
      shift
      ;;
    --backend)
      PROJECTS=("backend")
      shift
      ;;
    --frontend)
      PROJECTS=("frontend")
      shift
      ;;
    --fail-on-issues)
      FAIL_ON_ISSUES=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

require_file() {
  local path="$1"
  if [[ ! -f "$path" ]]; then
    echo "Required file not found: $path" >&2
    exit 2
  fi
}

extract_project_key() {
  local run_sonar="$1"
  sed -n "s/.*-Dsonar\.projectKey=\([^[:space:]\\]*\).*/\1/p" "$run_sonar" | head -n 1
}

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

total_issues=0
json_files=()

for project in "${PROJECTS[@]}"; do
  project_dir="${ROOT_DIR}/${project}"
  env_file="${project_dir}/sonar.env"
  run_sonar="${project_dir}/runSonar.sh"

  require_file "$env_file"
  require_file "$run_sonar"

  # shellcheck source=/dev/null
  source "$env_file"

  if [[ -z "${SONAR_HOST_URL:-}" || -z "${SONAR_TOKEN:-}" ]]; then
    echo "${project}: SONAR_HOST_URL and SONAR_TOKEN must be set in ${env_file}" >&2
    exit 2
  fi

  project_key="$(extract_project_key "$run_sonar")"
  if [[ -z "$project_key" ]]; then
    echo "${project}: could not extract -Dsonar.projectKey from ${run_sonar}" >&2
    exit 2
  fi

  query="componentKeys=${project_key}&resolved=false&ps=500&additionalFields=_all"
  if [[ "$MODE" == "new" ]]; then
    query="${query}&inNewCodePeriod=true"
  fi

  output_file="${tmp_dir}/${project}.json"
  curl -sf -u "${SONAR_TOKEN}:" "${SONAR_HOST_URL}/api/issues/search?${query}" > "$output_file"
  json_files+=("${project}:${project_key}:${output_file}")
done

set +e
python3 - "$MODE" "${json_files[@]}" <<'PY'
import json
import sys
from collections import Counter

mode = sys.argv[1]
entries = sys.argv[2:]
severity_rank = {"BLOCKER": 0, "CRITICAL": 1, "MAJOR": 2, "MINOR": 3, "INFO": 4}
grand_total = 0

for entry in entries:
    project, project_key, path = entry.split(":", 2)
    data = json.load(open(path, encoding="utf-8"))
    issues = data.get("issues", [])
    total = data.get("total", len(issues))
    grand_total += total
    label = "new-code" if mode == "new" else "open"

    print(f"{project} ({project_key})")
    print(f"  {label} issues: {total}")

    if total == 0:
        print()
        continue

    by_severity = Counter(issue.get("severity", "UNKNOWN") for issue in issues)
    summary = ", ".join(
        f"{severity}={count}"
        for severity, count in sorted(by_severity.items(), key=lambda item: severity_rank.get(item[0], 99))
    )
    print(f"  severity: {summary}")

    for issue in sorted(
        issues,
        key=lambda item: (
            severity_rank.get(item.get("severity", ""), 99),
            item.get("component", ""),
            item.get("line") or 0,
            item.get("rule", ""),
        ),
    ):
        component = issue.get("component", "")
        path = component.split(":", 1)[-1]
        line = issue.get("line")
        location = f"{path}:{line}" if line else path
        print(f"  - [{issue.get('severity')}] {issue.get('rule')} {location} - {issue.get('message')}")
    print()

print(f"total issues: {grand_total}")
sys.exit(1 if grand_total else 0)
PY

issue_status=$?
set -e
if [[ "$FAIL_ON_ISSUES" == "true" && "$issue_status" -ne 0 ]]; then
  exit "$issue_status"
fi

exit 0
