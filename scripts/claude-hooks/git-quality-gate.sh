#!/bin/bash
INPUT=$(cat) || exit 0
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name' 2>/dev/null) || exit 0
if [ "$TOOL_NAME" != "Bash" ]; then exit 0; fi
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""' 2>/dev/null) || exit 0
if ! echo "$COMMAND" | grep -q 'git commit'; then exit 0; fi
if echo "$COMMAND" | grep -q '\-\-no-verify'; then exit 0; fi
cd "$CLAUDE_PROJECT_DIR" || exit 0
echo "🔍 Running pre-commit checks..." >&2
echo "  Checking types..." >&2
if ! npm run typecheck >/dev/null 2>&1; then
    cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "TypeScript errors detected. Fix types before committing.\n\nRun: npm run typecheck\n\nOr skip: git commit --no-verify"
  }
}
EOF
    exit 0
fi
echo "    ✓ Types valid" >&2
echo "  Running unit tests..." >&2
if ! npm run test:unit >/dev/null 2>&1; then
    cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "Unit tests failed. Fix tests before committing.\n\nRun: npm run test:unit\n\nOr skip: git commit --no-verify"
  }
}
EOF
    exit 0
fi
echo "    ✓ Tests passed" >&2
echo "✅ Pre-commit checks passed" >&2
exit 0
