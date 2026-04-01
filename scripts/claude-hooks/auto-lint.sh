#!/bin/bash
# auto-lint.sh — PostToolUse hook for Edit|Write
# Runs ESLint in reporting mode (no --fix) to surface complexity violations
# that auto-format.sh can't fix (cyclomatic ≤5, cognitive ≤5).
# Uses lock file to prevent concurrent runs (same pattern as auto-typecheck.sh).

LOCKFILE="/tmp/argos-autolint.lock"

INPUT=$(cat) || exit 0
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // ""' 2>/dev/null)
if [ -z "$FILE_PATH" ]; then exit 0; fi
if ! echo "$FILE_PATH" | grep -qE '\.(ts|tsx|svelte|js)$'; then exit 0; fi
if [ ! -f "$FILE_PATH" ]; then exit 0; fi

# Mutual exclusion: skip if another lint is already running
if [ -f "$LOCKFILE" ]; then
    LOCK_PID=$(cat "$LOCKFILE" 2>/dev/null)
    if [ -n "$LOCK_PID" ] && kill -0 "$LOCK_PID" 2>/dev/null; then
        exit 0
    fi
    rm -f "$LOCKFILE"
fi

cd "$CLAUDE_PROJECT_DIR" || exit 0

# Acquire lock
echo $$ > "$LOCKFILE"
trap 'rm -f "$LOCKFILE"' EXIT

# Run ESLint in report mode (no --fix) — only errors, skip warnings
OUTPUT=$(npx eslint "$FILE_PATH" --config config/eslint.config.js --no-warn-ignored 2>&1)
EXIT_CODE=$?

if [ "$EXIT_CODE" -ne 0 ]; then
    # Filter to show only error lines (complexity violations, etc.)
    ERRORS=$(echo "$OUTPUT" | grep -E '(error|complexity)' | head -10)
    if [ -n "$ERRORS" ]; then
        echo "Lint errors in $(basename "$FILE_PATH"):" >&2
        echo "$ERRORS" >&2
    fi
fi
exit 0
