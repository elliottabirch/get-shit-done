#!/bin/sh
# Pre-commit hook: zero-tolerance leak gate (D-07)
# Rejects commits that introduce .planning/ references outside adapters/markdown/
set -e

# Get staged files (only added/changed/modified, not deleted)
STAGED=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(md|ts|js|cjs|mjs)$' || true)
if [ -z "$STAGED" ]; then exit 0; fi

# Exclude adapter implementation (the ONE place allowed to touch .planning/)
SCAN=$(echo "$STAGED" | grep -v '^adapters/markdown/' | grep -v '^node_modules/' || true)
if [ -z "$SCAN" ]; then exit 0; fi

# Run leak-grep on staged files
LEAK_OUTPUT=$(echo "$SCAN" | xargs node scripts/leak-grep.cjs 2>/dev/null || true)
LEAK_EXIT=$?

if [ $LEAK_EXIT -ne 0 ] || [ -n "$LEAK_OUTPUT" ]; then
  echo ""
  echo "=========================================="
  echo " COMMIT BLOCKED: Storage adapter leak(s)"
  echo "=========================================="
  echo ""
  echo "$LEAK_OUTPUT"
  echo ""
  echo "All .planning/ access must route through gsd-sdk query calls."
  echo "See: .planning/phases/04-*/04-CONTEXT.md D-01 for the canonical pattern."
  echo ""
  exit 1
fi

# Non-blocking: verify.fat-skills warning (D-08)
# Only runs if SDK is built; skips silently if not available
if command -v gsd-sdk >/dev/null 2>&1; then
  FAT_OUTPUT=$(gsd-sdk query verify.fat-skills 2>/dev/null || true)
  if echo "$FAT_OUTPUT" | grep -q '"warning"'; then
    echo ""
    echo "[warn] Fat/leaky skills detected (non-blocking):"
    echo "$FAT_OUTPUT" | grep '"warning"' | head -5
    echo ""
  fi
fi

exit 0
