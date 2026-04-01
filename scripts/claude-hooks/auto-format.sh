#!/bin/bash
INPUT=$(cat) || exit 0
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // ""' 2>/dev/null)
if [ -z "$FILE_PATH" ] || [ ! -f "$FILE_PATH" ]; then exit 0; fi
cd "$CLAUDE_PROJECT_DIR" || exit 0
FILE_EXT="${FILE_PATH##*.}"
case "$FILE_EXT" in
    js|ts|svelte)
        npx eslint --config config/eslint.config.js --fix "$FILE_PATH" 2>/dev/null || true
        npx prettier --write "$FILE_PATH" 2>/dev/null || true
        echo "✓ Formatted: $FILE_PATH" >&2
        ;;
    json|md|css|html)
        npx prettier --write "$FILE_PATH" 2>/dev/null || true
        echo "✓ Formatted: $FILE_PATH" >&2
        ;;
esac
exit 0
