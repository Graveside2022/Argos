#!/bin/bash
# memory-health-check.sh — Argos RPi5 memory defense stack verification
# Phase 5.1 of recursive-meandering-moore hardening plan
# Usage: ./scripts/ops/memory-health-check.sh
# Exit 0 = all checks pass, exit 1 = one or more FAIL

set -uo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

PASS=0
FAIL=0
WARN=0

pass() { echo -e "  ${GREEN}PASS${RESET}  $1"; ((PASS++)); }
fail() { echo -e "  ${RED}FAIL${RESET}  $1"; ((FAIL++)); }
warn() { echo -e "  ${YELLOW}WARN${RESET}  $1"; ((WARN++)); }
section() { echo -e "\n${CYAN}${BOLD}=== $1 ===${RESET}"; }

echo -e "${BOLD}Argos Memory Defense Stack — Health Check${RESET}"
echo -e "$(date '+%Y-%m-%d %H:%M:%S') on $(hostname)"
echo "----------------------------------------"

# ── L1: /tmp size cap ────────────────────────────────────────────────────────
section "L1: /tmp Size Cap"

TMP_SIZE_K=$(mount | awk '$3=="/tmp" && $5=="tmpfs"{match($0,/size=([0-9]+k?)/,a); print a[1]}')
if echo "$TMP_SIZE_K" | grep -q '^524288k$'; then
    pass "/tmp capped at 512 MB (size=524288k)"
elif [ -n "$TMP_SIZE_K" ]; then
    fail "/tmp size is $TMP_SIZE_K — expected 524288k (512 MB)"
else
    fail "/tmp not mounted as tmpfs with explicit size= option"
fi

# ── L3: earlyoom ─────────────────────────────────────────────────────────────
section "L3: earlyoom"

if systemctl is-active --quiet earlyoom 2>/dev/null; then
    EARLYOOM_ARGS=$(grep 'EARLYOOM_ARGS' /etc/default/earlyoom 2>/dev/null || true)
    # Extract -m value
    M_VAL=$(echo "$EARLYOOM_ARGS" | grep -oP '(?<=-m )\d+' || echo "0")
    if [ "${M_VAL:-0}" -ge 5 ]; then
        pass "earlyoom active with -m ${M_VAL} (>= 5)"
    else
        fail "earlyoom active but -m ${M_VAL:-0} < 5 (too low)"
    fi
else
    fail "earlyoom is not active"
fi

# ── L2: sysctl values ────────────────────────────────────────────────────────
section "L2: sysctl Tuning"

check_sysctl() {
    local key="$1" expected="$2"
    local actual
    actual=$(sysctl -n "$key" 2>/dev/null || echo "MISSING")
    if [ "$actual" = "$expected" ]; then
        pass "$key = $actual"
    else
        fail "$key = ${actual} (expected $expected)"
    fi
}

check_sysctl vm.swappiness 80
check_sysctl vm.min_free_kbytes 131072
check_sysctl vm.vfs_cache_pressure 150

# ── L2: tmpfiles.d ───────────────────────────────────────────────────────────
section "L2: Temp File Aging"

if [ -f /etc/tmpfiles.d/argos-cleanup.conf ]; then
    pass "/etc/tmpfiles.d/argos-cleanup.conf exists"
else
    fail "/etc/tmpfiles.d/argos-cleanup.conf missing"
fi

if dpkg -l tmpreaper 2>/dev/null | grep -q '^ii'; then
    pass "tmpreaper installed"
else
    warn "tmpreaper not installed (Phase 2.3 incomplete — apt install tmpreaper)"
fi

# ── L4/L5: Per-service cgroup budgets ────────────────────────────────────────
section "L4/L5: Per-Service cgroup MemoryHigh"

check_memoryhigh_user() {
    local svc="$1" label="$2"
    local val
    val=$(systemctl --user show "$svc" --property=MemoryHigh 2>/dev/null | cut -d= -f2)
    if [ -n "$val" ] && [ "$val" != "infinity" ] && [ "$val" != "0" ]; then
        local mb=$(( val / 1024 / 1024 ))
        pass "$label ($svc) MemoryHigh=${mb}MB"
    else
        fail "$label ($svc) has no MemoryHigh set (val=${val:-MISSING})"
    fi
}

check_memoryhigh_user "chroma-server" "ChromaDB"
check_memoryhigh_user "argos-dev-monitor" "Argos Dev Monitor"

# ── L13: NODE_COMPILE_CACHE off /tmp ─────────────────────────────────────────
section "L13: NODE_COMPILE_CACHE"

