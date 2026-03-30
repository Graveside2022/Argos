#!/bin/bash
set -euo pipefail
LOG_TAG="argos-startup"
log() { logger -t "$LOG_TAG" "$*"; echo "[argos-startup] $*"; }

TMP_PCT=$(df /tmp | awk 'NR==2{print int($5)}')
if [ "$TMP_PCT" -gt 80 ]; then
  log "WARNING: /tmp at ${TMP_PCT}% — running emergency cleanup"
  find /tmp \( -name '*.pcap' -o -name '*.pcapng' \) -print | xargs rm -f 2>/dev/null || true
  find /tmp -maxdepth 2 -name 'puppeteer_*' -mmin +60 -exec rm -rf {} + 2>/dev/null || true
fi

SWAP_USED_PCT=$(free | awk '/Swap:/{if($2>0) printf "%d", $3/$2*100; else print 0}')
[ "$SWAP_USED_PCT" -gt 90 ] && log "WARNING: Swap at ${SWAP_USED_PCT}%"

AVAIL_MB=$(awk '/MemAvailable/{printf "%d", $2/1024}' /proc/meminfo)
log "Boot: ${AVAIL_MB}MB available, /tmp ${TMP_PCT}%, swap ${SWAP_USED_PCT}%"
exit 0
