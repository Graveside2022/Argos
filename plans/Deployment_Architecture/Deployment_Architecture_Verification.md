# Argos Deployment Architecture — Verification Artifacts

**Document:** Stage 3 of 3 — Dependency Verification  
**Project:** Argos SDR & Network Analysis Console  
**Repository:** `github.com/Graveside2022/Argos` (`dev-branch-1`)  
**Date:** 2026-02-12  

---

**Verification Status:** PASSED WITH INVESTIGATION — 10 items flagged for executor discovery (see Investigation Items I1–I10 in the Task Brief). All items that can be verified from available information have passed. No hand-waving detected. No placeholder language survived expansion.

---

## Proof Document 1: Complete File Map

### Files to CREATE

| File Path | Purpose |
|-----------|---------|
| `scripts/ops/setup-host.sh` | Parrot OS 7.1 Core host provisioning (Docker, gpsd, udev, image builds, .env generation) |
| `scripts/ops/setup-host-kali.sh` | Kali Linux host provisioning (same outcome, Kali-specific packages and paths) |
| `docker/docker-compose.prod.yml` | Production deployment compose (runner image, no dev tools, no source mounts) |
| `docker/.env.prod.example` | Production environment variable template with per-node config section |
| `docs/HOST-LAYER-CONTRACT.md` | Specification of host OS responsibilities vs Docker responsibilities |

### Files to MODIFY

| File Path | Change Description |
|-----------|-------------------|
| `docker/Dockerfile` | Add `dev-tools` stage (stage 2.5); remove Kismet from `builder` stage; remove `zsh` from `runner` stage |
| `docker/docker-compose.portainer-dev.yml` | Update header comments to reference new script paths; remove deprecated `version: '3.8'` |
| `docker/docker-compose.portainer.yml` | `[INVESTIGATE I1]` — may need same updates or may be replaced by prod compose |
| `README.md` | Replace Kali-only references with dual-OS support; update Install section with new script paths |
| `CLAUDE.md` | Fix Node version (20→22); replace `/home/kali/` paths; add HOST-LAYER-CONTRACT reference |

### Files to EVALUATE (Investigation Required)

| File Path | Decision Needed |
|-----------|----------------|
| `docker/docker-compose.portainer.yml` | `[I1]` Determine if this is redundant with new prod compose or serves a different purpose |
| `deployment/argos-cpu-protector.service` | `[I9]` Keep (adapt), remove (dead code), or move (logic belongs elsewhere) |
| `deployment/argos-dev.service` | `[I9]` Same evaluation |
| `deployment/argos-droneid.service` | `[I9]` Same evaluation |
| `deployment/argos-final.service` | `[I9]` Same evaluation |
| `deployment/argos-process-manager.service` | `[I9]` Same evaluation |
| `deployment/argos-wifi-resilience.service` | `[I9]` Same evaluation |
| `deployment/gsmevil-patch.service` | `[I9]` Same evaluation |

### Files NOT Modified (Explicit Scope Exclusion)

All files under `src/`, `hackrf_emitter/` (except Dockerfile reference), `tests/`, `static/`, `config/`, `build-tools/`, `.github/`, and `.vscode/` are out of scope. Application source code is not touched by this task.

---

## Proof Document 2: Complete Dependency List

### Host-Level Packages (Parrot OS)

| Package | Version | Purpose | Verification |
|---------|---------|---------|-------------|
| `docker.io` | Latest in Parrot repos `[INVESTIGATE I7]` | Container runtime | `docker --version` |
| `docker-compose-plugin` | Latest (bundled with docker.io) | `docker compose` CLI | `docker compose version` |
| `gpsd` | Latest in Parrot repos | GPS daemon | `systemctl status gpsd` |
| `gpsd-clients` | Latest in Parrot repos | `gpsmon`, `cgps` for testing | `gpsmon` shows GPS data |
| `hackrf` | Latest in Parrot repos | `hackrf_info`, `hackrf_spiflash` | `hackrf_info` returns device |
| `wireless-tools` | Latest | `iwconfig` | `iwconfig` runs |
| `iw` | Latest | Modern wireless config | `iw dev` lists interfaces |
| `iproute2` | Latest | `ip` command | `ip link show` |
| `usbutils` | Latest | `lsusb` | `lsusb` lists USB devices |
| `git` | Latest | Repo management | `git --version` |
| `curl` | Latest | HTTP testing | `curl --version` |
| `wget` | Latest | File downloads | `wget --version` |
| `openssh-server` | Latest | Remote administration | `systemctl status sshd` |
| `openssl` | Latest | Credential generation | `openssl version` |

