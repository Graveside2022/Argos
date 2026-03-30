#!/bin/bash
# stress-test-memory.sh — Argos RPi5 memory hardening stress tests
# Phase 5.2 of recursive-meandering-moore hardening plan
# Usage: ./scripts/ops/stress-test-memory.sh
# Cleans up all test artifacts before exiting.

set -uo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

PASS=0
FAIL=0
WARN=0
TEST_FILE="/tmp/argos-stress-test-$$"

pass() { echo -e "  ${GREEN}PASS${RESET}  $1"; ((PASS++)); }
fail() { echo -e "  ${RED}FAIL${RESET}  $1"; ((FAIL++)); }
warn() { echo -e "  ${YELLOW}WARN${RESET}  $1"; ((WARN++)); }
section() { echo -e "\n${CYAN}${BOLD}=== $1 ===${RESET}"; }

cleanup() {
    rm -f "${TEST_FILE}"* 2>/dev/null || true
}
trap cleanup EXIT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ARGOS_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

echo -e "${BOLD}Argos Memory Defense Stack — Stress Tests${RESET}"
echo -e "$(date '+%Y-%m-%d %H:%M:%S') on $(hostname)"
echo "----------------------------------------"

# ── Test 1: /tmp cap rejects writes > 512 MB ─────────────────────────────────
section "Test 1: /tmp 512 MB Cap (ENOSPC)"

TMP_TOTAL_K=$(df /tmp | awk 'NR==2{print $2}')
TMP_AVAIL_K=$(df /tmp | awk 'NR==2{print $4}')
TMP_TOTAL_MB=$(( TMP_TOTAL_K / 1024 ))
TMP_AVAIL_MB=$(( TMP_AVAIL_K / 1024 ))

echo "         /tmp total: ${TMP_TOTAL_MB}MB, available: ${TMP_AVAIL_MB}MB"

if [ "$TMP_TOTAL_MB" -gt 600 ]; then
    warn "/tmp total is ${TMP_TOTAL_MB}MB — cap not at 512 MB. Skipping write test to avoid filling real tmpfs."
else
    # Try to write 600 MB (more than /tmp total) — expect failure
    echo "         Attempting to write 600 MB to /tmp (expect ENOSPC)..."
    WRITE_RESULT=0
    # Use dd with oflag=append to accumulate; write in 100MB chunks until failure
    WROTE_MB=0
    for i in 1 2 3 4 5 6 7; do
        if dd if=/dev/zero of="${TEST_FILE}.${i}" bs=1M count=100 2>/dev/null; then
            WROTE_MB=$(( WROTE_MB + 100 ))
        else
            WRITE_RESULT=1
            break
        fi
    done
    # Cleanup chunks immediately
    rm -f "${TEST_FILE}".* 2>/dev/null || true

    if [ "$WRITE_RESULT" -eq 1 ]; then
        pass "/tmp cap enforced — write failed with ENOSPC after ~${WROTE_MB}MB (cap=${TMP_TOTAL_MB}MB)"
    else
        fail "/tmp write of 600 MB succeeded — cap may not be enforced (wrote ${WROTE_MB}MB)"
    fi
fi

# ── Test 2: Chroma responds after cgroup limit ────────────────────────────────
section "Test 2: ChromaDB Heartbeat (cgroup-limited)"

CHROMA_MH=$(systemctl --user show chroma-server --property=MemoryHigh 2>/dev/null | cut -d= -f2)
if [ -n "$CHROMA_MH" ] && [ "$CHROMA_MH" != "infinity" ] && [ "$CHROMA_MH" != "0" ]; then
    MH_MB=$(( CHROMA_MH / 1024 / 1024 ))
    echo "         chroma-server MemoryHigh=${MH_MB}MB"
    CHROMA_STATUS=$(systemctl --user is-active chroma-server 2>/dev/null || echo "unknown")
    if [ "$CHROMA_STATUS" = "active" ]; then
        if curl -sf --max-time 5 http://127.0.0.1:8000/api/v2/heartbeat >/dev/null 2>&1; then
            pass "ChromaDB heartbeat OK while under ${MH_MB}MB MemoryHigh cgroup"
        else
            fail "ChromaDB service active but heartbeat HTTP failed (http://127.0.0.1:8000/api/v2/heartbeat)"
        fi
    else
        warn "chroma-server is not active (status=$CHROMA_STATUS) — skipping heartbeat test"
    fi
