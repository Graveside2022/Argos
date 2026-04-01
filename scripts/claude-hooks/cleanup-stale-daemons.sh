#!/bin/bash
# cleanup-stale-daemons.sh — Kill orphaned claude-mem worker-service daemons
# Runs on SessionStart to prevent stale bun workers from accumulating.
#
# Problem: claude-mem spawns a `bun worker-service.cjs --daemon` process per
# Claude Code session. When the session ends, the daemon stays alive (PPID=1).
# Each new session spawns a fresh one, so they accumulate (~50-450 MiB each).
#
# Solution: On session start, kill any worker-service daemons whose parent is
# PID 1 (orphaned) AND older than 30 seconds. The age check prevents a race
# where this hook fires AFTER the plugin's SessionStart hook has already
# spawned a fresh worker — without the age guard, the freshly-started worker
# would be immediately killed, leaving claude-mem dead for the entire session.

KILLED=0
FREED_KB=0
MIN_AGE_SECS=30
NOW=$(date +%s)

while read -r pid ppid rss; do
    # Kill orphaned daemons (reparented to init or systemd --user)
    parent_comm=$(ps -o comm= -p "$ppid" 2>/dev/null | tr -d ' ')
    if [ "$ppid" = "1" ] || [ "$parent_comm" = "systemd" ]; then
        # Skip workers started less than MIN_AGE_SECS ago (likely just spawned
        # by the plugin's own SessionStart hook running concurrently)
        start_time=$(stat -c %Y "/proc/$pid" 2>/dev/null || echo "$NOW")
        age=$((NOW - start_time))
        if [ "$age" -lt "$MIN_AGE_SECS" ]; then
            continue
        fi
        FREED_KB=$((FREED_KB + rss))
        kill "$pid" 2>/dev/null && KILLED=$((KILLED + 1))
        # Also kill any MCP server children that were parented to this worker
        for child in $(pgrep -P "$pid" 2>/dev/null); do
            child_rss=$(awk '/VmRSS/{print $2}' /proc/"$child"/status 2>/dev/null || echo 0)
            FREED_KB=$((FREED_KB + child_rss))
            kill "$child" 2>/dev/null && KILLED=$((KILLED + 1))
        done
    fi
done < <(pgrep -f "worker-service\.cjs --daemon" -d $'\n' 2>/dev/null | while read -r p; do
    awk '{print "'"$p"'", $4}' /proc/"$p"/stat 2>/dev/null | while read -r pid ppid; do
        rss=$(awk '/VmRSS/{print $2}' /proc/"$pid"/status 2>/dev/null || echo 0)
        echo "$pid $ppid $rss"
    done
done)

# === Stale tshark/dumpcap (>1 hour) ===
for pid in $(pgrep -f 'tshark|dumpcap' 2>/dev/null); do
    elapsed=$(ps -o etimes= -p "$pid" 2>/dev/null | tr -d ' ')
    if [ "${elapsed:-0}" -gt 3600 ]; then
        rss=$(awk '/VmRSS/{print $2}' /proc/"$pid"/status 2>/dev/null || echo 0)
        FREED_KB=$((FREED_KB + rss))
        kill "$pid" 2>/dev/null && KILLED=$((KILLED + 1))
    fi
done

# === Stale puppeteer chromium (>2 hours) ===
for pid in $(pgrep -f 'chromium.*user-data-dir=/tmp' 2>/dev/null); do
    elapsed=$(ps -o etimes= -p "$pid" 2>/dev/null | tr -d ' ')
    if [ "${elapsed:-0}" -gt 7200 ]; then
        rss=$(awk '/VmRSS/{print $2}' /proc/"$pid"/status 2>/dev/null || echo 0)
        FREED_KB=$((FREED_KB + rss))
        kill "$pid" 2>/dev/null && KILLED=$((KILLED + 1))
    fi
done

# === Uncontrolled Jaeger (not in cgroup, >300 MB RSS) ===
for pid in $(pgrep -f 'jaeger-all-in-one' 2>/dev/null); do
    in_cgroup=$(grep -c 'jaeger' /proc/$pid/cgroup 2>/dev/null || echo 0)
    rss_kb=$(awk '/VmRSS/{print $2}' /proc/"$pid"/status 2>/dev/null || echo 0)
    rss_mb=$((rss_kb / 1024))
    if [ "$in_cgroup" -eq 0 ] && [ "$rss_mb" -gt 300 ]; then
        FREED_KB=$((FREED_KB + rss_kb))
        kill "$pid" 2>/dev/null && KILLED=$((KILLED + 1))
    fi
done

if [ "$KILLED" -gt 0 ]; then
    FREED_MIB=$((FREED_KB / 1024))
    echo '{"additional_context": "Cleaned up '"$KILLED"' stale daemon(s), freed ~'"$FREED_MIB"' MiB"}'
fi

exit 0
