#!/bin/sh
# Sync fork with upstream and scan for new leaks after rebase.
#
# Usage: ./scripts/sync-upstream.sh [upstream-ref]
#   upstream-ref defaults to upstream/main
#
# The leak-grep step is advisory (non-blocking): the script exits 0
# even when leaks are found in the post-rebase diff. Treat the output
# as a checklist of sites that may need adapter routing.
#
# See docs/UPSTREAM-REBASE.md for the conflict taxonomy.
set -e

UPSTREAM_REF="${1:-upstream/main}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Fetching upstream..." >&2
git fetch upstream

PRE_REBASE=$(git rev-parse HEAD)
echo "Pre-rebase HEAD: $PRE_REBASE" >&2
echo "Rebasing onto $UPSTREAM_REF..." >&2
git rebase "$UPSTREAM_REF"

CHANGED_FILES=$(git diff --name-only "${PRE_REBASE}..HEAD" 2>/dev/null || true)
if [ -n "$CHANGED_FILES" ]; then
  echo "" >&2
  echo "--- Post-rebase leak scan (advisory, non-blocking) ---" >&2
  echo "$CHANGED_FILES" | xargs node "$SCRIPT_DIR/leak-grep.cjs" || true
  echo "--- End leak scan ---" >&2
else
  echo "No changed files after rebase." >&2
fi

echo "" >&2
echo "Rebase complete. See docs/UPSTREAM-REBASE.md for conflict guidance." >&2
