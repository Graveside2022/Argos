#!/bin/bash
# scripts/ops/mem-guard.sh
# Memory-safe wrapper for heavy dev commands (build, lint, typecheck, test).
#
# Three protections:
#   1. Pre-flight memory check — refuses to start if RAM > threshold
#   2. Concurrency lock — only one heavy command at a time
#   3. Automatic cleanup — kills stale MCP/bun processes if memory is tight
#
# Usage: ./scripts/ops/mem-guard.sh <command> [args...]
# Example: ./scripts/ops/mem-guard.sh npx vite build
#          ./scripts/ops/mem-guard.sh npx eslint src/
#
# Environment overrides:
#   MEM_GUARD_THRESHOLD=85   — percentage used above which command is blocked
#   MEM_GUARD_SKIP=1         — bypass all checks (CI environments)

set -euo pipefail

# --- Configuration ---
THRESHOLD="${MEM_GUARD_THRESHOLD:-85}"
LOCKFILE="/tmp/argos-heavy-cmd.lock"
LOCK_MAX_AGE=600  # 10 minutes — stale lock protection

# --- Colors ---
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
DIM='\033[0;90m'
RESET='\033[0m'

# --- Functions ---

mem_pct() {
    awk '/MemTotal/{t=$2} /MemAvailable/{a=$2} END{printf "%d", (t-a)*100/t}' /proc/meminfo 2>/dev/null
}

mem_available_mb() {
    awk '/MemAvailable/{printf "%d", $2/1024}' /proc/meminfo 2>/dev/null
}

cleanup_if_tight() {
    local pct
    pct=$(mem_pct)
    if [ "$pct" -lt 75 ]; then
        return  # Plenty of memory, skip cleanup
    fi

    echo -e "${YELLOW}Memory at ${pct}%. Running pre-flight cleanup...${RESET}"

    # Kill stale bun workers (claude-mem daemon orphans)
    local killed=0
    while read -r pid; do
        local ppid parent_comm
        ppid=$(awk '{print $4}' "/proc/$pid/stat" 2>/dev/null) || continue
        parent_comm=$(cat "/proc/$ppid/comm" 2>/dev/null) || parent_comm="unknown"
        if [ "$ppid" = "1" ] || [ "$parent_comm" = "systemd" ]; then
            local rss_mb
            rss_mb=$(awk '{printf "%d", $2*4/1024}' "/proc/$pid/statm" 2>/dev/null) || continue
            if [ "$rss_mb" -gt 30 ]; then
                kill "$pid" 2>/dev/null && killed=$((killed + 1))
                echo -e "  ${DIM}Killed orphan bun worker PID $pid (${rss_mb}MB)${RESET}"
            fi
        fi
    done < <(pgrep -f "bun.*worker-service" 2>/dev/null || true)

    if [ "$killed" -gt 0 ]; then
        sleep 1  # Let memory reclaim
        echo -e "  ${GREEN}Freed ~$((killed * 100))MB (killed $killed orphan workers)${RESET}"
    fi
}

acquire_lock() {
    # Check for stale lock
    if [ -f "$LOCKFILE" ]; then
        local lock_pid lock_age
        lock_pid=$(cat "$LOCKFILE" 2>/dev/null || echo "0")
        lock_age=$(( $(date +%s) - $(stat -c %Y "$LOCKFILE" 2>/dev/null || echo 0) ))

        if [ "$lock_age" -gt "$LOCK_MAX_AGE" ]; then
            echo -e "${YELLOW}Stale lock (${lock_age}s old, PID $lock_pid). Removing.${RESET}"
            rm -f "$LOCKFILE"
        elif kill -0 "$lock_pid" 2>/dev/null; then
            local lock_cmd
            lock_cmd=$(ps -p "$lock_pid" -o args= 2>/dev/null | head -c 60)
            echo -e "${RED}Another heavy command is running:${RESET}"
            echo -e "  ${DIM}PID $lock_pid: $lock_cmd${RESET}"
            echo -e "${RED}Wait for it to finish or kill it: kill $lock_pid${RESET}"
            return 1
        else
            # PID is dead, remove stale lock
            rm -f "$LOCKFILE"
        fi
    fi

    echo $$ > "$LOCKFILE"
    trap 'rm -f "$LOCKFILE"' EXIT
    return 0
}

# --- Main ---

if [ "${MEM_GUARD_SKIP:-0}" = "1" ]; then
    exec "$@"
fi

if [ $# -eq 0 ]; then
    echo "Usage: $0 <command> [args...]"
    echo "Example: $0 npx vite build"
    exit 1
fi

# Step 1: Acquire concurrency lock
if ! acquire_lock; then
    exit 1
fi

# Step 2: Pre-flight cleanup if memory is getting tight
cleanup_if_tight

# Step 3: Memory pre-check
MEM_PCT=$(mem_pct)
MEM_AVAIL=$(mem_available_mb)

if [ "$MEM_PCT" -ge "$THRESHOLD" ]; then
    echo -e "${RED}Memory at ${MEM_PCT}% (${MEM_AVAIL}MB available).${RESET}"
    echo -e "${RED}Threshold: ${THRESHOLD}%. Command blocked to prevent OOM.${RESET}"
    echo ""
    echo "Options:"
    echo "  1. Close VS Code / Chromium / other heavy apps"
    echo "  2. Kill MCP servers: pkill -f 'npm exec.*mcp'"
    echo "  3. Force run: MEM_GUARD_SKIP=1 $*"
    exit 1
fi

# Step 4: Run the command with memory status
echo -e "${GREEN}Memory: ${MEM_PCT}% used (${MEM_AVAIL}MB available) — threshold ${THRESHOLD}%${RESET}"
echo -e "${DIM}Running: $*${RESET}"
echo ""

"$@"
EXIT_CODE=$?

# Step 5: Post-run memory report
MEM_AFTER=$(mem_pct)
MEM_AVAIL_AFTER=$(mem_available_mb)
echo ""
echo -e "${DIM}Memory after: ${MEM_AFTER}% (${MEM_AVAIL_AFTER}MB available)${RESET}"

exit $EXIT_CODE
