# Argos Deployment Architecture — Implementation Guide

**Document:** Stage 2 of 3 — Decompose  
**Project:** Argos SDR & Network Analysis Console  
**Repository:** `github.com/Graveside2022/Argos` (`dev-branch-1`)  
**Date:** 2026-02-12  

---

**Task Summary:** Create the complete host-provisioning and production-deployment infrastructure for Argos on both Parrot OS 7.1 Core and Kali Linux, including setup scripts, production Docker Compose, Dockerfile cleanup, and documentation updates.

**End State:** A fresh Raspberry Pi 5 running either Parrot Core or Kali can go from bare OS to fully operational Argos node by running a single setup script followed by `docker compose up`. The repo is professionally organized with clear separation between host layer, development Docker, and production Docker.

**Prerequisites:** Git access to `Graveside2022/Argos`, a Raspberry Pi 5 (8GB) with NVMe SSD or SD card, USB 3.0 powered hub, HackRF One, Alfa AWUS036AXML, GPS dongle (BU-353S4). Parrot OS 7.1 Core arm64 image or Kali 2025.x arm64 image.

**Assumptions:** All assumptions are stated explicitly in this document. Items marked `[INVESTIGATE]` require executor verification before the dependent step executes.

---

## Phase 1: Investigation and Discovery

*Purpose: Verify the current state of artifacts on dev-branch-1 that affect implementation decisions. Every unknown from the Task Brief must be resolved before writing any code.*

### Step 1.1: Read `docker/docker-compose.portainer.yml`

Read the production-variant compose file on dev-branch-1. Determine whether it already runs the `runner` stage with `node build`, or whether it is a copy of the dev file. Record:
- What image tag does it use?
- What command does it run?
- Does it mount source code?
- Does it include dev tools?

*Why:* If a usable production compose already exists, Phase 4 adapts it rather than writing from scratch. If it is a dev copy, Phase 4 writes a new file.  
*Verify:* The executor can state definitively whether `docker-compose.portainer.yml` is a production file, a dev file, or something else.

### Step 1.2: Read `docker/.env.example`

Read the file and record every variable defined. Cross-reference against `docker-compose.portainer-dev.yml` to identify:
- Variables referenced in compose but missing from .env.example
- Variables in .env.example but not used anywhere

*Why:* The setup scripts must generate a complete `.env` file. Missing variables will cause `docker compose up` to fail with `?:error` syntax.  
*Verify:* A complete list of required environment variables exists, with no gaps.

### Step 1.3: Verify Parrot OS 7.1 Core arm64 Availability for Pi 5

Check `parrotsec.org/download` for a Parrot Core arm64 image compatible with Raspberry Pi 5. If no official Pi 5 image exists, determine the alternative (generic arm64 ISO, community image, or manual debootstrap).

*Why:* The entire Parrot migration depends on a bootable image existing. If none exists, the Parrot setup script must document the alternative installation path.  
*Verify:* A specific download URL or installation method for Parrot Core on Pi 5 is identified and documented.

### Step 1.4: Read Contents of `scripts/build/`, `scripts/dev/`, `scripts/tmux/`

Read every file in these three directories. Record:
- File names and purposes
- Any references to `setup-host.sh` or host provisioning
- Any hardware configuration logic that should be preserved

*Why:* The Phase 3 reorganization may have moved setup-host.sh logic into one of these subdirectories rather than deleting it. If fragments exist, they inform the new script.  
*Verify:* The executor knows exactly what scripts exist and whether any contain host provisioning logic.

### Step 1.5: Read Each `deployment/*.service` File

Read all seven systemd service files. For each, record:
- What binary/command it runs
- What paths it references
- Whether it is compatible with the Docker-based architecture

*Why:* These files may be dead code from pre-Docker deployment, or they may contain logic (CPU protection, WiFi resilience) that should be preserved in the Docker or host layer.  
*Verify:* Each service file is classified as: KEEP (adapt for new architecture), REMOVE (dead code), or MOVE (logic belongs elsewhere).

