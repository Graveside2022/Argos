# Claude Code Hooks Design (CORRECTED) — Argos Project

**Date:** 2026-02-11
**Methodology:** Anthropic Official Claude Code Hooks Architecture
**Phase:** 2 (Design) - Corrected Version
**References:** https://code.claude.com/docs/en/hooks.md

---

## Architecture Corrections

### Key Fixes from Original Design

1. **Matchers**: Changed from nested objects to simple regex strings
2. **Data Access**: Changed from env vars to stdin JSON parsing with `jq`
3. **Exit Codes**: Properly using exit 2 for blocking, exit 0 + JSON for decisions
4. **Script Location**: Using `.claude/hooks/` with `$CLAUDE_PROJECT_DIR` reference
5. **JSON Output**: Proper `hookSpecificOutput` format for PreToolUse decisions

---

## Hook 1: Security Validation (CRITICAL)

### Purpose
Validate ARGOS_API_KEY exists before session starts.

### Configuration (settings.json)

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/security-check.sh",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

### Implementation: `.claude/hooks/security-check.sh`

```bash
#!/bin/bash
# Security validation hook for Argos (SessionStart)
# Validates ARGOS_API_KEY before session begins
# Exit 0 = allow session, Exit 2 = block session with error

set -e

# Read hook input from stdin (not used for SessionStart, but good practice)
INPUT=$(cat)

ARGOS_ROOT="$CLAUDE_PROJECT_DIR"
ENV_FILE="$ARGOS_ROOT/.env"

# Colors for stderr output (shown to user on exit 2)
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

# Check 1: .env file exists
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}✗ CRITICAL: .env file missing${NC}" >&2
    echo "" >&2
    echo "📋 Action required:" >&2
    echo "  1. Copy template: cp $ARGOS_ROOT/.env.example $ENV_FILE" >&2
    echo "  2. Generate API key: openssl rand -hex 32" >&2
    echo "  3. Add to .env: ARGOS_API_KEY=<your-key>" >&2
    echo "" >&2
    echo "⚠️  System will refuse to start without ARGOS_API_KEY" >&2
    exit 2  # Block session
fi

# Check 2: ARGOS_API_KEY present and valid length
source "$ENV_FILE"

if [ -z "$ARGOS_API_KEY" ]; then
    echo -e "${RED}✗ CRITICAL: ARGOS_API_KEY not set in .env${NC}" >&2
    echo "" >&2
    echo "📋 Generate key: openssl rand -hex 32" >&2
    echo "   Add to $ENV_FILE: ARGOS_API_KEY=<your-key>" >&2
    exit 2  # Block session
fi

KEY_LENGTH=${#ARGOS_API_KEY}
if [ "$KEY_LENGTH" -lt 32 ]; then
    echo -e "${RED}✗ CRITICAL: ARGOS_API_KEY too short (${KEY_LENGTH} chars, need ≥32)${NC}" >&2
    echo "" >&2
    echo "📋 Generate new key: openssl rand -hex 32" >&2
    echo "   Replace in $ENV_FILE" >&2
    exit 2  # Block session
fi

# Check 3: MCP config (warning only, don't block)
MCP_CONFIG="$HOME/.claude/mcp.json"
if [ -f "$MCP_CONFIG" ]; then
    if grep -q "ARGOS_API_KEY" "$MCP_CONFIG"; then
        MCP_KEY=$(grep -o '"ARGOS_API_KEY"[[:space:]]*:[[:space:]]*"[^"]*"' "$MCP_CONFIG" | head -1 | sed 's/.*"\([^"]*\)"$/\1/')
        if [ "$MCP_KEY" != "$ARGOS_API_KEY" ]; then
            echo -e "${YELLOW}⚠️  WARNING: MCP config has different API key${NC}" >&2
            echo "  MCP servers may fail to authenticate" >&2
            echo "  Update $MCP_CONFIG with current key from .env" >&2
            # Don't block, just warn
        fi
    fi
fi

# Success - output to stdout (becomes context for Claude)
echo "✅ Security validation passed: ARGOS_API_KEY valid ($KEY_LENGTH chars)"
exit 0
```

**Permissions:**
```bash
chmod +x .claude/hooks/security-check.sh
```

---

## Hook 2: Memory Safety Guard (HIGH)

### Purpose
Block memory-intensive operations when system memory >60%.

