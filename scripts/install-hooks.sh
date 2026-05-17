#!/bin/sh
# Install git hooks for the get-shit-done fork
# Usage: ./scripts/install-hooks.sh
set -e

# npm strips .git before running `prepare` on git-URL installs, so a
# consumer running `npm i github:user/repo` has no git checkout here. The
# hooks are only useful in a dev checkout — exit cleanly otherwise.
if ! git rev-parse --show-toplevel >/dev/null 2>&1; then
  exit 0
fi

HOOK_DIR="$(git rev-parse --show-toplevel)/.git/hooks"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Handle worktree case: .git may be a file pointing to the real gitdir
if [ -f "$(git rev-parse --show-toplevel)/.git" ]; then
  HOOK_DIR="$(git rev-parse --git-dir)/hooks"
fi

# Ensure hooks directory exists
mkdir -p "$HOOK_DIR"

# Pre-commit: leak gate
ln -sf "$SCRIPT_DIR/pre-commit-leak-gate.sh" "$HOOK_DIR/pre-commit"
echo "Installed pre-commit hook: leak-grep gate" >&2