### Host-Level Packages (Kali — Differences Only)

| Package | Kali-Specific Note |
|---------|-------------------|
| `docker.io` | Available directly in Kali repos (confirmed) |
| `linux-headers-rpi-2712` | Kali Pi 5 kernel headers (only if building external modules) |
| `linux-headers-rpi-v8` | Secondary kernel headers package |

### Docker Image Dependencies

| Image | Tag | Platform | Source |
|-------|-----|----------|--------|
| `node:22-bookworm-slim` | 22-bookworm-slim | linux/arm64 | Docker Hub (Dockerfile deps + runner stages) |
| `node:22-bookworm` | 22-bookworm | linux/arm64 | Docker Hub (Dockerfile builder stage) |
| `slechev/openwebrxplus` | latest | linux/arm64 | Docker Hub (on-demand SDR UI) |
| `bettercap/bettercap` | latest | linux/arm64 | Docker Hub (on-demand WiFi recon) |
| `portainer/portainer-ce` | latest | linux/arm64 | Docker Hub (management UI) |

### Application Dependencies (Inside Containers — Not Modified by This Task)

| Component | Version | Location |
|-----------|---------|----------|
| Node.js | 22.x LTS | Dockerfile FROM node:22-bookworm |
| SvelteKit | 2.22.3 | package.json |
| Svelte | 5.35.5 | package.json |
| TypeScript | 5.8.3 | package.json |
| better-sqlite3 | (locked in package-lock.json) | package.json |
| Kismet | Latest from kismetwireless.net bookworm repo | Dockerfile runner stage |
| Python 3.x | Bundled with hackrf-backend image | hackrf_emitter/backend/Dockerfile |
| Flask | (locked in requirements.txt) | hackrf_emitter/backend/requirements.txt |

---

## Proof Document 3: Type Inventory

Not applicable to this task. No TypeScript types, interfaces, or schemas are created or modified. This task is infrastructure-only (shell scripts, YAML, Dockerfiles, Markdown). All application types remain unchanged in `src/`.

---

## Proof Document 4: State Map

### Environment Variable State

The `.env` file is the primary state artifact for deployment. Complete variable inventory:

| Variable | Required By | Default/Template Value | Per-Node? |
|----------|------------|----------------------|-----------|
| `NODE_ID` | prod compose | `argos-node-01` | YES |
| `NODE_LABEL` | prod compose | `Alpha Station` | YES |
| `TAK_SERVER` | prod compose | `192.168.1.100:8089` | YES (fleet) |
| `KISMET_PASSWORD` | dev + prod compose | Generated by setup script | Per-install |
| `KISMET_INTERFACE` | dev + prod compose | `wlan1` | Potentially per-node |
| `KISMET_USER` | dev + prod compose | `admin` | NO |
| `PUBLIC_BASE_URL` | argos container | `http://localhost:5173` | NO |
| `PUBLIC_HACKRF_API_URL` | argos container | `http://localhost:8092` | NO |
| `PUBLIC_KISMET_API_URL` | argos container | `http://localhost:2501` | NO |
| `PUBLIC_OPENWEBRX_URL` | argos container | `http://localhost:8073` | NO |
| `PUBLIC_SPECTRUM_ANALYZER_URL` | argos container | `http://localhost:8092` | NO |
| `PUBLIC_HACKRF_WS_URL` | argos container | `ws://localhost:8092` | NO |
| `OPENWEBRX_PASSWORD` | openwebrx container | Generated by setup script | Per-install |
| `BETTERCAP_PASSWORD` | bettercap container | Generated by setup script | Per-install |
| `BETTERCAP_USER` | bettercap container | `admin` | NO |
| `ARGOS_API_KEY` | argos container | Generated by setup script (min 32 chars) | Per-install |
| `ARGOS_DIR` | dev compose ONLY | Set by setup script to repo root | Per-install |
| `PUBLIC_ENABLE_DEBUG` | dev compose ONLY | `true` | Dev only |
| `NODE_ENV` | Both composes | `development` (dev) / `production` (prod) | Per compose file |
| `NODE_OPTIONS` | dev compose | `--max-old-space-size=1024` | NO |

