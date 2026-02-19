# Vite Dev Server Restart Investigation

**Date**: 2026-02-18
**Branch**: 007-tak-server-p2
**Status**: UNRESOLVED — root cause not yet identified

---

## The Problem

The Vite dev server at `100.120.210.5:5173` keeps dying and restarting on its own. The user sees the browser page refresh repeatedly. This is NOT an HMR hot reload — the entire Vite process dies and must be relaunched.

---

## System Context

- **Hardware**: Raspberry Pi 5, 8GB RAM, 500GB NVMe
- **OS**: Kali Linux 2025.4, aarch64, kernel 6.12.34+rpt-rpi-2712
- **Memory at time of investigation**: 6.6GB used / 7.9GB total, 6GB swap used / 8GB total
- **Load average**: ~3.4
- **Vite RSS**: ~350-363MB per instance

---

## Summary of Findings

### Issue Layer 1 (FIXED): Keepalive restart storm

The `argos-dev-monitor.service` watchdog was calling `npm run dev` to restart Vite. But `npm run dev` runs `kill-dev` first, which kills any existing Vite. This created a self-destructive loop:

1. Keepalive detects port 5173 down → calls `npm run dev`
2. `npm run dev` calls `kill-dev` → kills existing Vite
3. Starts new Vite in tmux
4. Keepalive checks again 10s later → brief port gap during boot → detects DOWN
5. Calls `npm run dev` again → kills the one it just started
6. Repeat: **144 restart cycles** logged in `keepalive_vite.log`

**Fix applied**: Replaced `npm run dev` with direct `tmux new-session` + `vite-oom-protect.sh`. Added 30s cooldown. Commit `5b8c746`.

**Result**: Restart storm eliminated. But Vite still dies from something else.

### Issue Layer 2 (UNRESOLVED): Something kills the Vite process

After fixing the keepalive storm, Vite still died once during observation (~1 minute after starting). The keepalive correctly restarted it once (no storm), but the question remains: **what killed it?**

---

## All Files Involved

### Primary suspects (scripts that touch Vite lifecycle)

| File                                                               | Role                                                   |
| ------------------------------------------------------------------ | ------------------------------------------------------ |
| `/home/kali/Documents/Argos/Argos/scripts/ops/keepalive-dev.sh`    | Watchdog that monitors port 5173 and restarts Vite     |
| `/home/kali/Documents/Argos/Argos/scripts/dev/vite-oom-protect.sh` | Wrapper that launches Vite and sets oom_score_adj=-500 |
| `/home/kali/Documents/Argos/Argos/build-tools/package.json`        | Contains `dev` and `kill-dev` npm scripts              |

### Systemd services

| File                                                        | Role                                                     |
| ----------------------------------------------------------- | -------------------------------------------------------- |
| `/home/kali/.config/systemd/user/argos-dev-monitor.service` | User service that runs keepalive-dev.sh (Restart=always) |

### Configuration files

| File                                                              | Role                                                   |
| ----------------------------------------------------------------- | ------------------------------------------------------ |
| `/home/kali/Documents/Argos/Argos/vite.config.ts`                 | Vite config — has `server.watch.ignored` for .db files |
| `/home/kali/Documents/Argos/Argos/svelte.config.js`               | SvelteKit config — deprecated `kit.files.*` options    |
| `/home/kali/Documents/Argos/Argos/config/vite-plugin-terminal.ts` | Custom Vite plugin — WebSocket server on port 3001     |

### OOM/memory protection

| File / Process      | Role                                                          |
| ------------------- | ------------------------------------------------------------- |
| `/usr/bin/earlyoom` | OOM killer running with `--avoid` regex and `--prefer ollama` |
| earlyoom config     | `-m 10 -s 50 -r 60 --avoid (init\|sshd\|...\|vite\|...)`      |
| zram-swap.service   | 4GB zstd compressed swap                                      |

### Logs

| File                                                       | Contents                                              |
| ---------------------------------------------------------- | ----------------------------------------------------- |
| `/tmp/argos-dev.log`                                       | Current Vite stdout/stderr (overwritten each restart) |
| `/home/kali/Documents/Argos/Argos/logs/keepalive_vite.log` | Keepalive's restart attempts output                   |
| `journalctl --user -u argos-dev-monitor.service`           | Systemd journal for keepalive service                 |

