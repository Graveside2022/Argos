#!/bin/bash
INPUT=$(cat) || exit 0
LOG_DIR="$HOME/.claude/sessions"
mkdir -p "$LOG_DIR" 2>/dev/null || exit 0
DATE=$(date +%Y-%m-%d)
LOG_FILE="$LOG_DIR/${DATE}-audit.jsonl"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // "unknown"' 2>/dev/null)
SUCCESS=$(echo "$INPUT" | jq -r '.tool_response.success // true' 2>/dev/null)
case "$TOOL_NAME" in
    "Edit") FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // "unknown"' 2>/dev/null); ACTION="edited $FILE" ;;
    "Write") FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // "unknown"' 2>/dev/null); ACTION="created $FILE" ;;
    "Read") FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // "unknown"' 2>/dev/null); ACTION="read $FILE" ;;
    "Bash") CMD=$(echo "$INPUT" | jq -r '.tool_input.command // "unknown"' 2>/dev/null | head -c 80); ACTION="ran: $CMD" ;;
    "Task") AGENT=$(echo "$INPUT" | jq -r '.tool_input.subagent_type // "unknown"' 2>/dev/null); ACTION="spawned $AGENT agent" ;;
    *) ACTION="used $TOOL_NAME" ;;
esac
echo "{\"timestamp\":\"$TIMESTAMP\",\"tool\":\"$TOOL_NAME\",\"action\":\"$ACTION\",\"success\":$SUCCESS}" >> "$LOG_FILE" 2>/dev/null
exit 0
