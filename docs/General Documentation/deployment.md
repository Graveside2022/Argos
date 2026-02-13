# Deployment Guide

## Raspberry Pi 5 Production Environment

**Hardware:**

- Raspberry Pi 5 Model B Rev 1.0
- 4x Cortex-A76 cores, 8GB RAM
- 500GB NVMe SSD (Kingston SNV3S500G) - NOT SD card
- HackRF One (USB 3.0 via powered hub)
- Alfa AWUS036AXML WiFi adapter
- USB GPS dongle (BU-353S4)

**Software:**

- Kali Linux 2025.4 (aarch64)
- Docker v27.5.1
- Kernel: 6.12.34+rpt-rpi-2712

## Docker Development Workflow

**Container: argos-dev**

- Image: `argos:dev` (built from local Dockerfile)
- Compose: [docker/docker-compose.portainer-dev.yml](../docker/docker-compose.portainer-dev.yml)
- Network: `network_mode: host` (required for hardware)
- Source: Host `/home/kali/Documents/Argos/Argos` → Container `/app`
- Shell: ZSH with Oh My Zsh, Powerlevel10k

**Starting Services:**

Via Portainer (production):

1. Open `https://<pi-ip>:9443`
2. Stacks → Add Stack → name: argos
3. Paste `docker-compose.portainer-dev.yml`
4. Deploy

Via CLI (development):

```bash
docker compose -f docker/docker-compose.portainer-dev.yml up -d
```

**Gotcha:** Dashboard terminal (port 3001, node-pty) runs on HOST, NOT Docker.

## OOM Protection Strategy

**Why?** RPi 5 with 8GB RAM running Docker, Kismet, HackRF can hit OOM under load.

**Protection Layers:**

1. **earlyoom**: Proactive OOM killer
    - Params: `-m 10 -s 50 -r 60`
    - Kill order: Prefers non-critical processes
    - Protect: ssh, docker, systemd, claude

2. **zram**: Compressed swap
    - Size: 4GB (zstd compression)
    - Priority: 100

3. **OOM Score Adjustments:**

    ```
    tailscaled:     -900 (never kill)
    earlyoom:       -800 (protect killer)
    ssh/docker:     -500 (protect remote/runtime)
    claude:         -500 (protect AI agent)
    ```

4. **Kernel Tuning:**

    ```
    vm.min_free_kbytes=65536  # Reserve 64MB
    vm.swappiness=60          # Balance RAM/swap
    vm.dirty_ratio=10         # Limit dirty pages
    ```

5. **Application Limits:**
    - Node.js: `--max-old-space-size=1024` (1GB heap)

**Gotcha:** Don't increase Node.js heap beyond 1024MB. Strategy calibrated for this limit.

## Environment Variables

**Required in `.env`:**

```bash
ARGOS_API_KEY=<openssl rand -hex 32>  # Min 32 chars
KISMET_API_URL=http://localhost:2501
DATABASE_PATH=./rf_signals.db
NODE_ENV=development

# Service passwords (no defaults)
KISMET_PASSWORD=
KISMET_REST_PASSWORD=
BETTERCAP_PASSWORD=
OPENWEBRX_PASSWORD=

# External APIs
OPENCELLID_API_KEY=
STADIA_MAPS_API_KEY=
```

**Validation:** System refuses to start without proper config. See [src/lib/server/env.ts](../src/lib/server/env.ts).

## Docker Gotchas

1. **Claude Config:**
    - Host: `~/.claude.json` (HOST ONLY)
    - Container: `~/.claude/mcp.json` (shared)

2. **Dashboard Terminal:**
    - Runs on HOST (port 3001)
    - SSH to Pi for terminal access

3. **Host Networking:**
    - `network_mode: host` required
    - No port mapping needed