### Configuration (settings.json)

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/memory-check.sh",
            "timeout": 2
          }
        ]
      },
      {
        "matcher": "Task",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/memory-check.sh",
            "timeout": 2
          }
        ]
      }
    ]
  }
}
```

### Implementation: `.claude/hooks/memory-check.sh`

```bash
#!/bin/bash
# Memory safety guard for Argos (PreToolUse)
# Blocks operations when memory >60%
# Exit 0 + JSON = decision, Exit 2 = blocking error

set -e

# Read hook input from stdin
INPUT=$(cat)

# Extract tool name and command (if Bash)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name')
COMMAND=""

if [ "$TOOL_NAME" = "Bash" ]; then
    COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""')

    # Only check memory for risky commands
    if ! echo "$COMMAND" | grep -qE 'vitest|npm (install|update|ci)|npm run test'; then
        # Not a risky command, allow it
        exit 0
    fi
elif [ "$TOOL_NAME" = "Task" ]; then
    # Always check memory before spawning agents
    :
else
    # Unknown tool, allow it
    exit 0
fi

# Memory thresholds
DANGER_THRESHOLD=60  # Block
WARN_THRESHOLD=50    # Warn but allow

# Get current memory usage percentage
MEM_USAGE=$(free -m | awk '/Mem:/ {printf "%.0f", $3/$2 * 100}')

if [ "$MEM_USAGE" -ge "$DANGER_THRESHOLD" ]; then
    # BLOCK with exit 0 + JSON decision
    cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "Memory usage at ${MEM_USAGE}% (danger threshold: ${DANGER_THRESHOLD}%). OOM risk on Pi5. Run 'npm run kill-all' to free memory."
  }
}
EOF
    exit 0
elif [ "$MEM_USAGE" -ge "$WARN_THRESHOLD" ]; then
    # ALLOW but warn (output to stdout becomes context)
    echo "⚠️  Memory at ${MEM_USAGE}% (approaching ${DANGER_THRESHOLD}% limit). OOM protection active."
    exit 0
else
    # Memory safe, allow silently
    exit 0
fi
```

**Permissions:**
```bash
chmod +x .claude/hooks/memory-check.sh
```

---

## Hook 3: Hardware Conflict Prevention (HIGH)

### Purpose
Block HackRF operations when device is already in use.

### Configuration (settings.json)

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/hardware-check.sh",
            "timeout": 2
          }
        ]
      }
    ]
  }
}
```

### Implementation: `.claude/hooks/hardware-check.sh`

```bash
#!/bin/bash
# Hardware conflict detection for Argos (PreToolUse)
# Blocks HackRF operations when device is busy
# Exit 0 + JSON = decision, Exit 2 = blocking error

set -e

# Read hook input from stdin
INPUT=$(cat)

# Extract command (only applies to Bash tool)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name')

if [ "$TOOL_NAME" != "Bash" ]; then
    exit 0  # Not Bash, allow
fi

COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command')

# Check if command involves HackRF
if ! echo "$COMMAND" | grep -qE 'hackrf_|grgsm_|api/hackrf/(start|sweep)|api/gsm-evil/control'; then
    exit 0  # Not HackRF-related, allow
fi

# Check for running HackRF processes
HACKRF_PROCS=$(pgrep -fa 'hackrf_|grgsm_' | grep -v grep || true)

if [ -n "$HACKRF_PROCS" ]; then
    # Device busy - BLOCK
    REASON="HackRF device is in use by: $(echo "$HACKRF_PROCS" | head -1 | cut -d' ' -f2-)"
    REASON="$REASON. Stop conflicting process: curl -X POST http://localhost:5173/api/hackrf/stop-sweep OR sudo pkill -f 'hackrf_|grgsm_'"

    cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "$REASON"
  }
}
EOF
    exit 0
fi

# Check API status (if dev server is running)
if curl -s -f http://localhost:5173/api/health >/dev/null 2>&1; then
    GSM_STATUS=$(curl -s http://localhost:5173/api/gsm-evil/status 2>/dev/null || echo '{"running":false}')

    if echo "$GSM_STATUS" | grep -q '"running":\s*true'; then
        # GSM Evil active - BLOCK
        cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "GSM Evil monitoring active. Stop it first: curl -X POST http://localhost:5173/api/gsm-evil/control -d '{\"action\":\"stop\"}'"
  }
}
EOF
        exit 0
    fi
fi

# Device available, allow
exit 0
```

