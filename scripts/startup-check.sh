#!/usr/bin/env bash
# Argos Boot Health Verifier
# Called by argos-startup.service (Type=oneshot) at boot.
# Checks critical dependencies, cleans stale state, logs summary.
# Always exits 0 — warnings are non-fatal.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_TAG="argos-startup"

PASS_COUNT=0
WARN_COUNT=0
FAIL_COUNT=0

log()  { logger -t "$LOG_TAG" "$*"; echo "[$LOG_TAG] $*"; }
pass() { log "[PASS] $*"; ((PASS_COUNT++)) || true; }
warn() { log "[WARN] $*"; ((WARN_COUNT++)) || true; }
fail() { log "[FAIL] $*"; ((FAIL_COUNT++)) || true; }

# --- 1. Environment file ---
if [[ -f "$PROJECT_DIR/.env" ]]; then
  pass ".env exists"
  # Read only ARGOS_API_KEY — avoid exporting all secrets via set -a
  api_key=$(grep -E '^ARGOS_API_KEY=' "$PROJECT_DIR/.env" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
  if [[ -n "$api_key" && ${#api_key} -ge 32 ]]; then
    pass "ARGOS_API_KEY set (${#api_key} chars)"
  else
    fail "ARGOS_API_KEY missing or < 32 chars — app will refuse to start"
  fi
else
  fail ".env not found at $PROJECT_DIR/.env — app will refuse to start"
fi

# --- 2. Build directory (production only) ---
if [[ -d "$PROJECT_DIR/build" ]]; then
  pass "build/ directory exists"
else
  warn "build/ not found — run 'npm run build' before starting argos-final.service"
fi

# --- 3. Database path writable ---
DB_PATH=$(grep -E '^DATABASE_PATH=' "$PROJECT_DIR/.env" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'" || echo "")
DB_PATH="${DB_PATH:-./rf_signals.db}"
# Resolve relative paths against project dir
[[ "$DB_PATH" != /* ]] && DB_PATH="$PROJECT_DIR/$DB_PATH"
DB_DIR="$(dirname "$DB_PATH")"
if [[ -w "$DB_DIR" ]]; then
  pass "Database directory writable: $DB_DIR"
else
  warn "Database directory not writable: $DB_DIR"
fi

# --- 4. Critical services ---
for svc in gpsd earlyoom; do
  if systemctl is-active "$svc" >/dev/null 2>&1; then
    pass "$svc is running"
  else
    warn "$svc is not running"
  fi
done

# --- 5. Swap / zram ---
SWAP_TOTAL=$(free | awk '/Swap:/{print $2}')
if [[ "$SWAP_TOTAL" -gt 0 ]]; then
  SWAP_USED_PCT=$(free | awk '/Swap:/{printf "%d", $3/$2*100}')
  pass "Swap active (${SWAP_TOTAL}kB total, ${SWAP_USED_PCT}% used)"
  [[ "$SWAP_USED_PCT" -gt 90 ]] && warn "Swap usage at ${SWAP_USED_PCT}%"
else
  warn "No swap configured — consider enabling zram-swap"
fi

# --- 6. /tmp usage + emergency cleanup ---
TMP_PCT=$(df /tmp | awk 'NR==2{print int($5)}')
if [[ "$TMP_PCT" -gt 80 ]]; then
  warn "/tmp at ${TMP_PCT}% — running emergency cleanup"
  find /tmp \( -name '*.pcap' -o -name '*.pcapng' \) -print | xargs rm -f 2>/dev/null || true
  find /tmp -maxdepth 2 -name 'puppeteer_*' -mmin +60 -exec rm -rf {} + 2>/dev/null || true
else
  pass "/tmp at ${TMP_PCT}%"
fi

# --- 7. Available memory ---
AVAIL_MB=$(awk '/MemAvailable/{printf "%d", $2/1024}' /proc/meminfo)
if [[ "$AVAIL_MB" -gt 1024 ]]; then
  pass "${AVAIL_MB}MB available"
else
  warn "Only ${AVAIL_MB}MB available — expect memory pressure"
fi

# --- 8. Clean stale lock files ---
for lockfile in /tmp/argos-dev-restart.lock /tmp/argos-rf-compute.lock /tmp/argos-heavy-cmd.lock; do
  if [[ -f "$lockfile" ]]; then
    rm -f "$lockfile"
    log "Cleaned stale lock: $lockfile"
  fi
done

# --- Summary ---
log "Boot check complete: ${PASS_COUNT} pass, ${WARN_COUNT} warn, ${FAIL_COUNT} fail — ${AVAIL_MB}MB available"
exit 0
