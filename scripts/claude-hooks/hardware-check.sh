#!/bin/bash
INPUT=$(cat) || exit 0
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name' 2>/dev/null) || exit 0
if [ "$TOOL_NAME" != "Bash" ]; then exit 0; fi
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""' 2>/dev/null) || exit 0
# Only check commands that actually interact with hardware or hardware APIs.
# Skip git, npm, tsc, and other dev-tool commands that may reference hackrf in filenames/messages.
if echo "$COMMAND" | grep -qE '^git |^npm |^npx |^tsc |^node |^vitest '; then exit 0; fi
if ! echo "$COMMAND" | grep -qE 'hackrf_|grgsm_|api/hackrf/(start|sweep)|api/gsm-evil/control'; then exit 0; fi
HACKRF_PROCS=$(pgrep -fa 'hackrf_|grgsm_' 2>/dev/null | grep -v grep || true)
if [ -n "$HACKRF_PROCS" ]; then
    PROC_NAME=$(echo "$HACKRF_PROCS" | head -1 | awk '{for(i=2;i<=NF;i++) printf "%s ", $i}')
    cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "HackRF device is in use by: ${PROC_NAME}\n\nStop it:\n  curl -X POST http://localhost:5173/api/hackrf/stop-sweep\n  OR: sudo pkill -f 'hackrf_|grgsm_'"
  }
}
EOF
    exit 0
fi
if curl -s -f http://localhost:5173/api/health >/dev/null 2>&1; then
    GSM_STATUS=$(curl -s http://localhost:5173/api/gsm-evil/status 2>/dev/null || echo '{"running":false}')
    if echo "$GSM_STATUS" | grep -q '"running"[[:space:]]*:[[:space:]]*true'; then
        cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "GSM Evil monitoring active. Stop it:\n  curl -X POST http://localhost:5173/api/gsm-evil/control -d '{\"action\":\"stop\"}'"
  }
}
EOF
        exit 0
    fi
fi
exit 0