**Permissions:**
```bash
chmod +x .claude/hooks/hardware-check.sh
```

---

## Hook 4: Audit Trail Logger (MEDIUM)

### Purpose
Log all tool calls to session audit file for debugging.

### Configuration (settings.json)

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/audit-log.sh",
            "timeout": 1,
            "async": true
          }
        ]
      }
    ]
  }
}
```

### Implementation: `.claude/hooks/audit-log.sh`

```bash
#!/bin/bash
# Audit trail logger (PostToolUse)
# Logs all tool calls to JSONL file
# Async, non-blocking

set -e

# Read hook input from stdin
INPUT=$(cat)

LOG_DIR="$HOME/.claude/sessions"
mkdir -p "$LOG_DIR"

DATE=$(date +%Y-%m-%d)
LOG_FILE="$LOG_DIR/${DATE}-audit.jsonl"

# Extract tool call details
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name')
SUCCESS=$(echo "$INPUT" | jq -r '.success // true')

# Determine action based on tool type
case "$TOOL_NAME" in
    "Edit")
        FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // "unknown"')
        ACTION="edited $FILE"
        ;;
    "Write")
        FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // "unknown"')
        ACTION="created $FILE"
        ;;
    "Read")
        FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // "unknown"')
        ACTION="read $FILE"
        ;;
    "Bash")
        CMD=$(echo "$INPUT" | jq -r '.tool_input.command // "unknown"' | head -c 80)
        ACTION="ran: $CMD"
        ;;
    "Task")
        AGENT=$(echo "$INPUT" | jq -r '.tool_input.subagent_type // "unknown"')
        ACTION="spawned $AGENT agent"
        ;;
    *)
        ACTION="used $TOOL_NAME"
        ;;
esac

# Write JSONL log entry (compact, one line)
echo "{\"timestamp\":\"$TIMESTAMP\",\"tool\":\"$TOOL_NAME\",\"action\":\"$ACTION\",\"success\":$SUCCESS}" >> "$LOG_FILE"

# Success (async, never blocks)
exit 0
```

**Permissions:**
```bash
chmod +x .claude/hooks/audit-log.sh
```

---

## Hook 5: Test Quality Gate (MEDIUM)

### Purpose
Run typecheck before git commits (optional, commented by default due to latency).

### Configuration (settings.json)

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/pre-commit-check.sh",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

### Implementation: `.claude/hooks/pre-commit-check.sh`

```bash
#!/bin/bash
# Pre-commit quality gate (PreToolUse)
# Runs typecheck before git commits
# DISABLED BY DEFAULT (uncomment to enable)

set -e

# Read hook input
INPUT=$(cat)

# Extract command
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name')

if [ "$TOOL_NAME" != "Bash" ]; then
    exit 0
fi

COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command')

# Check if this is a git commit
if ! echo "$COMMAND" | grep -q 'git commit'; then
    exit 0  # Not a commit, allow
fi

# UNCOMMENT TO ENABLE TYPECHECK BEFORE COMMITS:
# cd "$CLAUDE_PROJECT_DIR"
#
# if ! npm run typecheck >/dev/null 2>&1; then
#     cat <<EOF
# {
#   "hookSpecificOutput": {
#     "hookEventName": "PreToolUse",
#     "permissionDecision": "deny",
#     "permissionDecisionReason": "TypeScript errors detected. Run 'npm run typecheck' to see errors. Use 'git commit --no-verify' to skip this check."
#   }
# }
# EOF
#     exit 0
# fi

# Allow commit (typecheck disabled by default)
exit 0
```

**Permissions:**
```bash
chmod +x .claude/hooks/pre-commit-check.sh
```

---

## Hook 6: Docker Context Reminder (LOW)

### Purpose
Remind about npm rebuild after host installs.

### Configuration (settings.json)

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/docker-reminder.sh",
            "timeout": 1,
            "async": true
          }
        ]
      }
    ]
  }
}
```

### Implementation: `.claude/hooks/docker-reminder.sh`

```bash
#!/bin/bash
# Docker context reminder (PostToolUse)
# Reminds about npm rebuild after npm install

set -e

# Read hook input
INPUT=$(cat)

TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name')

if [ "$TOOL_NAME" != "Bash" ]; then
    exit 0
fi

COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command')

# Check if npm install was run
if echo "$COMMAND" | grep -q 'npm install'; then
    echo ""
    echo "⚠️  Docker Context Reminder:"
    echo "   npm install ran on HOST. Rebuild native modules in container:"
    echo "   docker exec argos-dev npm rebuild node-pty"
    echo ""
fi

exit 0
```

