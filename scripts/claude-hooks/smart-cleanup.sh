#!/bin/bash
# Smart cleanup on session stop — kill orphan vitest processes only
# Vite is managed by argos-dev-monitor keepalive — never kill it here
INPUT=$(cat 2>/dev/null) || true

# Guard against infinite stop-hook loops
STOP_ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active // false' 2>/dev/null)
if [ "$STOP_ACTIVE" = "true" ]; then
    exit 0
fi

# Kill orphan vitest processes spawned by this Claude session
# Only kill vitest workers (forked by Claude), not user-started test runs
if [ -n "${CLAUDE_SESSION_ID:-}" ]; then
    pkill -f "vitest.*--reporter" 2>/dev/null || true
else
    pkill -f "vitest" 2>/dev/null || true
fi

exit 0