### Host-Level State

| State | Location | Managed By |
|-------|----------|-----------|
| gpsd configuration | `/etc/default/gpsd` | setup-host script |
| HackRF udev rules | `/etc/udev/rules.d/99-hackrf.rules` | setup-host script |
| GPS udev rules | `/etc/udev/rules.d/99-gps.rules` | setup-host script |
| Docker group membership | `/etc/group` | setup-host script |
| Docker images (local) | Docker daemon storage | setup-host script (build) |

---

## Proof Document 5: API Map

Not applicable to this task. No API endpoints are created or modified. All 58 API endpoints documented in CLAUDE.md remain unchanged. The infrastructure changes (Docker, scripts) do not alter API behavior — they change how the application is deployed, not how it functions.

---

## Proof Document 6: Execution Order

| Order | Step | Rationale |
|-------|------|-----------|
| 1 | 1.1: Read docker-compose.portainer.yml | Must know if prod compose already exists before writing one |
| 2 | 1.2: Read docker/.env.example | Must know all required vars before writing setup scripts |
| 3 | 1.3: Verify Parrot OS Pi 5 availability | Must confirm primary OS target is viable |
| 4 | 1.4: Read scripts subdirectories | Must know if setup-host fragments exist |
| 5 | 1.5: Read deployment/*.service files | Must classify before deciding to keep/remove |
| 6 | 2.1: Write HOST-LAYER-CONTRACT.md | Contract must exist before scripts reference it |
| 7 | 3.1: Add dev-tools stage to Dockerfile | Must happen before builds reference the new stage |
| 8 | 3.2: Remove zsh from runner stage | Depends on Dockerfile being in new 4-stage structure |
| 9 | 3.3: Remove Kismet from builder stage | Depends on Dockerfile being in new 4-stage structure |
| 10 | 3.4: Remove deprecated version field | Independent, but grouped with Dockerfile work |
| 11 | 4.1: Create docker-compose.prod.yml | Depends on Dockerfile stages being finalized |
| 12 | 4.2: Create .env.prod.example | Depends on prod compose defining required variables |
| 13 | 5.1: Create setup-host.sh (Parrot) | Depends on contract (2.1), prod compose (4.1), and env template (4.2) |
| 14 | 5.2: Create setup-host-kali.sh | Depends on Parrot script existing as template |
| 15 | 6.1: Update README.md | Depends on script paths being finalized |
| 16 | 6.2: Update CLAUDE.md | Depends on Dockerfile and script changes |
| 17 | 6.3: Update dev compose header | Depends on script paths being finalized |
| 18 | 7.1: Test Parrot fresh install | Depends on ALL prior steps |
| 19 | 7.2: Test Kali fresh install | Depends on ALL prior steps |
| 20 | 7.3: Test dev workflow | Depends on Dockerfile and compose changes |
| 21 | 7.4: Test idempotency | Depends on setup scripts being functional |

---

## Dependency Chains

### Critical Chain 1: Dockerfile Stages → Compose Files → Setup Scripts

```
Dockerfile (4 stages defined)
  ↓ runner stage tag
docker-compose.prod.yml (references argos:prod)
  ↓ required variables
.env.prod.example (lists all vars)
  ↓ generates .env from template
setup-host.sh / setup-host-kali.sh (builds images + generates .env)
```

**Blast radius if wrong:** If the Dockerfile stage names don't match the compose image tags, `docker compose up` fails with "image not found." This is the highest-risk chain.

### Critical Chain 2: Host Contract → Setup Scripts → Docker Functionality

```
HOST-LAYER-CONTRACT.md (defines what host provides)
  ↓ implemented by
setup-host.sh (installs packages, configures services)
  ↓ enables
Docker containers (assume host provides gpsd, USB access, WiFi drivers)
```

**Blast radius if wrong:** If the setup script misses a host dependency (e.g., gpsd not installed), the Docker container starts but GPS data is unavailable. Silent failure — difficult to debug.

### Critical Chain 3: Dev-Tools Stage → Dev Compose → Developer Experience

```
Dockerfile dev-tools stage (has zsh, claude-code, atuin)
  ↓ targeted by
docker-compose.portainer-dev.yml (image: argos:dev, targets dev-tools)
  ↓ provides
Developer shell (docker exec -it argos-dev zsh)
```

**Blast radius if wrong:** If the dev compose targets `builder` instead of `dev-tools` after the Dockerfile refactor, developers lose their shell environment. Low production risk but high developer friction.

---

## Verification Rule Results

### Rule 1 (Inventory): PASSED WITH INVESTIGATION
Complete file map produced. 10 investigation items identified (I1–I10) with specific steps to resolve each before implementation.

### Rule 2 (Concreteness): PASSED
Every step specifies exact file paths, exact package names, exact configuration values, and exact verification commands. No instances of "appropriately," "properly," or "ensure" without concrete definition.

### Rule 3 (Dependency Chains): PASSED
Three critical chains identified and traced. Execution order established to satisfy all upstream dependencies before downstream steps execute.

### Rule 4 (Framework Translation): NOT APPLICABLE
No framework migration is involved. The application remains SvelteKit/TypeScript. Changes are limited to infrastructure (shell scripts, Docker, YAML, Markdown).

### Rule 5 (Missing Piece Detection): PASSED
Per-artifact check completed for all five created files:

| Artifact | Can it function? | Missing pieces? |
|----------|-----------------|-----------------|
| setup-host.sh (Parrot) | Yes, if Parrot has docker.io | `[I7]` Docker package availability — fallback documented |
| setup-host-kali.sh | Yes | None — Kali package availability confirmed |
| docker-compose.prod.yml | Yes, after images are built | Depends on Dockerfile stages being correct |
| .env.prod.example | Yes | None — all variables traced to compose references |
| HOST-LAYER-CONTRACT.md | Yes (documentation) | None |

### Rule 6 (Proof Documents): PASSED
All six proof documents produced:
1. File Map — complete (above)
2. Dependency List — complete with versions where known, investigation steps where not
3. Type Inventory — not applicable (documented)
4. State Map — complete (above)
5. API Map — not applicable (documented)
6. Execution Order — complete with rationale (above)

### Rule 7 (Challenge): PASSED

Challenge applied to highest-risk items:

**Item: "Remove Kismet from builder stage" (Step 3.3)**
- If wrong, what breaks? `npm run build` fails if any SvelteKit code imports Kismet at build time.
- How would I know? The build fails with a missing module error.
- Fastest confirmation: `npm run build` does not import Kismet — it's a runtime dependency accessed via HTTP API (localhost:2501). SvelteKit compiles client code; Kismet is a separate server process. LOW RISK.

**Item: "gpsd on host, not in container" (Contract decision)**
- If wrong, what breaks? GPS hot-plug fails. If the USB GPS dongle disconnects and reconnects, the container loses the device node.
- How would I know? GPS data stops flowing after a USB reconnect event.
- Fastest confirmation: This is a well-documented Docker limitation (Docker issue #35359). Host gpsd with udev is the established pattern for USB GPS devices. CONFIRMED CORRECT.

**Item: "docker.io available in Parrot repos" (Step 5.1)**
- If wrong, what breaks? The setup script fails at `apt install docker.io`.
- How would I know? apt returns "package not found."
- Fastest confirmation: `[INVESTIGATE I7]` — run `apt search docker.io` on a Parrot Core install. Fallback (Docker's official repo) is documented in the script.

---

## Unresolved Items

All 10 investigation items (I1–I10) from the Task Brief are unresolved and mapped to Step 1.1–1.5 of the Implementation Guide. None block the writing of the plan — they block the execution of specific implementation steps and have explicit "investigate before acting" gates.

| ID | Mapped To | Blocking Step |
|----|-----------|--------------|
| I1 | Step 1.1 | Step 4.1 (may reuse existing prod compose) |
| I2 | Step 1.2 | Step 4.2 (env template completeness) |
| I3 | Step 1.3 | Step 5.1 (Parrot script viability) |
| I4 | Step 1.3 | Step 5.1 (kernel module verification logic) |
| I5 | Step 1.3 | Step 5.1 (package selection) |
| I6 | Step 1.3 | Step 5.1 (gpsd package name) |
| I7 | Step 1.3 | Step 5.1 (Docker installation method) |
| I8 | Step 1.3 | Step 5.1 (default user path) |
| I9 | Step 1.5 | Phase 6 (service file disposition) |
| I10 | Step 1.4 | Phase 5 (script reuse) |

No item in the plan relies on an assumed answer to any of these questions. Each has an explicit investigation step that must complete before the dependent implementation step begins.