---

## Phase 2: Host-Layer Contract Definition

*Purpose: Define the exact boundary between what the host OS provides and what Docker provides. This contract is the single source of truth for both setup scripts and both compose files.*

### Step 2.1: Write the Host-Layer Contract Document

Create `docs/HOST-LAYER-CONTRACT.md` containing:

**Host Must Provide:**

| Component | Service/Package | Port/Path | Purpose |
|-----------|----------------|-----------|---------|
| Docker Engine | `docker.io` or `docker-ce` | `/var/run/docker.sock` | Container runtime |
| Docker Compose | `docker-compose-plugin` | CLI | Stack orchestration |
| gpsd | `gpsd` systemd service | `:2947`, `/run/gpsd.sock` | GPS daemon with udev hot-plug |
| USB serial driver | `cp210x` or `pl2303` kernel module | `/dev/ttyUSB0` | GPS dongle communication |
| WiFi driver | `mt7921u` kernel module | `wlan1` (or dynamic) | Alfa AWUS036AXML |
| HackRF permissions | udev rule (idVendor=1d50, idProduct=6089) | `/dev/bus/usb` | Non-root USB access |
| HackRF tools | `hackrf` package | CLI | Firmware flash, diagnostics only |
| SSH server | `openssh-server` | `:22` | Remote administration |
| Git | `git` | CLI | Repo clone and updates |

**Host Must NOT Provide (Docker Handles These):**

| Component | Reason |
|-----------|--------|
| Node.js | Inside argos container |
| Kismet | Inside argos container |
| Python/Flask | Inside hackrf-backend container |
| OpenWebRX | Separate container, on-demand |
| Bettercap | Separate container, on-demand |
| Portainer | Separate container |

**Interface Points (Host ↔ Docker):**

| Interface | Direction | Mechanism |
|-----------|-----------|-----------|
| GPS data | Host gpsd → Container | `localhost:2947` via host networking |
| USB devices | Host kernel → Container | `/dev/bus/usb` device mount + privileged mode |
| WiFi interfaces | Host kernel → Container | Host network namespace (network_mode: host) |
| Process visibility | Host → Container | Host PID namespace (pid: host) |
| Docker API | Host → Container | `/var/run/docker.sock` mount |

*Why:* Both setup scripts and both compose files reference this contract. Changes to the contract propagate to all four files.  
*Verify:* The contract document exists and every item in it traces to a specific line in a setup script or compose file.

---

## Phase 3: Dockerfile Cleanup

*Purpose: Separate developer comfort tools from the application build pipeline so the production image is lean and the dev image remains fully featured.*

### Step 3.1: Add a `dev-tools` Stage to the Dockerfile

Insert a new stage between `builder` and `runner` in `docker/Dockerfile`:

```
FROM builder AS dev-tools
```

Move the following RUN blocks from the current `builder` stage into `dev-tools`:
- Oh My Zsh installation (lines 53-57)
- Powerlevel10k and plugins (same RUN block)
- Nerd Font downloads (lines 60-66)
- Atuin installation (line 69)
- Claude Code CLI installation (line 72)
- ZSH configuration copies (lines 75-76)
- ZSH default shell change (line 79)
- ZSH glob fix (lines 82-83)

*Why:* The `builder` stage should only contain what is needed to build the SvelteKit application. Dev tools bloat build cache by ~150MB and have no place in production.  
*Verify:* `docker build --target builder .` succeeds without dev tools present. `docker build --target dev-tools .` succeeds with all dev tools present.

### Step 3.2: Remove `zsh` from the `runner` Stage

In the runner stage's `apt-get install` block (line ~100), remove `zsh`. The production container runs `node build` — it has no interactive shell sessions.

*Why:* Reduces runner image size by ~15MB and attack surface.  
*Verify:* `docker build --target runner .` succeeds. `docker run argos:prod node build` starts without errors.

