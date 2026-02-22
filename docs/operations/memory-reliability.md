# Memory Optimization & Reliability

Argos runs on Raspberry Pi 5 (8GB RAM). Memory is the primary constraint — development tools (VS Code Server, Claude CLI, Vite, test runners) compete for the same 8GB. This document covers the protection layers and known limits.

## Memory Budget

Typical development session baseline (before running builds/tests):

| Process Group                | RSS                 | Notes                              |
| ---------------------------- | ------------------- | ---------------------------------- |
| VS Code Server (Antigravity) | ~1,250 MB           | 6 processes, OOM-protected at -500 |
| Claude CLI + subagents       | ~650-1,000 MB       | oom_score_adj=200 (kill target)    |
| Vite dev server              | ~350 MB             | OOM-protected at -500 via wrapper  |
| Chroma + claude-mem          | ~475 MB             | Vector DB for Claude memory        |
| Chromium debug browser       | ~400 MB             | 3 processes                        |
| System/kernel                | ~500 MB             | Reserved                           |
| **Total baseline**           | **~3,600-4,000 MB** |                                    |

**Effective headroom: ~3,200 MB** (earlyoom triggers at 10% free = ~800 MB).

### What Fits and What Doesn't

| Task                                                    | Peak RSS      | Safe?                                     |
| ------------------------------------------------------- | ------------- | ----------------------------------------- |
| `npm run build`                                         | ~1,500 MB     | Yes, if NODE_OPTIONS caps heap at 1536 MB |
| `svelte-check`                                          | ~650 MB       | Yes, but only ONE instance at a time      |
| `npm run test:unit` (full suite)                        | **~2,700 MB** | **No** — OOMs with VS Code Server running |
| Targeted tests (`npx vitest run --no-coverage <files>`) | ~300 MB       | Yes                                       |

### Running the Full Test Suite

The full `npm run test:unit` loads all 40+ test files into a single Vitest worker fork, including SvelteKit transforms and filesystem-scanning constitution auditor tests. This peaks at ~2,700 MB RSS.

**To run the full suite safely**, either:

1. Stop VS Code Server first (frees ~1,250 MB)
2. Or run targeted tests instead:

    ```bash
    # Run specific test files (uses ~300 MB)
    npx vitest run --no-coverage src/lib/components/components.test.ts src/lib/utils/theme-colors.test.ts

    # Run all src/ tests (the 11 unit test files)
    npx vitest run --no-coverage src/
    ```

## 1. Automated Process Monitor

A systemd service ensures critical development tools stay online, even if they crash or are killed by earlyoom.

- **Service Name**: `argos-dev-monitor.service`
- **Scope**: User-level systemd service
- **Script**: `scripts/ops/keepalive-dev.sh`

### What it monitors

The monitor checks the following ports every 10 seconds:

| Service               | Port   | Action on Failure                                       |
| --------------------- | ------ | ------------------------------------------------------- |
| **Vite Dev Server**   | `5173` | Restarts the `npm run dev` tmux session                 |
| **Chromium Debugger** | `9224` | Restarts headless Chromium (and Xvfb/Display :99)       |
| **Debug Proxy**       | `99`   | Restarts `socat` to expose debugger on port 99          |
| **Claude Mem Plugin** | N/A    | Checks every 60s for plugin updates and applies patches |

Circuit breaker: after 10 consecutive failures, stops retrying for 5 minutes to prevent restart storms.

### Managing the Service

Since this is a user-level service, use the `--user` flag:

```bash
# Check status
systemctl --user status argos-dev-monitor

# View logs (live)
journalctl --user -u argos-dev-monitor -f

# Stop monitoring (e.g. if you want to run manually)
systemctl --user stop argos-dev-monitor

# Disable on boot
systemctl --user disable argos-dev-monitor
```

## 2. Memory Protection Layers

### Layer 1: EarlyOOM

Userspace OOM killer that acts before the kernel OOM killer (which can freeze the system).

- **Config**: `/etc/default/earlyoom`
- **Threshold**: `-m 10 -s 50` (kill when <10% RAM free AND <50% swap free)
- **Reporting**: `-r 60` (log memory stats every 60 seconds)
- **Avoid list**: init, sshd, tailscaled, NetworkManager, dockerd, systemd, vite, chroma, Xvfb, chromium
- **Prefer list**: ollama, bun (kill these first)

```bash
# Check earlyoom kill history
journalctl -u earlyoom | grep "sending SIGTERM"

# Check current memory stats
journalctl -u earlyoom -n 1 --no-pager
```

### Layer 2: cgroup Memory Limits

Prevents all user processes from consuming the last ~512 MB (reserved for kernel/system).

- **Config**: `/etc/systemd/system/user-1000.slice.d/memory-limit.conf`
- **MemoryHigh**: Dynamically computed (total - 10% reserve, soft limit)
- **MemoryMax**: Dynamically computed (total - 5% reserve, hard kill)

### Layer 3: zram Compressed Swap

4GB compressed swap using zstd compression. Provides breathing room before earlyoom triggers.

- **Service**: `zram-swap.service`
- **Size**: 4GB, priority 100

### Layer 4: Vite OOM Protection

The `vite-oom-protect.sh` wrapper sets `oom_score_adj=-500` on the entire Vite process tree so earlyoom strongly prefers killing other things.

- **Script**: `scripts/dev/vite-oom-protect.sh`
- **Heap cap**: `--max-old-space-size=2048`

### Layer 5: svelte-check Lock File

The auto-typecheck hook uses `/tmp/argos-typecheck.lock` to ensure only one `svelte-check` instance runs at a time (~650 MB each).

### Node.js Memory Limits

| Context             | Heap Limit | Config                                                   |
| ------------------- | ---------- | -------------------------------------------------------- |
| Dev server (tmux)   | 2048 MB    | `scripts/dev/vite-oom-protect.sh`                        |
| Dev server (simple) | 1024 MB    | `package.json` dev:simple script                         |
| Production service  | 1024 MB    | `deployment/argos-*.service`                             |
| Build (recommended) | 1536 MB    | `NODE_OPTIONS="--max-old-space-size=1536" npm run build` |

## 3. Headless Debugging

For headless environments (SSH only), we run Chromium with remote debugging enabled.

- **Port 9222**: Reserved for dev-browser/agent-browser automation tools
- **Port 9224**: Native Chromium debug port (bound to localhost)
- **Port 99**: Proxied port accessible from other machines (via `socat`)

To manually start the debug proxy without the full monitor:

```bash
./scripts/dev/start-headless-debug.sh
```

## 4. Production Stability

In production (systemd service, no IDE, no Claude CLI), Argos uses ~350 MB. The earlyoom + zram + cgroup stack provides multiple safety layers. OOM is exclusively a development-time concern.
