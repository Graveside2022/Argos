# Argos Deployment Architecture — Task Brief

**Document:** Stage 1 of 3 — Diagnose and Translate  
**Project:** Argos SDR & Network Analysis Console  
**Repository:** `github.com/Graveside2022/Argos` (`dev-branch-1`)  
**Date:** 2026-02-12  

---

## CONTEXT

Argos is a cyberpunk-themed tactical communications console built on SvelteKit/TypeScript running on Raspberry Pi 5 (8GB). It provides real-time RF spectrum analysis, WiFi intelligence, GPS tracking, and tactical mapping through a browser-based UI served on port 5173. The system interfaces with three USB hardware peripherals via a powered USB 3.0 hub: HackRF One (SDR), Alfa AWUS036AXML (WiFi adapter, mt7921u driver), and a BU-353S4 USB GPS dongle.

The application is currently deployed on **Kali Linux 2025.4** using Docker containers managed through Portainer. The `dev-branch-1` is 65 commits ahead of `main` and includes a major Phase 3 code reorganization (ESLint cleanup, script restructuring, dead code removal) completed on 2026-02-12.

The Docker architecture consists of four services defined in `docker/docker-compose.portainer-dev.yml`:

| Service | Image | Port | Mode |
|---------|-------|------|------|
| argos | argos:dev (builder stage) | 5173 | Always on, privileged, host network |
| hackrf-backend | argos-hackrf-backend:dev | 8092 | Always on, privileged |
| openwebrx | slechev/openwebrxplus:latest | 8073 | On-demand (profile: tools) |
| bettercap | bettercap/bettercap:latest | 8081 | On-demand (profile: tools) |

The Argos container runs Kismet internally (port 2501) with `network_mode: host`, `pid: host`, and `privileged: true` to access WiFi interfaces and USB hardware. The hackrf-backend is a separate Python/Flask service controlling the HackRF One device. Both on-demand tools (OpenWebRX, Bettercap) are started from the Argos UI's Tools panel.

The owner intends to operate **10+ Argos nodes** connected to a TAK (Team Awareness Kit) server for tactical field deployment. Cross-platform compatibility (Windows, Ubuntu, Arch) for development is also desired.

---

## PROBLEM

The deployment infrastructure has five interrelated deficiencies that prevent the project from reaching production readiness:

**P1 — Missing Host Provisioning Script.** The `setup-host.sh` script referenced by the README, docker-compose, and ARGOS_DIR environment variable does not exist on `dev-branch-1`. It was lost during the Phase 3 script reorganization. No one can deploy Argos on a fresh Pi from the current repo.

**P2 — No Production Compose File.** The only functional compose file (`docker-compose.portainer-dev.yml`) runs Vite's development server with hot-reload, mounts source code from the host, and includes developer tools (Claude Code CLI, Oh My Zsh, Atuin). There is no compose file that runs the production build (`node build`) from a pre-built image.

**P3 — No Host-Level Hardware Configuration.** The Docker containers assume the host OS has gpsd running, USB devices properly permissioned, and the Alfa WiFi driver loaded — but nothing in the repo provisions these host-level dependencies. gpsd must run on the host (not in the container) for GPS hot-plug reliability.

**P4 — Kali Linux Hardcoded Throughout.** The README, CLAUDE.md, and various configs reference Kali-specific paths (`/home/kali/`), package names, and deployment assumptions. The owner has decided to migrate the primary deployment target to Parrot OS 7.1 Core (headless) based on its curated update model and greater stability for long-running appliances.

**P5 — No Multi-OS Support Path.** While Docker provides theoretical cross-platform support, there is no documented or scripted path for provisioning the host layer on any OS other than the (undocumented) Kali setup.

---

## REQUIREMENTS

1. A `setup-host.sh` script for **Parrot OS 7.1 Core** (headless, arm64) that provisions a fresh Pi 5 from zero to "run `docker compose up` and Argos works" — installing Docker, gpsd, udev rules, kernel module verification, image builds, and environment generation.

2. A `setup-host-kali.sh` script for **Kali Linux 2025.x** (arm64, Raspberry Pi 5) that accomplishes the same outcome on Kali, accounting for Kali-specific package names, paths, and the rolling release model.

3. A `docker-compose.prod.yml` file that runs Argos in production mode — using the runner stage image, `node build` entrypoint, no source code mounts, no dev tools, pre-built images pullable from a registry, and node-specific environment configuration via `.env`.