### Step 3.3: Remove Kismet from the `builder` Stage

The builder stage installs Kismet (lines 31-51) only to write `kismet_site.conf`. Move the `echo "gps=gpsd:host=localhost,port=2947" > /etc/kismet/kismet_site.conf` into the runner stage's Kismet install block (it is already there — line ~113). Remove the entire Kismet apt-get block from the builder stage.

*Why:* Kismet in the builder stage adds ~200MB to build cache for no functional purpose. The builder stage compiles the SvelteKit app — it does not run Kismet.  
*Verify:* `docker build --target builder .` succeeds and is ~200MB smaller. `npm run build` inside the builder stage completes without Kismet present.

### Step 3.4: Remove the Deprecated `version: '3.8'` from Compose Files

Remove the `version: '3.8'` line from both `docker-compose.portainer-dev.yml` and `docker-compose.portainer.yml`. Docker Compose V2 ignores this field and it generates deprecation warnings.

*Why:* Clean professional output. No functional impact.  
*Verify:* `docker compose config` parses both files without warnings.

---

## Phase 4: Production Compose File

*Purpose: Create a compose file that runs Argos in production mode from pre-built images, suitable for fleet deployment.*

### Step 4.1: Create `docker/docker-compose.prod.yml`

Create a new file with the following services:

**argos:**
- `image: ghcr.io/graveside2022/argos:latest` (or `argos:prod` for local builds)
- `container_name: argos`
- `network_mode: host`
- `pid: host`
- `privileged: true`
- `restart: unless-stopped`
- `devices: ["/dev/bus/usb:/dev/bus/usb"]`
- `environment:` — all PUBLIC_* env vars, KISMET_*, NODE_ENV=production, TAK_SERVER, NODE_ID (from .env)
- `volumes:` — `argos-data:/app/data` (persistent data only, NO source code mount)
- `command: ["node", "build"]`
- Memory limits: `mem_limit: 1536m`, `memswap_limit: 2048m`
- Health check: `curl -f http://localhost:5173/health`
- Logging: json-file, 100m max, 3 files

**hackrf-backend:**
- `image: ghcr.io/graveside2022/argos-hackrf-backend:latest` (or local tag)
- `container_name: hackrf-backend`
- `privileged: true`
- `ports: ["8092:8092"]`
- `devices: ["/dev/bus/usb:/dev/bus/usb"]`
- `environment:` — PYTHONUNBUFFERED=1
- `command: ["python", "-m", "flask", "run", "--host=0.0.0.0", "--port=8092"]`
- `mem_limit: 256m`
- `restart: unless-stopped`

**openwebrx:** (identical to dev, with `profiles: ["tools"]`)

**bettercap:** (identical to dev, with `profiles: ["tools"]`)

**portainer:** (NEW — not in dev compose)
- `image: portainer/portainer-ce:latest`
- `container_name: portainer`
- `ports: ["9443:9443"]`
- `volumes: ["/var/run/docker.sock:/var/run/docker.sock", "portainer-data:/data"]`
- `restart: unless-stopped`

**Volumes:** `argos-data`, `portainer-data`, `openwebrx-hackrf-settings`

**Key differences from dev compose:**
- No source code mount (`${ARGOS_DIR}:/app:rw` removed)
- No `argos-node-modules` or `argos-svelte-kit` volumes
- No Docker socket mount in argos container (security — only Portainer needs it)
- No `dev-sync.sh` command
- No Claude Code config mount
- No Atuin data volume
- Uses runner image, not builder image
- NODE_ENV=production
- Includes Portainer as a managed service

*Why:* Fleet nodes run pre-built images. They never mount source code or run dev servers.  
*Verify:* `docker compose -f docker/docker-compose.prod.yml config` validates without errors. On a Pi with built images, `docker compose -f docker/docker-compose.prod.yml up -d` starts all services and Argos UI loads.

### Step 4.2: Create `docker/.env.prod.example`

