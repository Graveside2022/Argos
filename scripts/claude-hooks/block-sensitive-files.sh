#!/bin/bash
# block-sensitive-files.sh — PreToolUse hook for Edit|Write
# Blocks edits to .env files, credentials, secrets, and other sensitive files.
# Exit code 2 = block the tool call and surface the reason.

INPUT=$(cat) || exit 0
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // ""' 2>/dev/null)
if [ -z "$FILE_PATH" ]; then exit 0; fi

# Extract just the filename for pattern matching
FILENAME=$(basename "$FILE_PATH")

# Block .env files (but allow .env.example)
if echo "$FILENAME" | grep -qE '^\.(env|env\.[a-z]+)$'; then
    if [ "$FILENAME" = ".env.example" ]; then exit 0; fi
    cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "BLOCKED: Editing sensitive file '$FILENAME'. This file contains secrets (API keys, tokens).\n\nIf you need to modify environment variables:\n  1. Edit .env.example (safe, committed)\n  2. Ask the user to manually update .env"
  }
}
EOF
    exit 0
fi

# Block known credential/secret file patterns
if echo "$FILENAME" | grep -qiE 'credentials|secrets|\.key$|\.pem$|\.p12$|\.pfx$|id_rsa|id_ed25519'; then
    cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "BLOCKED: Editing credential/key file '$FILENAME'.\n\nNever write secrets via Claude. Ask the user to manage this file manually."
  }
}
EOF
    exit 0
fi

exit 0
