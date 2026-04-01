#!/bin/bash
INPUT=$(cat) || exit 0
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name' 2>/dev/null) || exit 0
RISKY=false
if [ "$TOOL_NAME" = "Bash" ]; then
    COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""' 2>/dev/null) || exit 0
    if echo "$COMMAND" | grep -qE 'vitest|npm (install|update|ci)|npm run test'; then
        RISKY=true
    fi
elif [ "$TOOL_NAME" = "Task" ]; then
    RISKY=true
fi
if [ "$RISKY" = "false" ]; then exit 0; fi
DANGER_THRESHOLD=95
WARN_THRESHOLD=90
MEM_USAGE=$(free -m 2>/dev/null | awk '/Mem:/ {printf "%.0f", $3/$2 * 100}')
if [ -z "$MEM_USAGE" ]; then exit 0; fi
if [ "$MEM_USAGE" -ge "$DANGER_THRESHOLD" ]; then
    cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "Memory usage at ${MEM_USAGE}% (danger threshold: ${DANGER_THRESHOLD}%). OOM risk.\n\nActions:\n  1. Free memory: npm run kill-all\n  2. Check processes: ps aux --sort=-%mem | head -10\n  3. Restart dev server: npm run dev:clean"
  }
}
EOF
    exit 0
elif [ "$MEM_USAGE" -ge "$WARN_THRESHOLD" ]; then
    cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow",
    "additionalContext": "WARNING: Memory at ${MEM_USAGE}% (approaching ${DANGER_THRESHOLD}% limit)."
  }
}
EOF
    exit 0
fi
exit 0
