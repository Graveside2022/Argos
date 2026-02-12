# Claude Code Hooks - FINAL Production-Ready Implementation

**Date:** 2026-02-11
**Status:** ✅ Verified against official Anthropic documentation
**Version:** v3 (Deep Research Engine validated)

---

## Complete Configuration (settings.json)

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/security-check.sh",
            "timeout": 30
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
            "timeout": 30
          },
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/hardware-check.sh",
            "timeout": 30
          }
        ]
      },
      {
        "matcher": "Task",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/memory-check.sh",
            "timeout": 30
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
            "timeout": 30,
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
            "timeout": 30,
            "async": true
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/cleanup.sh",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

---

## Hook Scripts (Production-Ready)

### 1. Security Check (SessionStart) - WARNING ONLY

**File:** `.claude/hooks/security-check.sh`

```bash
#!/bin/bash
# Security validation hook (SessionStart)
# NOTE: SessionStart CANNOT block - can only warn via additionalContext

INPUT=$(cat) || exit 0

ARGOS_ROOT="$CLAUDE_PROJECT_DIR"
ENV_FILE="$ARGOS_ROOT/.env"

# Check 1: .env file exists
if [ ! -f "$ENV_FILE" ]; then
    cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "⚠️ CRITICAL: .env file missing at $ENV_FILE\n\nAction required:\n  1. Copy template: cp $ARGOS_ROOT/.env.example $ENV_FILE\n  2. Generate API key: openssl rand -hex 32\n  3. Add to .env: ARGOS_API_KEY=<your-key>\n\n⚠️ System will refuse to start without ARGOS_API_KEY"
  }
}
EOF
    exit 0  # Cannot block, only warn
fi

# Check 2: ARGOS_API_KEY present and valid length
source "$ENV_FILE" 2>/dev/null || exit 0

if [ -z "$ARGOS_API_KEY" ]; then
    cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "⚠️ CRITICAL: ARGOS_API_KEY not set in .env\n\nGenerate key: openssl rand -hex 32\nAdd to $ENV_FILE: ARGOS_API_KEY=<your-key>"
  }
}
EOF
    exit 0
fi

KEY_LENGTH=${#ARGOS_API_KEY}
if [ "$KEY_LENGTH" -lt 32 ]; then
    cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "⚠️ CRITICAL: ARGOS_API_KEY too short ($KEY_LENGTH chars, need ≥32)\n\nGenerate new key: openssl rand -hex 32\nReplace in $ENV_FILE"
  }
}
EOF
    exit 0
fi

# Check 3: MCP config (warning only, don't block)
MCP_CONFIG="$HOME/.claude/mcp.json"
if [ -f "$MCP_CONFIG" ] && grep -q "ARGOS_API_KEY" "$MCP_CONFIG"; then
    MCP_KEY=$(grep -o '"ARGOS_API_KEY"[[:space:]]*:[[:space:]]*"[^"]*"' "$MCP_CONFIG" | head -1 | sed 's/.*"\([^"]*\)"$/\1/')
    if [ -n "$MCP_KEY" ] && [ "$MCP_KEY" != "$ARGOS_API_KEY" ]; then
        cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "⚠️ WARNING: MCP config has different API key. MCP servers may fail to authenticate. Update $MCP_CONFIG with current key from .env"
  }
}
EOF
        exit 0
    fi
fi

# Success - output context
cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "✅ Security validation passed: ARGOS_API_KEY valid ($KEY_LENGTH chars)"
  }
}
EOF
exit 0
```

---

### 2. Memory Safety Guard (PreToolUse)

**File:** `.claude/hooks/memory-check.sh`

```bash
#!/bin/bash
# Memory safety guard (PreToolUse)
# Blocks operations when memory usage exceeds safe thresholds

INPUT=$(cat) || exit 0

# Extract tool name and command
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name' 2>/dev/null) || exit 0

# Only check memory for risky operations
RISKY=false

if [ "$TOOL_NAME" = "Bash" ]; then
    COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""' 2>/dev/null) || exit 0
    if echo "$COMMAND" | grep -qE 'vitest|npm (install|update|ci)|npm run test'; then
        RISKY=true
    fi
elif [ "$TOOL_NAME" = "Task" ]; then
    # Always check memory before spawning agents
    RISKY=true
fi

# Not a risky operation, allow it
if [ "$RISKY" = "false" ]; then
    exit 0
fi

# Memory thresholds
DANGER_THRESHOLD=60  # Block
WARN_THRESHOLD=50    # Warn but allow

# Get current memory usage percentage
MEM_USAGE=$(free -m 2>/dev/null | awk '/Mem:/ {printf "%.0f", $3/$2 * 100}')

# Handle free command failure
if [ -z "$MEM_USAGE" ]; then
    exit 0  # Fail-open if we can't check memory
fi

if [ "$MEM_USAGE" -ge "$DANGER_THRESHOLD" ]; then
    # BLOCK with JSON decision
    cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "Memory usage at ${MEM_USAGE}% (danger threshold: ${DANGER_THRESHOLD}%). OOM risk on Raspberry Pi 5 (8GB RAM, 1GB Node heap limit).\n\nRecommended actions:\n  1. Stop unnecessary processes: npm run kill-all\n  2. Check running agents: ps aux | grep -E 'vitest|node.*claude'\n  3. Wait for memory to drop below ${DANGER_THRESHOLD}%\n  4. Consider Docker restart: docker restart argos-dev"
  }
}
EOF
    exit 0
elif [ "$MEM_USAGE" -ge "$WARN_THRESHOLD" ]; then
    # ALLOW but warn (output to stdout becomes context)
    cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow",
    "additionalContext": "⚠️ Memory at ${MEM_USAGE}% (approaching ${DANGER_THRESHOLD}% limit). OOM protection active (earlyoom). Proceeding with caution."
  }
}
EOF
    exit 0
else
    # Memory safe, allow silently
    exit 0
fi
```

---

### 3. Hardware Conflict Prevention (PreToolUse)

**File:** `.claude/hooks/hardware-check.sh`

```bash
#!/bin/bash
# Hardware conflict detection (PreToolUse)
# Blocks HackRF operations when device is already in use

INPUT=$(cat) || exit 0

# Extract tool and command
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name' 2>/dev/null) || exit 0

if [ "$TOOL_NAME" != "Bash" ]; then
    exit 0  # Only check Bash commands
fi

COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""' 2>/dev/null) || exit 0

# Check if command involves HackRF
if ! echo "$COMMAND" | grep -qE 'hackrf_|grgsm_|api/hackrf/(start|sweep)|api/gsm-evil/control'; then
    exit 0  # Not HackRF-related, allow
fi

# Check for running HackRF processes
HACKRF_PROCS=$(pgrep -fa 'hackrf_|grgsm_' 2>/dev/null | grep -v grep || true)

if [ -n "$HACKRF_PROCS" ]; then
    # Device busy - BLOCK
    PROC_NAME=$(echo "$HACKRF_PROCS" | head -1 | awk '{for(i=2;i<=NF;i++) printf "%s ", $i}')

    cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "HackRF device is in use by: ${PROC_NAME}\n\nAction required:\n  1. Stop conflicting process:\n     - For HackRF sweep: curl -X POST http://localhost:5173/api/hackrf/stop-sweep\n     - For GSM Evil: curl -X POST http://localhost:5173/api/gsm-evil/control -d '{\"action\":\"stop\"}'\n  2. Or kill directly: sudo pkill -f 'hackrf_|grgsm_'"
  }
}
EOF
    exit 0
fi

# Check API status (if dev server is running)
if curl -s -f http://localhost:5173/api/health >/dev/null 2>&1; then
    GSM_STATUS=$(curl -s http://localhost:5173/api/gsm-evil/status 2>/dev/null || echo '{"running":false}')

    if echo "$GSM_STATUS" | grep -q '"running"[[:space:]]*:[[:space:]]*true'; then
        # GSM Evil active - BLOCK
        cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "GSM Evil monitoring active. Stop it first:\n  curl -X POST http://localhost:5173/api/gsm-evil/control -d '{\"action\":\"stop\"}'"
  }
}
EOF
        exit 0
    fi
fi

# Device available, allow
exit 0
```

---

### 4. Audit Trail Logger (PostToolUse)

**File:** `.claude/hooks/audit-log.sh`

```bash
#!/bin/bash
# Audit trail logger (PostToolUse)
# Logs all tool calls to JSONL file
# Async, non-blocking

INPUT=$(cat) || exit 0

LOG_DIR="$HOME/.claude/sessions"
mkdir -p "$LOG_DIR" 2>/dev/null || exit 0

DATE=$(date +%Y-%m-%d)
LOG_FILE="$LOG_DIR/${DATE}-audit.jsonl"

# Extract tool call details
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // "unknown"' 2>/dev/null)
SUCCESS=$(echo "$INPUT" | jq -r '.tool_response.success // true' 2>/dev/null)

# Determine action based on tool type
case "$TOOL_NAME" in
    "Edit")
        FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // "unknown"' 2>/dev/null)
        ACTION="edited $FILE"
        ;;
    "Write")
        FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // "unknown"' 2>/dev/null)
        ACTION="created $FILE"
        ;;
    "Read")
        FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // "unknown"' 2>/dev/null)
        ACTION="read $FILE"
        ;;
    "Bash")
        CMD=$(echo "$INPUT" | jq -r '.tool_input.command // "unknown"' 2>/dev/null | head -c 80)
        ACTION="ran: $CMD"
        ;;
    "Task")
        AGENT=$(echo "$INPUT" | jq -r '.tool_input.subagent_type // "unknown"' 2>/dev/null)
        ACTION="spawned $AGENT agent"
        ;;
    *)
        ACTION="used $TOOL_NAME"
        ;;
esac

# Write JSONL log entry (compact, one line)
echo "{\"timestamp\":\"$TIMESTAMP\",\"tool\":\"$TOOL_NAME\",\"action\":\"$ACTION\",\"success\":$SUCCESS}" >> "$LOG_FILE" 2>/dev/null

# Success (async, never blocks)
exit 0
```

---

### 5. Docker Context Reminder (PostToolUse)

**File:** `.claude/hooks/docker-reminder.sh`

```bash
#!/bin/bash
# Docker context reminder (PostToolUse)
# Reminds about npm rebuild after npm install

INPUT=$(cat) || exit 0

TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name' 2>/dev/null) || exit 0

if [ "$TOOL_NAME" != "Bash" ]; then
    exit 0
fi

COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""' 2>/dev/null) || exit 0

# Check if npm install was run
if echo "$COMMAND" | grep -q 'npm install'; then
    cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "additionalContext": "\n⚠️ Docker Context Reminder:\n   npm install ran on HOST. Rebuild native modules in container:\n   docker exec argos-dev npm rebuild node-pty\n"
  }
}
EOF
fi

exit 0
```

---

### 6. Session Cleanup (Stop)

**File:** `.claude/hooks/cleanup.sh`

```bash
#!/bin/bash
# Session cleanup (Stop event)
# Kills orphaned Vite and Vitest processes

INPUT=$(cat) || exit 0

# Check if Stop was already triggered (prevent infinite loops)
STOP_HOOK_ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active // false' 2>/dev/null)

if [ "$STOP_HOOK_ACTIVE" = "true" ]; then
    # Stop already triggered, don't run cleanup again
    exit 0
fi

echo "🧹 Cleaning up orphaned processes..." >&2

# Kill Vite dev server on port 5173 (if not in Docker)
VITE_PID=$(lsof -ti:5173 2>/dev/null || true)
if [ -n "$VITE_PID" ]; then
    echo "  Killing Vite process $VITE_PID" >&2
    kill $VITE_PID 2>/dev/null || true
fi

# Kill vitest processes
pkill -f "vitest" 2>/dev/null || true

echo "  ✓ Cleanup complete" >&2
exit 0
```

---

## Installation Instructions

### 1. Create hook scripts directory

```bash
cd /home/kali/Documents/Argos/Argos
mkdir -p .claude/hooks
```

### 2. Install all 6 scripts

```bash
# Create scripts (copy content from above)
cat > .claude/hooks/security-check.sh << 'EOF'
[paste content]
EOF

cat > .claude/hooks/memory-check.sh << 'EOF'
[paste content]
EOF

cat > .claude/hooks/hardware-check.sh << 'EOF'
[paste content]
EOF

cat > .claude/hooks/audit-log.sh << 'EOF'
[paste content]
EOF

cat > .claude/hooks/docker-reminder.sh << 'EOF'
[paste content]
EOF

cat > .claude/hooks/cleanup.sh << 'EOF'
[paste content]
EOF

# Make all executable
chmod +x .claude/hooks/*.sh
```

### 3. Add configuration to settings

**Edit `.claude/settings.local.json`:**

```bash
# Merge the "hooks" object from the configuration above
nano .claude/settings.local.json
```

**Or use project-specific config:**

```bash
# Create .claude/settings.json in project root
nano .claude/settings.json
```

Paste the complete configuration from the top of this document.

### 4. Test each hook

```bash
# Test 1: Security hook (SessionStart)
# Temporarily move .env
mv .env .env.backup
claude  # Should show warning in additionalContext
mv .env.backup .env

# Test 2: Memory hook (PreToolUse)
claude
> npm run test:unit  # Should check memory first

# Test 3: Hardware hook (PreToolUse)
curl -X POST http://localhost:5173/api/hackrf/start-sweep
claude
> hackrf_info  # Should be blocked

# Test 4: Audit log (PostToolUse)
cat ~/.claude/sessions/$(date +%Y-%m-%d)-audit.jsonl

# Test 5: Docker reminder (PostToolUse)
claude
> npm install lodash  # Should show reminder

# Test 6: Cleanup (Stop)
claude
# Exit Claude
# Check if processes were killed
```

---

## Changes from Previous Version

### Critical Fixes

1. **SessionStart matcher:** `""` → `"startup"` (correct matcher type)
2. **SessionStart blocking:** Removed exit 2 (cannot block), use `additionalContext` instead
3. **All timeouts:** 1-5s → 10-30s (proper Anthropic ranges)
4. **Audit log `.success` path:** `.success` → `.tool_response.success` (correct location)
5. **Cleanup infinite loop:** Added `stop_hook_active` check
6. **Error handling:** Added `|| exit 0` fail-open patterns for jq failures

### Optimizations

1. **Multiple matchers:** Combined hooks under same matcher where possible
2. **PostToolUse structure:** Separated `".*"` (audit all) from `"Bash"` (Docker reminder)
3. **Stop matcher:** Removed redundant matcher field (ignored anyway)

---

## Verification Status

✅ **All hooks verified against official Anthropic documentation**
✅ **Matcher syntax correct**
✅ **JSON paths correct**
✅ **Exit codes correct**
✅ **Decision formats correct**
✅ **Timeout values appropriate**
✅ **Async behavior correct**
✅ **Error handling fail-open**

**References:**
- https://code.claude.com/docs/en/hooks.md
- https://code.claude.com/docs/en/hooks-guide.md
- https://github.com/anthropics/claude-code/tree/main/examples/hooks

---

## Production Readiness

This configuration is **production-ready** for Argos deployment on Raspberry Pi 5.

**Safety features:**
- Memory OOM protection (60% threshold)
- Hardware conflict prevention (HackRF mutex)
- Security validation (API key check)
- Audit trail (session logging)
- Resource cleanup (process management)

**Pi5-optimized:**
- Conservative timeouts (30s for safety)
- Fail-open error handling (never blocks legitimate work)
- Async PostToolUse (non-blocking logging)
- Minimal subprocess spawning (efficient hook design)