**Permissions:**
```bash
chmod +x .claude/hooks/docker-reminder.sh
```

---

## Hook 7: Session Cleanup (LOW)

### Purpose
Kill orphaned processes on session exit.

### Configuration (settings.json)

```json
{
  "hooks": {
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/cleanup.sh",
            "timeout": 3
          }
        ]
      }
    ]
  }
}
```

### Implementation: `.claude/hooks/cleanup.sh`

```bash
#!/bin/bash
# Session cleanup (Stop event)
# Kills orphaned Vite and Vitest processes

echo "🧹 Cleaning up orphaned processes..."

# Kill Vite dev server on port 5173 (if not in Docker)
VITE_PID=$(lsof -ti:5173 2>/dev/null || true)
if [ -n "$VITE_PID" ]; then
    echo "  Killing Vite process $VITE_PID"
    kill $VITE_PID 2>/dev/null || true
fi

# Kill vitest processes
pkill -f "vitest" 2>/dev/null || true

echo "  ✓ Cleanup complete"
exit 0
```

**Permissions:**
```bash
chmod +x .claude/hooks/cleanup.sh
```

---

## Complete settings.json Configuration

Here's the complete consolidated hook configuration for Argos:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/security-check.sh",
            "timeout": 5
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/memory-check.sh",
            "timeout": 2
          },
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/hardware-check.sh",
            "timeout": 2
          }
        ]
      },
      {
        "matcher": "Task",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/memory-check.sh",
            "timeout": 2
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/audit-log.sh",
            "timeout": 1,
            "async": true
          }
        ]
      },
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/docker-reminder.sh",
            "timeout": 1,
            "async": true
          }
        ]
      }
    ],
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/cleanup.sh",
            "timeout": 3
          }
        ]
      }
    ]
  }
}
```

---

## Installation Instructions

### 1. Create hook scripts directory

```bash
cd /home/kali/Documents/Argos/Argos
mkdir -p .claude/hooks
```

### 2. Create and install scripts

Copy each script from above into `.claude/hooks/` and make executable:

```bash
# Create all 6 scripts
touch .claude/hooks/security-check.sh
touch .claude/hooks/memory-check.sh
touch .claude/hooks/hardware-check.sh
touch .claude/hooks/audit-log.sh
touch .claude/hooks/docker-reminder.sh
touch .claude/hooks/cleanup.sh

# Make executable
chmod +x .claude/hooks/*.sh
```

### 3. Add configuration to settings

**Option A: Project-specific** (recommended)
```bash
# Edit .claude/settings.local.json
# Merge the "hooks" object from above into your settings
```

**Option B: Global for all projects**
```bash
# Edit ~/.claude/settings.json
# Add hooks configuration
```

### 4. Test hooks work

```bash
# Test security hook (SessionStart)
# Temporarily move .env to trigger it
mv .env .env.backup
claude  # Should show security error
mv .env.backup .env

# Test memory hook (PreToolUse)
# Run a vitest command
claude
> npm run test:unit  # Should check memory first

# Test hardware hook (PreToolUse)
# Start a sweep, then try another
curl -X POST http://localhost:5173/api/hackrf/start-sweep
claude
> hackrf_info  # Should be blocked

# Check audit log (PostToolUse)
cat ~/.claude/sessions/$(date +%Y-%m-%d)-audit.jsonl
```

---

## Key Improvements Over Original Design

1. **Correct data access**: stdin JSON parsing instead of non-existent env vars
2. **Correct exit codes**: Exit 2 for blocking, exit 0 + JSON for decisions
3. **Correct matchers**: Simple regex strings instead of nested objects
4. **Proper JSON format**: `hookSpecificOutput.permissionDecision` for PreToolUse
5. **Portable paths**: `$CLAUDE_PROJECT_DIR` instead of hardcoded paths
6. **Async support**: PostToolUse hooks marked async where appropriate
7. **Proper timeouts**: 1-5s based on Anthropic recommendations

---

## References

- Official Hooks Documentation: https://code.claude.com/docs/en/hooks.md
- Hooks Guide: https://code.claude.com/docs/en/hooks-guide.md
- Example Implementations: https://github.com/anthropics/claude-code/tree/main/examples/hooks
