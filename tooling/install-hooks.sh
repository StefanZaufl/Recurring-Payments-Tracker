#!/usr/bin/env bash
#
# Installs git hooks from tooling/hooks/ into .git/hooks/.
# Run this once after cloning the repository.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
HOOKS_SRC="$SCRIPT_DIR/hooks"
HOOKS_DST="$REPO_ROOT/.git/hooks"

if [ ! -d "$HOOKS_DST" ]; then
  echo "Error: .git/hooks directory not found. Are you in a git repository?"
  exit 1
fi

installed=0
for hook in "$HOOKS_SRC"/*; do
  [ -f "$hook" ] || continue
  name=$(basename "$hook")
  cp "$hook" "$HOOKS_DST/$name"
  chmod +x "$HOOKS_DST/$name"
  echo "Installed hook: $name"
  installed=$((installed + 1))
done

if [ $installed -eq 0 ]; then
  echo "No hooks found in $HOOKS_SRC"
else
  echo "Done. $installed hook(s) installed."
fi