Create a production environment template with these variables:

```env
# === Node Identity (CHANGE PER NODE) ===
NODE_ID=argos-node-01
NODE_LABEL=Alpha Station

# === TAK Server Connection ===
TAK_SERVER=192.168.1.100:8089
# TAK_CERT_PATH=/app/certs/tak-client.pem

# === Kismet ===
KISMET_PASSWORD=GENERATE_WITH_openssl_rand_-hex_16
KISMET_INTERFACE=wlan1
KISMET_USER=admin

# === Service URLs (usually unchanged) ===
PUBLIC_BASE_URL=http://localhost:5173
PUBLIC_HACKRF_API_URL=http://localhost:8092
PUBLIC_KISMET_API_URL=http://localhost:2501
PUBLIC_OPENWEBRX_URL=http://localhost:8073
PUBLIC_SPECTRUM_ANALYZER_URL=http://localhost:8092
PUBLIC_HACKRF_WS_URL=ws://localhost:8092

# === On-Demand Tool Passwords ===
OPENWEBRX_PASSWORD=GENERATE_WITH_openssl_rand_-hex_16
BETTERCAP_PASSWORD=GENERATE_WITH_openssl_rand_-hex_16

# === Security ===
ARGOS_API_KEY=GENERATE_WITH_openssl_rand_-hex_32
```

*Why:* Production deployments need a template that clearly separates per-node config from shared defaults.  
*Verify:* Every variable referenced in `docker-compose.prod.yml` has a corresponding entry in `.env.prod.example`.

---

## Phase 5: Setup Scripts

*Purpose: Write idempotent host provisioning scripts for both target operating systems.*

### Step 5.1: Create `scripts/ops/setup-host.sh` (Parrot OS 7.1 Core)

The script must:

1. **Detect OS and abort if not Parrot:**
   ```bash
   if ! grep -qi 'parrot' /etc/os-release; then
     echo "ERROR: This script is for Parrot OS. For Kali, use setup-host-kali.sh"
     exit 1
   fi
   ```

2. **Install system packages:**
   ```bash
   sudo apt update && sudo apt install -y \
     docker.io docker-compose-plugin \
     gpsd gpsd-clients \
     hackrf \
     wireless-tools iw iproute2 usbutils \
     git curl wget openssh-server
   ```
   `[INVESTIGATE I7]` Verify `docker.io` exists in Parrot repos. If not, install from Docker's official apt repository using their convenience script.

3. **Add current user to docker group:**
   ```bash
   sudo usermod -aG docker "$USER"
   ```

4. **Configure gpsd:**
   ```bash
   sudo tee /etc/default/gpsd > /dev/null <<'EOF'
   START_DAEMON="true"
   GPSD_OPTIONS="-n"
   DEVICES="/dev/ttyUSB0"
   USBAUTO="true"
   GPSD_SOCKET="/var/run/gpsd.sock"
   EOF
   sudo systemctl enable gpsd
   sudo systemctl restart gpsd
   ```

5. **Create udev rules:**
   ```bash
   # HackRF One — allow non-root access
   sudo tee /etc/udev/rules.d/99-hackrf.rules > /dev/null <<'EOF'
   ATTR{idVendor}=="1d50", ATTR{idProduct}=="6089", MODE="0666", GROUP="plugdev"
   ATTR{idVendor}=="1d50", ATTR{idProduct}=="604b", MODE="0666", GROUP="plugdev"
   EOF

   # GPS dongle — persistent symlink
   sudo tee /etc/udev/rules.d/99-gps.rules > /dev/null <<'EOF'
   SUBSYSTEM=="tty", ATTRS{idVendor}=="067b", ATTRS{idProduct}=="2303", SYMLINK+="gps0", MODE="0666"
   EOF

   sudo udevadm control --reload-rules
   sudo udevadm trigger
   ```