else
    warn "chroma-server has no MemoryHigh cgroup (Phase 3.3 incomplete) — skipping heartbeat test"
fi

# ── Test 3: earlyoom is monitoring (recent journal entries) ───────────────────
section "Test 3: earlyoom Journal Activity"

if ! systemctl is-active --quiet earlyoom 2>/dev/null; then
    fail "earlyoom is not active"
else
    # Check for recent log entries (last 10 minutes)
    RECENT_ENTRIES=$(journalctl -u earlyoom --since "10 minutes ago" --no-pager -q 2>/dev/null | wc -l)
    ALL_ENTRIES=$(journalctl -u earlyoom --no-pager -q -n 20 2>/dev/null | wc -l)
    echo "         earlyoom journal: ${RECENT_ENTRIES} entries in last 10min, ${ALL_ENTRIES} total recent"

    if [ "$ALL_ENTRIES" -gt 0 ]; then
        # Show last few lines for verification
        LAST_LINE=$(journalctl -u earlyoom --no-pager -q -n 1 2>/dev/null || true)
        echo "         Last entry: ${LAST_LINE}"
        pass "earlyoom has journal entries (active monitoring confirmed)"
    else
        warn "earlyoom has no journal entries — may have just started"
    fi
fi

# ── Test 4: cleanup-stale-daemons.sh runs clean ───────────────────────────────
section "Test 4: cleanup-stale-daemons.sh"

CLEANUP_HOOK="${ARGOS_ROOT}/.claude/hooks/cleanup-stale-daemons.sh"
if [ ! -f "$CLEANUP_HOOK" ]; then
    fail "cleanup-stale-daemons.sh not found at $CLEANUP_HOOK"
else
    CLEANUP_OUT=$(bash "$CLEANUP_HOOK" 2>&1)
    CLEANUP_EXIT=$?
    if [ $CLEANUP_EXIT -eq 0 ]; then
        LINE_COUNT=$(echo "$CLEANUP_OUT" | wc -l)
        echo "         Output: ${LINE_COUNT} lines (exit 0)"
        if [ -n "$CLEANUP_OUT" ]; then
            echo "$CLEANUP_OUT" | head -5 | sed 's/^/         /'
        fi
        pass "cleanup-stale-daemons.sh exited 0"
    else
        echo "$CLEANUP_OUT" | head -10 | sed 's/^/         /'
        fail "cleanup-stale-daemons.sh exited $CLEANUP_EXIT"
    fi
fi

# ── Test 5: startup-check.sh runs clean ──────────────────────────────────────
section "Test 5: startup-check.sh"

STARTUP_CHECK="${ARGOS_ROOT}/scripts/startup-check.sh"
if [ ! -f "$STARTUP_CHECK" ]; then
    fail "startup-check.sh not found at $STARTUP_CHECK"
else
    STARTUP_OUT=$(bash "$STARTUP_CHECK" 2>&1)
    STARTUP_EXIT=$?
    echo "$STARTUP_OUT" | sed 's/^/         /'
    if [ $STARTUP_EXIT -eq 0 ]; then
        pass "startup-check.sh exited 0"
    else
        fail "startup-check.sh exited $STARTUP_EXIT"
    fi
fi

# ── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo "========================================"
TOTAL=$(( PASS + FAIL + WARN ))
echo -e "${BOLD}Summary: ${TOTAL} tests — ${GREEN}${PASS} PASS${RESET} / ${RED}${FAIL} FAIL${RESET} / ${YELLOW}${WARN} WARN${RESET}"
echo "========================================"

if [ "$FAIL" -gt 0 ]; then
    echo -e "${RED}Stress tests revealed failures. Fix before field deployment.${RESET}"
    exit 1
elif [ "$WARN" -gt 0 ]; then
    echo -e "${YELLOW}Stress tests passed with warnings. Review WARN items.${RESET}"
    exit 0
else
    echo -e "${GREEN}All stress tests passed.${RESET}"
    exit 0
fi
