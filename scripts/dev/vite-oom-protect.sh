#!/usr/bin/env bash
# vite-oom-protect.sh — Launch Vite dev server with OOM protection
#
# Problem: earlyoom's --avoid regex matches comm names (e.g., "node", "esbuild"),
# NOT "vite". So the Vite process gets killed under memory pressure despite the
# avoid rule. Additionally, when launched from Claude Code's shell, child processes
# inherit oom_score_adj=200 (penalty), making them prime kill targets.
#
# Solution: Launch Vite, then use sudo to set oom_score_adj=-500 on its entire
# process tree so the kernel (and earlyoom) strongly prefer killing other things.

set -euo pipefail

OOM_PROTECT="-500"  # Negative = harder to kill. Range: -1000 to 1000
VITE_PORT="${VITE_PORT:-5173}"

# Launch Vite in the background
CI=true NODE_OPTIONS='--max-old-space-size=2048' \
  /usr/bin/strace -f -e trace=signal,exit_group -o "/tmp/vite_strace_$(date +%s).log" \
  npx vite dev --port "$VITE_PORT" --host 0.0.0.0 --strictPort &
VITE_PID=$!

# Wait for the process tree to fully spawn (node + esbuild children)
sleep 3

# Protect a PID from OOM killing. Requires sudo because lowering oom_score_adj
# below the inherited value needs CAP_SYS_ADMIN.
protect_pid() {
  local pid=$1
  if [ -d "/proc/$pid" ] 2>/dev/null; then
    local comm
    comm=$(cat "/proc/$pid/comm" 2>/dev/null || echo "unknown")
    local current
    current=$(cat "/proc/$pid/oom_score_adj" 2>/dev/null || echo "?")
    if sudo -n sh -c "echo $OOM_PROTECT > /proc/$pid/oom_score_adj" 2>/dev/null; then
      echo "[oom-protect] PID $pid ($comm): $current -> $OOM_PROTECT"
    else
      echo "[oom-protect] PID $pid ($comm): FAILED (current=$current)"
    fi
  fi
}

# Use pgrep to find all processes in the Vite tree by tracing the parent chain.
# This is more reliable than /proc/PID/task/*/children traversal.
protect_tree() {
  local root_pid=$1
  # Collect all descendant PIDs using ps
  local pids
  pids=$(ps -eo pid,ppid --no-headers | awk -v root="$root_pid" '
    BEGIN { tree[root] = 1 }
    { child[$1] = $2 }
    END {
      changed = 1
      while (changed) {
        changed = 0
        for (pid in child) {
          if ((child[pid] in tree) && !(pid in tree)) {
            tree[pid] = 1
            changed = 1
          }
        }
      }
      for (pid in tree) print pid
    }
  ')

  local count=0
  for pid in $pids; do
    protect_pid "$pid"
    count=$((count + 1))
  done
  echo "[oom-protect] Protected $count processes in tree rooted at PID $root_pid"
}

protect_tree "$VITE_PID"

# Wait for Vite to exit (keeps this script alive as the foreground process)
wait "$VITE_PID"