6. **Verify kernel modules:**
   ```bash
   echo "--- Checking kernel modules ---"
   modinfo mt7921u > /dev/null 2>&1 && echo "✓ mt7921u (Alfa WiFi) available" || echo "✗ mt7921u NOT found — Alfa adapter may not work"
   modinfo cp210x > /dev/null 2>&1 && echo "✓ cp210x (USB serial) available" || echo "  cp210x not found (may use pl2303 instead)"
   modinfo pl2303 > /dev/null 2>&1 && echo "✓ pl2303 (USB serial) available" || echo "  pl2303 not found"
   ```

7. **Build Docker images:**
   ```bash
   ARGOS_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
   echo "Building Argos images from: $ARGOS_DIR"

   docker build -t argos:dev -f "$ARGOS_DIR/docker/Dockerfile" --target dev-tools "$ARGOS_DIR"
   docker build -t argos:prod -f "$ARGOS_DIR/docker/Dockerfile" --target runner "$ARGOS_DIR"
   docker build -t argos-hackrf-backend:dev \
     -f "$ARGOS_DIR/hackrf_emitter/backend/Dockerfile" \
     "$ARGOS_DIR/hackrf_emitter/backend/"
   ```

8. **Generate .env from template:**
   ```bash
   if [ ! -f "$ARGOS_DIR/docker/.env" ]; then
     cp "$ARGOS_DIR/docker/.env.prod.example" "$ARGOS_DIR/docker/.env"
     sed -i "s|KISMET_PASSWORD=.*|KISMET_PASSWORD=$(openssl rand -hex 16)|" "$ARGOS_DIR/docker/.env"
     sed -i "s|OPENWEBRX_PASSWORD=.*|OPENWEBRX_PASSWORD=$(openssl rand -hex 16)|" "$ARGOS_DIR/docker/.env"
     sed -i "s|BETTERCAP_PASSWORD=.*|BETTERCAP_PASSWORD=$(openssl rand -hex 16)|" "$ARGOS_DIR/docker/.env"
     sed -i "s|ARGOS_API_KEY=.*|ARGOS_API_KEY=$(openssl rand -hex 32)|" "$ARGOS_DIR/docker/.env"
     echo "✓ Generated docker/.env with random credentials"
   else
     echo "→ docker/.env already exists, skipping generation"
   fi
   ```

9. **Print summary:**
   ```
   ═══════════════════════════════════════════
    Argos Host Setup Complete (Parrot OS)
   ═══════════════════════════════════════════
    Docker:    $(docker --version)
    gpsd:      $(gpsd --version 2>&1 | head -1)
    HackRF:    $(hackrf_info 2>&1 | head -1 || echo "not connected")
    WiFi:      $(iw dev 2>/dev/null | grep Interface || echo "no wireless interfaces")

    Next steps:
    1. Log out and back in (for docker group)
    2. cd docker
    3. docker compose -f docker-compose.prod.yml up -d
    4. Open http://$(hostname -I | awk '{print $1}'):5173
   ═══════════════════════════════════════════
   ```

*Why:* This is the primary deployment path. Every Parrot Core Pi runs this once.  
*Verify:* On a fresh Parrot Core Pi 5: run the script, log out/in, `docker compose -f docker/docker-compose.prod.yml up -d`, open Argos in browser.

### Step 5.2: Create `scripts/ops/setup-host-kali.sh` (Kali Linux)

Identical structure to Step 5.1 with these Kali-specific differences:

1. **OS detection:** Check for `kali` in `/etc/os-release`.

2. **Package installation:** Kali uses `docker.io` from Debian repos (confirmed available). Add `kali-linux-headless` metapackage consideration or `kali-tools-wireless` if the user wants Kali's wireless tools on the host.

3. **Docker installation:** On Kali, `docker.io` is available directly:
   ```bash
   sudo apt update && sudo apt install -y docker.io docker-compose-plugin
   ```