NODE_CC="${NODE_COMPILE_CACHE:-}"
if [ -z "$NODE_CC" ]; then
    # Try reading from environment.d
    NODE_CC=$(grep 'NODE_COMPILE_CACHE' ~/.config/environment.d/*.conf 2>/dev/null | head -1 | cut -d= -f2 || true)
fi

if [ -z "$NODE_CC" ]; then
    warn "NODE_COMPILE_CACHE not set (Phase 4.2 incomplete)"
elif echo "$NODE_CC" | grep -q '^/tmp'; then
    fail "NODE_COMPILE_CACHE=$NODE_CC points to /tmp (tmpfs) — must be on NVMe"
else
    pass "NODE_COMPILE_CACHE=$NODE_CC (on NVMe)"
fi

# ── L12: argos-startup.service ───────────────────────────────────────────────
section "L12: argos-startup.service"

STARTUP_STATE=$(sudo systemctl is-active argos-startup.service 2>/dev/null || echo "unknown")
if [ "$STARTUP_STATE" = "active" ]; then
    pass "argos-startup.service is active"
elif [ "$STARTUP_STATE" = "inactive" ]; then
    # inactive is OK for a oneshot that ran at boot
    STARTUP_RESULT=$(sudo systemctl show argos-startup.service --property=Result 2>/dev/null | cut -d= -f2)
    if [ "$STARTUP_RESULT" = "success" ]; then
        pass "argos-startup.service ran successfully at boot (oneshot)"
    else
        warn "argos-startup.service is inactive (result=$STARTUP_RESULT)"
    fi
else
    fail "argos-startup.service state: $STARTUP_STATE"
fi

# ── Orphan bun workers ───────────────────────────────────────────────────────
section "Orphan Process Check"

ORPHAN_COUNT=0
for pid in $(pgrep -f 'bun.*worker-service' 2>/dev/null); do
    ppid=$(awk '{print $4}' /proc/$pid/stat 2>/dev/null || echo "0")
    parent_comm=$(cat /proc/$ppid/comm 2>/dev/null || echo "")
    if [ "$ppid" = "1" ] || [ "$parent_comm" = "systemd" ]; then
        rss_mb=$(awk '{printf "%d", $2*4/1024}' /proc/$pid/statm 2>/dev/null || echo "?")
        echo "         Found orphan bun PID $pid (${rss_mb}MB, PPID=$ppid/$parent_comm)"
        ((ORPHAN_COUNT++))
    fi
done
if [ "$ORPHAN_COUNT" -eq 0 ]; then
    pass "No orphan bun workers (PPID=1 or parent=systemd)"
else
    fail "$ORPHAN_COUNT orphan bun worker(s) found — run .claude/hooks/cleanup-stale-daemons.sh"
fi

# ── Jaeger cgroup check ──────────────────────────────────────────────────────
section "Jaeger Containment"

JAEGER_PIDS=$(pgrep -f 'jaeger-all-in-one' 2>/dev/null || true)
if [ -z "$JAEGER_PIDS" ]; then
    pass "Jaeger not running"
else
    UNCONTROLLED=0
    for pid in $JAEGER_PIDS; do
        IN_CGROUP=$(grep -c 'jaeger' /proc/$pid/cgroup 2>/dev/null || echo "0")
        RSS_MB=$(awk '{printf "%d", $2*4/1024}' /proc/$pid/statm 2>/dev/null || echo "0")
        if [ "$IN_CGROUP" -eq 0 ]; then
            echo "         Jaeger PID $pid (${RSS_MB}MB) has NO jaeger cgroup"
            ((UNCONTROLLED++))
        fi
    done
    if [ "$UNCONTROLLED" -eq 0 ]; then
        pass "Jaeger running inside cgroup (controlled)"
    else
        fail "$UNCONTROLLED Jaeger process(es) running without cgroup containment"
    fi
fi

# ── PSI boot param ───────────────────────────────────────────────────────────
section "PSI Boot Parameter"

if grep -q 'psi=1' /boot/firmware/cmdline.txt 2>/dev/null; then
    # Check if PSI is actually active (requires reboot after adding param)
    if [ -f /proc/pressure/memory ]; then
        pass "psi=1 in cmdline.txt AND /proc/pressure/memory is active"
    else
        warn "psi=1 in cmdline.txt but /proc/pressure/memory absent (reboot required)"
    fi
else
    fail "psi=1 not found in /boot/firmware/cmdline.txt"
fi

# ── Memory snapshot ──────────────────────────────────────────────────────────
section "Memory Snapshot"

AVAIL_MB=$(awk '/MemAvailable/{printf "%d", $2/1024}' /proc/meminfo)
TOTAL_MB=$(awk '/MemTotal/{printf "%d", $2/1024}' /proc/meminfo)
SWAP_TOTAL=$(awk '/SwapTotal/{print $2}' /proc/meminfo)
SWAP_FREE=$(awk '/SwapFree/{print $2}' /proc/meminfo)
TMP_PCT=$(df /tmp 2>/dev/null | awk 'NR==2{print int($5)}')

echo "         RAM: ${AVAIL_MB}MB available / ${TOTAL_MB}MB total"

if [ "$AVAIL_MB" -lt 500 ]; then
    warn "Available RAM ${AVAIL_MB}MB < 500 MB threshold"
else
    pass "Available RAM ${AVAIL_MB}MB >= 500 MB"
fi

if [ "$SWAP_TOTAL" -gt 0 ]; then
    SWAP_USED_PCT=$(( (SWAP_TOTAL - SWAP_FREE) * 100 / SWAP_TOTAL ))
    echo "         Swap: ${SWAP_USED_PCT}% used"
    if [ "$SWAP_USED_PCT" -gt 80 ]; then
        warn "Swap usage ${SWAP_USED_PCT}% > 80% threshold"
    else
        pass "Swap usage ${SWAP_USED_PCT}% <= 80%"
    fi
else
    warn "No swap configured"
fi

echo "         /tmp: ${TMP_PCT}% used"
if [ "$TMP_PCT" -gt 70 ]; then
    warn "/tmp at ${TMP_PCT}% > 70% threshold"
else
    pass "/tmp at ${TMP_PCT}% <= 70%"
fi

# ── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo "========================================"
TOTAL=$(( PASS + FAIL + WARN ))
echo -e "${BOLD}Summary: ${TOTAL} checks — ${GREEN}${PASS} PASS${RESET} / ${RED}${FAIL} FAIL${RESET} / ${YELLOW}${WARN} WARN${RESET}"
echo "========================================"

if [ "$FAIL" -gt 0 ]; then
    echo -e "${RED}System NOT fully hardened. Fix FAIL items before field deployment.${RESET}"
    exit 1
elif [ "$WARN" -gt 0 ]; then
    echo -e "${YELLOW}System mostly hardened. Review WARN items.${RESET}"
    exit 0
else
    echo -e "${GREEN}All checks passed. Memory defense stack is fully operational.${RESET}"
    exit 0
fi
