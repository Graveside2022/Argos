# Memory Optimization & Reliability

Argos is designed to run on resource-constrained hardware like the Raspberry Pi 5. To ensure stability during development and production, we use several optimization strategies and background monitoring services.

## 1. Automated Process Monitor

We use a custom systemd service to ensure critical development tools stay online, even if they crash or are killed by the OS.

- **Service Name**: `argos-dev-monitor.service`
- **Scope**: User-level systemd service
- **Script**: `scripts/ops/keepalive-dev.sh`

### What it monitors

The monitor checks the following ports every 10 seconds:

| Service               | Port   | Action on Failure                                  |
| --------------------- | ------ | -------------------------------------------------- |
| **Vite Dev Server**   | `5173` | Restarts the `npm run dev` tmux session.           |
| **Chromium Debugger** | `9222` | Restarts headless Chromium (and Xvfb/Display :99). |
| **Debug Proxy**       | `99`   | Restarts `socat` to expose debugger on port 99.    |

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

## 2. Memory Optimizations

To prevent the Raspberry Pi from freezing under load, we apply the following tuning:

### EarlyOOM Tuning

The default `earlyoom` settings on Kali are too aggressive for development (killing at 10% free RAM). We relax this to **5%**:

- **Config**: `/etc/default/earlyoom`
- **Setting**: `-m 5` (Trigger kill only when <5% RAM is free)

### Node.js Memory Limits

We explicitly cap the memory usage of the Vite development server to prevent it from consuming all available system RAM.

- **Limit**: 2GB (2048MB)
- **Config**: `package.json` -> `NODE_OPTIONS='--max-old-space-size=2048'`

## 3. Headless Debugging

For headless environments (SSH only), we run Chromium with remote debugging enabled.

- **Port 9222**: Native Chromium debug port (bound to localhost).
- **Port 99**: Proxied port accessible from other machines (via `socat`).

To manually start the debug proxy without the full monitor:

```bash
./scripts/dev/start-headless-debug.sh
```