4. **Kernel headers note:** Kali on Pi 5 uses custom kernel headers:
   ```bash
   # Kali Pi 5 kernel headers (if needed for external modules)
   sudo apt install -y linux-headers-rpi-2712 linux-headers-rpi-v8
   ```

5. **Default user path:** Kali's default user is `kali` with home at `/home/kali/`.

6. **Nexmon note:** The script should print a warning that Kali Pi 5 does not support Nexmon for the onboard WiFi — external adapter (Alfa) is required for wireless testing.

All other steps (gpsd, udev rules, Docker image builds, .env generation) are identical to the Parrot script.

*Why:* Kali remains a supported deployment target for users who prefer it.  
*Verify:* On a fresh Kali Pi 5: run the script, log out/in, `docker compose -f docker/docker-compose.prod.yml up -d`, open Argos in browser.

---

## Phase 6: Documentation Updates

*Purpose: Update all references from Kali-specific to OS-agnostic, and document the new architecture.*

### Step 6.1: Update `README.md`

Replace the Hardware section's "Kali Linux installed on the Pi" with:

```markdown
## Supported Operating Systems
* **Parrot OS 7.1 Core** (recommended) — headless, curated updates, arm64
* **Kali Linux 2025.x** — full desktop or headless, arm64
* Any Debian-based Linux with Docker support (manual setup)
```

Update the Install section:

```markdown
## Install

### Parrot OS (Recommended)
```bash
git clone https://github.com/Graveside2022/Argos.git
cd Argos
sudo bash scripts/ops/setup-host.sh
```

### Kali Linux
```bash
git clone https://github.com/Graveside2022/Argos.git
cd Argos
sudo bash scripts/ops/setup-host-kali.sh
```
```

*Why:* The README is the first thing users see. It must reflect the current architecture.  
*Verify:* README contains no references to "Kali Linux" as the sole supported OS.

### Step 6.2: Update `CLAUDE.md`

- Change "Deployed on: Raspberry Pi 5, Kali Linux 2025.4" to "Deployed on: Raspberry Pi 5, Parrot OS 7.1 Core or Kali Linux 2025.x"
- Change `pwd # Should be: /home/kali/Documents/Argos/Argos` to a generic path or detect dynamically
- Change `node --version # Must be 20.x` to `node --version # Must be 22.x` (matching Dockerfile)
- Add reference to `docs/HOST-LAYER-CONTRACT.md`

*Why:* CLAUDE.md guides AI coding assistants. Incorrect paths and versions cause cascading errors in AI-generated code.  
*Verify:* No Kali-specific hardcoded paths remain. Node version matches Dockerfile.

### Step 6.3: Update `docker-compose.portainer-dev.yml` Header Comments

Replace:
```yaml
# PREREQUISITE: Run setup-host.sh first — it builds images and generates docker/.env
```

With:
```yaml
# PREREQUISITE: Run scripts/ops/setup-host.sh (Parrot) or scripts/ops/setup-host-kali.sh (Kali)
# This builds images and generates docker/.env
```

Also update the manual build comment to reference the correct script paths.

*Why:* The old reference to the nonexistent `setup-host.sh` confuses users.  
*Verify:* No references to a bare `setup-host.sh` remain in any compose file.

---

## Phase 7: Verification and Testing

*Purpose: Confirm the complete system works end-to-end on both target OSes.*

### Step 7.1: Test Parrot Core Fresh Install

On a Pi 5 with fresh Parrot OS 7.1 Core:
1. Clone the repo
2. Run `scripts/ops/setup-host.sh`
3. Log out, log back in
4. Run `docker compose -f docker/docker-compose.prod.yml up -d`
5. Verify: Argos UI loads at `:5173`
6. Verify: GPS data appears (if outdoors)
7. Verify: Kismet detects Alfa adapter and shows WiFi networks
8. Verify: `hackrf_info` from host returns device info
9. Verify: HackRF spectrum view works in Argos UI

*Why:* End-to-end validation on the primary target OS.  
*Verify:* All nine checks pass.