---

## Possible Causes for Layer 2 (Unresolved)

### 1. earlyoom killing wrapper processes

The Vite node process has `oom_score_adj=-500` (protected), but the wrapper processes (zsh, bash) running the tmux session have `oom_score_adj=200` with `oom_score=800`. If earlyoom kills the wrapper, SIGHUP may propagate down and kill Vite.

**Evidence for**: Wrapper PIDs confirmed at oom_score=800 during investigation.
**Evidence against**: earlyoom `--avoid` regex includes `vite` but that matches `/proc/PID/comm`, and the wrapper comm is `bash`/`zsh`, not `vite`. So earlyoom WOULD kill the wrapper.

### 2. Memory pressure (system at 83% RAM + heavy swap)

System was at 6.6GB/7.9GB RAM with 6GB/8GB swap used. Load average 3.4. Under this pressure, any unprotected process is a target.

**Evidence for**: High memory usage confirmed via `free -h`.
**Evidence against**: No OOM kill messages in `dmesg`.

### 3. Vite HMR full restart from file changes

Claude Code, git operations, or other tools writing to the project directory could trigger Vite's file watcher, causing a full server restart (not just HMR update). During the restart window, port 5173 would be briefly unavailable.

**Evidence for**: Multiple tools actively write to the project directory.
**Evidence against**: Vite HMR restarts don't kill the process — they restart internally without dropping the port for more than ~1 second. The keepalive check interval is 10s.

### 4. Node.js crash under memory pressure

Node.js could hit the `--max-old-space-size=2048` limit and crash with a heap OOM, or V8 could fail to allocate.

**Evidence for**: Vite RSS was ~350MB and growing. With 2048MB limit and multiple V8 heaps...
**Evidence against**: No crash message seen in `/tmp/argos-dev.log`.

### 5. tmux session death propagating SIGHUP

If the tmux session `argos-dev` is killed (by tmux itself, by another script, or by a stale tmux-resurrect operation), it sends SIGHUP to all processes in the session.

**Evidence for**: Multiple tmux sessions active (dev, tmux-0, tmux-1, argos-dev). tmux-resurrect and tmux-continuum are installed.
**Evidence against**: `@resurrect-processes` set to `false` per MEMORY.md.

---

## What Has Been Tried

### Attempt 1: OOM protection wrapper (commit ddc9b84, 2026-02-17)

**What**: Created `vite-oom-protect.sh` to set `oom_score_adj=-500` on Vite process tree via sudo. Added lock file protocol to keepalive to prevent race with manual restarts.

**Result**: Did not fix the problem. Vite continued to restart.

### Attempt 2: Fix keepalive restart storm (commit 5b8c746, 2026-02-18)

**What**: Replaced `npm run dev` call in keepalive with direct `tmux new-session` + `vite-oom-protect.sh`. Added 30s cooldown after restarts. Increased port check wait from 5s to 8s.

**Testing**:

- 3 manual kill-and-watch cycles: all passed (single restart, no storm)
- 2-minute continuous PID monitoring: stable (RSS 358-363MB)
- Journal confirmed: 3 kills → 3 single restarts → 0 storms

**Result**: Eliminated the restart storm, but Vite still died once on its own ~1 minute after test 3. The keepalive correctly handled it (single restart), but the underlying kill cause is unknown.

---

## What Has NOT Been Tried

1. Adding exit signal trap to `vite-oom-protect.sh` to log WHY Vite dies
2. Running `strace -e signal -p <vite_pid>` to catch the kill signal in real time
3. Protecting wrapper PIDs (zsh/bash) with `oom_score_adj` too
4. Checking earlyoom's own log (`journalctl -u earlyoom`) for kill events
5. Adding `server.hmr.overlay: false` or `server.watch` exclusions to vite.config.ts
6. Disabling the keepalive entirely to see if Vite survives on its own
7. Checking if tmux-continuum or tmux-resurrect interfere with the argos-dev session