4. The existing `docker-compose.portainer-dev.yml` cleaned up to remove stale references to the missing `setup-host.sh` and to clearly document its role as the **development-only** compose file.

5. The Dockerfile cleaned up to remove developer comfort tools (Oh My Zsh, Powerlevel10k, Atuin, Claude Code, Nerd Fonts) from the build pipeline, either into a separate `dev` target or a compose override.

6. All Kali-specific hardcoded references in README.md and CLAUDE.md updated to be OS-agnostic or to reference both Parrot and Kali.

7. A documented host-layer contract: a clear specification of what the host OS must provide (services, drivers, udev rules, packages) for the Docker layer to function.

---

## CONSTRAINTS

- **Do not break the existing development workflow.** Developers currently using `docker-compose.portainer-dev.yml` with Portainer must continue to work after changes.
- **Do not modify application source code** (`src/`, `hackrf_emitter/`, `tests/`). This task is infrastructure-only.
- **Do not remove Portainer support.** It remains the primary UI for stack management.
- **Do not change the Docker network architecture.** `network_mode: host` and `privileged: true` are required for hardware access and will remain.
- **Preserve existing security model.** ARGOS_API_KEY enforcement, input sanitization, and rate limiting are not in scope for modification.
- **Both setup scripts must be idempotent.** Running them twice must not break anything.
- **All hardware passthrough (HackRF, Alfa, GPS) must function identically** on both Parrot and Kali after their respective setup scripts complete.

---

## SUCCESS CRITERIA

1. **Fresh Parrot Core Pi:** Flash Parrot OS 7.1 Core to SSD → boot → SSH in → `git clone` Argos → `sudo bash scripts/ops/setup-host.sh` → `cd docker && docker compose -f docker-compose.prod.yml up -d` → open `http://<pi-ip>:5173` → Argos console loads with GPS fix, WiFi scanning active, HackRF detected.

2. **Fresh Kali Pi:** Flash Kali 2025.x to SD → boot → SSH in → `git clone` Argos → `sudo bash scripts/ops/setup-host-kali.sh` → same Docker deployment → same Argos result.

3. **Development mode:** On either OS, `docker compose -f docker/docker-compose.portainer-dev.yml up -d` starts the dev stack with hot reload, Kismet, and all tools available.

4. **Fleet readiness:** Changing `NODE_ID` and `TAK_SERVER` in `.env` and running `docker compose pull && docker compose up -d` deploys a uniquely identified Argos node ready to connect to a TAK server.

---

## USER SUGGESTIONS

- The owner prefers Parrot Core headless as the primary target OS, with Kali as a secondary/legacy option.
- The owner has significant existing Docker/Portainer experience and wants to keep Docker as the deployment mechanism rather than switching to native-only or Ansible.
- The owner is open to using GitHub Container Registry (ghcr.io) for pre-built arm64 images.
- The owner wants the repo to be professionally organized so other users can deploy on their own hardware.

---

## INVESTIGATION ITEMS

The following must be verified by the executor before or during implementation:

| ID | Unknown | Where to Start |
|----|---------|---------------|
| I1 | Contents of `docker/docker-compose.portainer.yml` (prod variant?) | Read the file on dev-branch-1 |
| I2 | Contents of `docker/.env.example` — does it have all required vars? | Read the file on dev-branch-1 |
| I3 | Does Parrot Core 7.1 arm64 image exist for Pi 5? | Check parrotsec.org/download and community forums |
| I4 | Is mt7921u driver included in Parrot 7.1 kernel (6.17)? | Boot Parrot Core, plug in Alfa, run `dmesg \| grep mt7921` |
| I5 | Does `parrot-tools-full` metapackage include hackrf, gpsd, kismet? | Run `apt show parrot-tools-full` on a Parrot Core install |
| I6 | Exact gpsd package name on Parrot Core (gpsd vs gpsd-clients) | Run `apt search gpsd` on Parrot Core |
| I7 | Does `docker.io` package exist in Parrot repos or must Docker be installed from Docker's official repo? | Run `apt search docker.io` on Parrot Core |
| I8 | What user account does Parrot Core create by default? | Check during first boot (likely `parrot` or user-defined) |
| I9 | Do the `deployment/*.service` systemd files still match the Docker-based architecture? | Read each .service file, compare against current compose |
| I10 | What is in `scripts/build/`, `scripts/dev/`, `scripts/tmux/`? | Read each directory's contents on dev-branch-1 |

---

*Does this capture what you want? Anything I got wrong?*