### Step 7.2: Test Kali Fresh Install

Same steps as 7.1 but using `setup-host-kali.sh` on Kali 2025.x.

*Why:* Validates the secondary OS path.  
*Verify:* All nine checks pass.

### Step 7.3: Test Development Workflow

On either OS, after running the appropriate setup script:
1. Run `docker compose -f docker/docker-compose.portainer-dev.yml up -d`
2. Verify: Vite dev server starts with hot reload
3. Edit a `.svelte` file — verify hot reload updates the browser
4. Verify: `docker exec -it argos-dev zsh` gives a working ZSH shell with Powerlevel10k

*Why:* Confirms the dev workflow was not broken by Dockerfile changes.  
*Verify:* All four checks pass.

### Step 7.4: Test Idempotency

Run the setup script a second time. Verify:
- No errors
- No duplicate udev rules
- No duplicate Docker images
- gpsd still running
- `.env` not overwritten

*Why:* Setup scripts must be safe to run multiple times.  
*Verify:* Second run completes with "already exists" messages, no errors.

---

## Completion Criteria

1. ☐ `scripts/ops/setup-host.sh` exists and provisions Parrot Core Pi 5 from zero to Argos-ready
2. ☐ `scripts/ops/setup-host-kali.sh` exists and provisions Kali Pi 5 from zero to Argos-ready
3. ☐ `docker/docker-compose.prod.yml` exists and runs Argos in production mode
4. ☐ `docker/.env.prod.example` exists with all required variables documented
5. ☐ `docs/HOST-LAYER-CONTRACT.md` exists and defines the host/Docker boundary
6. ☐ Dockerfile has 4 stages: deps → builder → dev-tools → runner
7. ☐ Runner stage does not contain zsh, Oh My Zsh, or any dev tools
8. ☐ Builder stage does not contain Kismet
9. ☐ README.md references both Parrot and Kali with correct script paths
10. ☐ CLAUDE.md references Node 22.x and OS-agnostic paths
11. ☐ No compose file references the nonexistent bare `setup-host.sh`
12. ☐ Fresh Parrot Core install passes end-to-end test (Step 7.1)
13. ☐ Fresh Kali install passes end-to-end test (Step 7.2)
14. ☐ Dev workflow passes test (Step 7.3)
15. ☐ Both setup scripts pass idempotency test (Step 7.4)

---

## Risks and Watchpoints

| # | Risk | Impact | Recovery |
|---|------|--------|----------|
| R1 | Parrot OS 7.1 has no official Pi 5 arm64 image | Cannot use Parrot at all | Use generic arm64 installer or fall back to Kali as primary |
| R2 | `docker.io` not in Parrot repos | Setup script fails at package install | Add Docker's official apt repo in the script (documented fallback) |
| R3 | Kismet removal from builder stage breaks `npm run build` | Build fails | Kismet has no build-time dependency — risk is LOW. If it fails, add back only the specific library needed |
| R4 | Dev-tools stage inherits from builder, which no longer has Kismet | Dev container missing Kismet | Dev-tools stage must install Kismet OR the dev compose must target the runner stage for the Kismet layer |
| R5 | HackRF USB passthrough fails after container restart | HackRF unavailable until manual intervention | `restart: unless-stopped` policy + document manual `docker restart argos` procedure |

---

## Traceability

| Requirement | Satisfied By |
|-------------|-------------|
| R1: Parrot setup script | Steps 5.1, 7.1, 7.4 |
| R2: Kali setup script | Steps 5.2, 7.2, 7.4 |
| R3: Production compose | Steps 4.1, 4.2, 7.1 |
| R4: Dev compose cleanup | Steps 6.3, 7.3 |
| R5: Dockerfile cleanup | Steps 3.1, 3.2, 3.3, 3.4 |
| R6: Documentation updates | Steps 6.1, 6.2 |
| R7: Host-layer contract | Step 2.1 |
