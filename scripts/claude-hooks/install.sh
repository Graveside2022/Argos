#!/bin/bash
# Install Claude Code hooks and settings for Argos development.
# Run from project root: bash scripts/claude-hooks/install.sh
#
# What it does:
#   1. Copies hook scripts to .claude/hooks/
#   2. Generates .claude/settings.local.json from template + .env API key
#   3. Sets executable permissions
#
# Safe to re-run — overwrites existing hooks with tracked versions.

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
HOOKS_SRC="$PROJECT_DIR/scripts/claude-hooks"
HOOKS_DST="$PROJECT_DIR/.claude/hooks"
SETTINGS_DST="$PROJECT_DIR/.claude/settings.local.json"
SETTINGS_TPL="$HOOKS_SRC/settings.local.json.template"
ENV_FILE="$PROJECT_DIR/.env"

echo "Installing Claude Code hooks for Argos..."

# 1. Create target directory
mkdir -p "$HOOKS_DST"

# 2. Copy hook scripts (exclude this installer and templates)
copied=0
for hook in "$HOOKS_SRC"/*.sh; do
    name="$(basename "$hook")"
    [ "$name" = "install.sh" ] && continue
    cp "$hook" "$HOOKS_DST/$name"
    chmod +x "$HOOKS_DST/$name"
    copied=$((copied + 1))
done
echo "  Installed $copied hook scripts to .claude/hooks/"

# 3. Generate settings.local.json with API key from .env
if [ -f "$SETTINGS_DST" ]; then
    echo "  .claude/settings.local.json already exists — skipping (delete it first to regenerate)"
elif [ ! -f "$SETTINGS_TPL" ]; then
    echo "  WARNING: $SETTINGS_TPL not found — skipping settings generation"
elif [ ! -f "$ENV_FILE" ]; then
    echo "  WARNING: .env not found — copying template without API key substitution"
    echo "  Edit .claude/settings.local.json and replace __ARGOS_API_KEY__ with your key"
    cp "$SETTINGS_TPL" "$SETTINGS_DST"
else
    # Extract ARGOS_API_KEY from .env
    API_KEY=$(grep -E '^ARGOS_API_KEY=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'")
    if [ -z "$API_KEY" ]; then
        echo "  WARNING: ARGOS_API_KEY not found in .env — using placeholder"
        cp "$SETTINGS_TPL" "$SETTINGS_DST"
    else
        sed "s/__ARGOS_API_KEY__/$API_KEY/g" "$SETTINGS_TPL" > "$SETTINGS_DST"
        echo "  Generated .claude/settings.local.json with API key from .env"
    fi
fi

echo "Done. Restart Claude Code to pick up changes."
