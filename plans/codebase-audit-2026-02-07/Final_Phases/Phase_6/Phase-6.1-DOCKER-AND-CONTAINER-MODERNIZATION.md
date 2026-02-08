# Phase 6.1: Docker and Container Modernization

**Document ID**: ARGOS-AUDIT-P6.1
**Version**: 1.0 (Final)
**Date**: 2026-02-08
**Author**: Claude Opus 4.6 (Lead Audit Agent)
**Classification**: UNCLASSIFIED // FOR OFFICIAL USE ONLY
**Risk Level**: HIGH -- Changes affect container runtime security boundaries and build pipeline
**Review Standard**: CIS Docker Benchmark v1.6, DISA STIG Docker Enterprise V2R1, NIST SP 800-190

---

## 1. Purpose

This document provides the complete, executable plan for modernizing the Docker infrastructure of the Argos SDR & Network Analysis Console. Every finding below was verified against the live system on 2026-02-08 at HEAD commit `f300b8f` on branch `main`. The target host is `scarmatrix-kali` (RPi 5 Model B Rev 1.0, Kali 2025.4, aarch64, 8GB RAM, Docker 27.5.1, Compose 2.32.4-3).

This phase addresses 27 discrete findings across security, performance, and operational categories in 10 tasks containing 41 subtasks.

---

## 2. Prerequisites

| Prerequisite                        | Verification Command                                                                     | Expected Output                                        |
| ----------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Docker Engine 27.x                  | `docker --version`                                                                       | Docker version 27.5.1 or later                         |
| Docker Compose v2                   | `docker compose version`                                                                 | Docker Compose version 2.32.4-3 or later               |
| Root or docker-group access         | `docker ps`                                                                              | Lists running containers without error                 |
| Git working tree clean (or stashed) | `git status --porcelain \| wc -l`                                                        | 0 (or known untracked-only count)                      |
| All 4 containers running            | `docker ps --format '{{.Names}}' \| sort`                                                | argos-dev, argos-ollama, hackrf-backend-dev, portainer |
| Backup of docker/.env               | `cp docker/.env docker/.env.bak`                                                         | File exists                                            |
| Backup of compose files             | `cp docker/docker-compose.portainer-dev.yml docker/docker-compose.portainer-dev.yml.bak` | File exists                                            |

---

## 3. Audit Corrections

The following corrections apply to claims made in earlier Phase 6 overview documents and agent memory:

| Original Claim                                                                                              | Correction                                                                                                                                                                                                                                                                                                                                                            | Evidence                                                                                       |
| ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| "Ollama deploy.resources.limits.memory SILENTLY IGNORED by docker compose (needs Swarm or --compatibility)" | **FALSE**. Docker Compose v2.32.4 correctly translates `deploy.resources.limits.memory` to the `Memory` cgroup. Ollama container shows 2,147,483,648 bytes (2 GB) limit at runtime.                                                                                                                                                                                   | `docker inspect argos-ollama --format '{{json .HostConfig.Memory}}'` returns `2147483648`      |
| "COPY . . copies 1.17 GB source tree into builder"                                                          | Partially correct. The .dockerignore excludes node_modules/, .git/, build/, tests/, _.md, and .env. However, it does NOT exclude `hackrf_emitter/backend/.venv/` (270 MB), `static/fonts/` (46 MB), `archive/` (752 KB), `plans/` (2.8 MB), `core._`(20 MB), or`rf_signals.db` (7.3 MB). Actual context sent to daemon after .dockerignore: approximately 350-400 MB. | `du -sh` on each excluded/included path                                                        |
| "hackrf-backend uses privileged:true when only USB access needed"                                           | Correct as stated. The hackrf-backend Dockerfile creates a non-root user (L20-21) and sets `USER hackrf` (L41), but the compose override runs it `privileged: true`, negating the non-root user's restrictions.                                                                                                                                                       | `docker/docker-compose.portainer-dev.yml` L96, `hackrf_emitter/backend/Dockerfile` L20-21, L41 |
| "8 ports exposed to all network interfaces"                                                                 | Correct. argos runs in host network mode (all ports on 0.0.0.0). hackrf-backend exposes 8092 on 0.0.0.0. portainer exposes 9000 and 9443 on 0.0.0.0. ollama exposes 11434 on 0.0.0.0. openwebrx (when active) exposes 8073 on 0.0.0.0. bettercap (when active) uses host network.                                                                                     | `docker inspect` `PortBindings` for each container                                             |

---

## 4. Rollback Strategy

Every task in this plan modifies configuration files only. No application source code is changed. Rollback procedure:

```bash
# Step 1: Restore backed-up files
cp docker/docker-compose.portainer-dev.yml.bak docker/docker-compose.portainer-dev.yml
cp docker/docker-compose.portainer.yml.bak docker/docker-compose.portainer.yml
cp docker/docker-compose.ollama.yml.bak docker/docker-compose.ollama.yml
cp docker/Dockerfile.bak docker/Dockerfile
cp config/.dockerignore.bak config/.dockerignore
cp docker/.env.bak docker/.env

# Step 2: Rebuild images from restored Dockerfile
docker build -t argos:dev -f docker/Dockerfile --target builder .

# Step 3: Recreate containers
docker compose -f docker/docker-compose.portainer-dev.yml up -d
docker compose -f docker/docker-compose.portainer.yml up -d
docker compose -f docker/docker-compose.ollama.yml up -d

# Step 4: Verify all containers healthy
docker ps --format 'table {{.Names}}\t{{.Status}}'
```

Before beginning any task, create backups:

```bash
for f in docker/Dockerfile docker/docker-compose.portainer-dev.yml docker/docker-compose.portainer.yml docker/docker-compose.ollama.yml config/.dockerignore docker/.env; do
  cp "$f" "${f}.bak"
done
```

---

## 5. Estimated Scope

| Metric                            | Value                                                                                                               |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Files modified                    | 7                                                                                                                   |
| Files deleted                     | 1                                                                                                                   |
| Files created                     | 2                                                                                                                   |
| Total tasks                       | 10                                                                                                                  |
| Total subtasks                    | 41                                                                                                                  |
| Estimated image size reduction    | ~2.5 GB (argos:dev from 4 GB to ~1.5 GB)                                                                            |
| Estimated disk reclamation        | ~24 GB (build cache + dangling images + orphaned volumes) -- projected; verify with `docker system df` before/after |
| Estimated build context reduction | ~340 MB (from ~400 MB to ~60 MB)                                                                                    |

---

## Task 6.1.1: Dockerfile Multi-Stage Build Optimization

**Objective**: Eliminate developer tooling (ZSH, Oh My Zsh, Powerlevel10k, Atuin, Nerd Fonts, Claude Code CLI) from the image layers used at runtime. These tools are baked into the builder stage (Lines 54-81, 828 MB apt layer) but serve no runtime purpose -- they exist only for interactive shell sessions. Restructure the build to use a dedicated `devtools` stage that is layered on top, reducing the builder image from 4 GB to approximately 1.5 GB.

**Risk**: MEDIUM -- Changes container shell experience. Interactive `docker exec -it argos-dev zsh` will only work if compose targets the devtools stage.

### Subtask 6.1.1.1: Split Builder Stage Into Builder + Devtools

**Description**: Create a fourth stage `devtools` that inherits from `builder` and contains all interactive developer tooling. The `builder` stage retains only Kismet, wireless tools, Node.js, and application code. The `devtools` stage adds ZSH, Oh My Zsh, Powerlevel10k, plugins, Atuin, fonts, and Claude Code.

**Files affected**:

- `docker/Dockerfile` -- Lines 54-85 (move to new `devtools` stage after line 99)

**Changes**:

1. In the `builder` stage (starting L26), remove lines 46-81 (ZSH, git, fontconfig, unzip, bat from apt-get; Oh My Zsh install; plugin clones; Nerd Fonts install; Atuin install; Claude Code install; .zshrc/.p10k.zsh COPY; chsh; profile.d fix).
2. Retain in builder: Kismet, wireless-tools, iw, usbutils, pciutils, procps, curl, net-tools, gpsd-clients (Lines 30-52).
3. After the `RUN npm run build` line (L99), add a new stage:

```dockerfile
# Stage 2b: Development Tools (interactive shell)
FROM builder AS devtools

RUN apt-get update && apt-get install -y --no-install-recommends \
    zsh \
    git \
    fontconfig \
    unzip \
    bat \
    && rm -rf /var/lib/apt/lists/*

# Pin Oh My Zsh to a specific commit for reproducibility
ENV RUNZSH=no CHSH=no HOME=/root
RUN sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)" "" --unattended \
    && git clone --depth=1 https://github.com/romkatv/powerlevel10k.git /root/.oh-my-zsh/custom/themes/powerlevel10k \
    && git clone --depth=1 https://github.com/zsh-users/zsh-autosuggestions /root/.oh-my-zsh/custom/plugins/zsh-autosuggestions \
    && git clone --depth=1 https://github.com/zsh-users/zsh-syntax-highlighting /root/.oh-my-zsh/custom/plugins/zsh-syntax-highlighting \
    && git clone --depth=1 https://github.com/zsh-users/zsh-completions /root/.oh-my-zsh/custom/plugins/zsh-completions

RUN mkdir -p /usr/share/fonts/truetype/meslo \
    && wget -q "https://github.com/romkatv/powerlevel10k-media/raw/master/MesloLGS%20NF%20Regular.ttf" -O "/usr/share/fonts/truetype/meslo/MesloLGS NF Regular.ttf" \
    && wget -q "https://github.com/romkatv/powerlevel10k-media/raw/master/MesloLGS%20NF%20Bold.ttf" -O "/usr/share/fonts/truetype/meslo/MesloLGS NF Bold.ttf" \
    && wget -q "https://github.com/romkatv/powerlevel10k-media/raw/master/MesloLGS%20NF%20Italic.ttf" -O "/usr/share/fonts/truetype/meslo/MesloLGS NF Italic.ttf" \
    && wget -q "https://github.com/romkatv/powerlevel10k-media/raw/master/MesloLGS%20NF%20Bold%20Italic.ttf" -O "/usr/share/fonts/truetype/meslo/MesloLGS NF Bold Italic.ttf" \
    && fc-cache -fv

RUN curl --proto '=https' --tlsv1.2 -LsSf https://setup.atuin.sh | sh

RUN npm install -g @anthropic-ai/claude-code

COPY docker/.zshrc /root/.zshrc
COPY docker/.p10k.zsh /root/.p10k.zsh
RUN chsh -s /bin/zsh root
RUN mkdir -p /etc/profile.d && touch /etc/profile.d/00-zsh-compat.sh
```

4. Update the compose file build target from `--target builder` to `--target devtools` in the build command documented in the compose header comment (L8).

**Verification commands**:

```bash
# Verify builder stage builds successfully without devtools
docker build -t argos:builder-test -f docker/Dockerfile --target builder .
docker image inspect argos:builder-test --format '{{.Size}}' | awk '{printf "%.0f MB\n", $1/1024/1024}'
# Expected: under 2500 MB (down from 4000 MB)

# Verify devtools stage builds and includes ZSH
docker build -t argos:devtools-test -f docker/Dockerfile --target devtools .
docker run --rm argos:devtools-test zsh --version
# Expected: zsh 5.9 or similar

# Verify builder stage does NOT contain ZSH
docker run --rm argos:builder-test which zsh 2>&1
# Expected: error / empty (zsh not found)

# Verify node_modules present in builder
docker run --rm argos:builder-test ls /app/node_modules/.package-lock.json
# Expected: file exists
```

**Acceptance criteria**:

- Builder stage image size under 2500 MB.
- Devtools stage contains ZSH, Oh My Zsh, Powerlevel10k, Atuin, Claude Code.
- Builder stage does NOT contain ZSH, Oh My Zsh, Powerlevel10k, Atuin, Claude Code.
- `npm run build` completes successfully in builder stage.

### Subtask 6.1.1.2: Pin ZSH Plugin Versions to Specific Commits

**Description**: The 4 git clone operations for ZSH plugins (Lines 57-60) clone `HEAD` of master with no version pin. This is a supply chain risk: a compromised upstream commit would silently enter the image. Pin each to a specific commit hash.

**Files affected**:

- `docker/Dockerfile` -- Lines 57-60 in the new `devtools` stage

**Changes**: Replace each `git clone` with `git clone` + `git -C <path> checkout <commit-hash>`. Use `--depth=1` on all clones (currently missing from lines 58-60).

To obtain current HEAD commits for pinning:

```bash
git ls-remote https://github.com/romkatv/powerlevel10k.git HEAD
git ls-remote https://github.com/zsh-users/zsh-autosuggestions.git HEAD
git ls-remote https://github.com/zsh-users/zsh-syntax-highlighting.git HEAD
git ls-remote https://github.com/zsh-users/zsh-completions.git HEAD
```

Pin to the returned commit hashes. Document each hash in a comment above the clone line.

**Verification commands**:

```bash
# Inside built devtools container, verify each plugin is at pinned commit
docker run --rm argos:devtools-test git -C /root/.oh-my-zsh/custom/themes/powerlevel10k log --oneline -1
docker run --rm argos:devtools-test git -C /root/.oh-my-zsh/custom/plugins/zsh-autosuggestions log --oneline -1
docker run --rm argos:devtools-test git -C /root/.oh-my-zsh/custom/plugins/zsh-syntax-highlighting log --oneline -1
docker run --rm argos:devtools-test git -C /root/.oh-my-zsh/custom/plugins/zsh-completions log --oneline -1
# Expected: Each shows the pinned commit hash
```

**Acceptance criteria**:

- All 4 plugin clones use `--depth=1`.
- All 4 plugins pinned to explicit commit hashes with inline comments.
- No unpinned git clones remain in the Dockerfile.

### Subtask 6.1.1.3: Eliminate Redundant COPY scripts After COPY . .

**Description**: Lines 92-93 (`COPY scripts ./scripts` and `RUN chmod +x scripts/*.sh`) are redundant because Line 89 (`COPY . .`) already copies the entire source tree including `scripts/`. The chmod is also unnecessary because git preserves execute bits and the .dockerignore does not filter shell scripts.

**Files affected**:

- `docker/Dockerfile` -- Lines 92-93

**Changes**: Delete lines 92-93 entirely.

**Verification commands**:

```bash
# After rebuild, verify scripts exist and are executable
docker run --rm argos:builder-test ls -la /app/scripts/start-dev.sh
# Expected: file exists with execute permission

docker run --rm argos:builder-test find /app/scripts -name '*.sh' -not -perm -111 | wc -l
# Expected: 0 (all .sh files executable)
```

**Acceptance criteria**:

- Lines 92-93 removed from Dockerfile.
- All scripts present and executable in built image.
- No duplicate COPY instructions for the scripts directory.

### Subtask 6.1.1.4: Add Kismet GPG Key Fingerprint Verification

**Description**: Line 34 fetches the Kismet GPG key via HTTPS and pipes directly to `gpg --dearmor` with no fingerprint verification. A MITM attack on the Kismet key server (or DNS poisoning) could inject a rogue key, allowing arbitrary package installation from an attacker-controlled repository. The same pattern appears in the runner stage at Line 110.

**Files affected**:

- `docker/Dockerfile` -- Line 34 (builder stage), Line 110 (runner stage)

**Changes**: After importing the key, verify its fingerprint before proceeding. Obtain the official Kismet GPG key fingerprint from `https://www.kismetwireless.net/docs/readme/packages/` and add a verification step:

```dockerfile
&& wget -O /tmp/kismet.gpg.key https://www.kismetwireless.net/repos/kismet-release.gpg.key \
&& echo "<EXPECTED_FINGERPRINT>  /tmp/kismet.gpg.key" | sha256sum -c - \
&& gpg --dearmor -o /usr/share/keyrings/kismet-archive-keyring.gpg < /tmp/kismet.gpg.key \
&& rm /tmp/kismet.gpg.key \
```

Where `<EXPECTED_FINGERPRINT>` is obtained by:

```bash
wget -qO- https://www.kismetwireless.net/repos/kismet-release.gpg.key | sha256sum
```

Apply this pattern to both Line 34 (builder) and Line 110 (runner).

**Verification commands**:

```bash
# Build with intentionally wrong fingerprint should FAIL
# (modify the expected hash to 'aaaa...' and attempt build)
docker build -t argos:gpg-test -f docker/Dockerfile --target deps . 2>&1 | tail -5
# Expected: "FAILED" from sha256sum -c

# Build with correct fingerprint should PASS
docker build -t argos:gpg-test -f docker/Dockerfile --target builder .
# Expected: build completes successfully
```

**Acceptance criteria**:

- Both Kismet GPG key fetches (builder L34, runner L110) verify a sha256 checksum before dearmoring.
- Build fails if key content changes.
- Checksum value documented in a Dockerfile comment with retrieval date.

---

## Task 6.1.2: Docker Compose Security Hardening

> **P0 CRITICAL -- FLASK_DEBUG=1 IS A REMOTE CODE EXECUTION (RCE) VECTOR**
>
> FLASK_DEBUG=1 with Werkzeug's interactive debugger enabled is a Remote Code Execution (RCE) vector. Any user on the local network can execute arbitrary Python code via the debugger console at port 8092. On a military training network, this is a live exploit. Remediation: Remove FLASK_DEBUG=1 immediately from docker-compose.portainer-dev.yml:90. Create a separate docker-compose.dev-debug.yml overlay for explicit debug sessions only.
>
> This finding is addressed in Subtask 6.1.2.6 below and MUST be executed FIRST among all security hardening subtasks, before privilege reduction or port binding changes. The traceability matrix entry F7 is reclassified from HIGH to CRITICAL (P0).

**Objective**: Reduce the attack surface of the argos-dev container from its current configuration of `privileged: true` + `pid: host` + `network_mode: host` + Docker socket mount (effectively root on the host) to the minimum privilege set required for WiFi monitor mode and USB hardware access.

**Risk**: HIGH -- Reducing privileges may break WiFi monitor mode, Kismet process management, or Docker-in-Docker tool launching. Each subtask must be tested individually before proceeding.

### Subtask 6.1.2.1: Replace privileged:true With Explicit Capabilities (argos)

**Description**: The argos container uses `privileged: true` (L47) which grants ALL Linux capabilities, disables seccomp, disables AppArmor, and gives full device access. The actual capabilities needed for WiFi monitor mode and hardware access are: NET_ADMIN (interface config), NET_RAW (raw sockets for monitor mode), SYS_RAWIO (USB device access). The bettercap service (L151-152) already demonstrates the correct pattern.

**Files affected**:

- `docker/docker-compose.portainer-dev.yml` -- Line 47

**Changes**: Replace:

```yaml
privileged: true
```

With:

```yaml
cap_add:
    - NET_ADMIN
    - NET_RAW
    - SYS_RAWIO
cap_drop:
    - ALL
security_opt:
    - no-new-privileges:true
```

Retain the `devices:` block (L44-45) for USB access. If SYS_RAWIO alone is insufficient for USB access, add `SYS_ADMIN` as a fallback (still narrower than privileged).

**Verification commands**:

```bash
# Recreate argos container with new config
docker compose -f docker/docker-compose.portainer-dev.yml up -d argos

# Verify privileged is false
docker inspect argos-dev --format '{{.HostConfig.Privileged}}'
# Expected: false

# Verify capabilities
docker inspect argos-dev --format '{{json .HostConfig.CapAdd}}'
# Expected: ["NET_ADMIN","NET_RAW","SYS_RAWIO"]

docker inspect argos-dev --format '{{json .HostConfig.CapDrop}}'
# Expected: ["ALL"]

# Verify WiFi interface visibility (requires wlan1 adapter connected)
docker exec argos-dev iw dev
# Expected: lists wlan1 (or phy#1)

# Verify Kismet can start
docker exec argos-dev kismet --version
# Expected: version string without permission error

# Verify health check passes
docker inspect argos-dev --format '{{.State.Health.Status}}'
# Expected: healthy (after start_period)
```

**Acceptance criteria**:

- `docker inspect` shows `Privileged: false`.
- `CapAdd` contains exactly NET_ADMIN, NET_RAW, and SYS_RAWIO (or SYS_ADMIN if needed).
- `CapDrop` contains ALL.
- `no-new-privileges` is true.
- Kismet starts and detects WiFi interfaces.
- Health check returns healthy within 2 minutes.

### Subtask 6.1.2.2: Remove Docker Socket Mount

**Description**: Lines 54-55 mount `/var/run/docker.sock` and `/usr/bin/docker` into the argos container. This grants the container full Docker API access -- equivalent to root on the host. The comment (L53) states this is for "container management (OpenWebRX, Bettercap, etc.)" but these services should be managed from the host via Portainer or direct compose commands, not from inside the argos container.

**Files affected**:

- `docker/docker-compose.portainer-dev.yml` -- Lines 53-55

**Changes**: Remove these two volume mounts:

```yaml
# Docker access for container management (OpenWebRX, Bettercap, etc.)
- /var/run/docker.sock:/var/run/docker.sock
- /usr/bin/docker:/usr/bin/docker:ro
```

If the Argos UI has a "start OpenWebRX" or "start Bettercap" button that calls Docker API from the SvelteKit server, that code path must be refactored to call a host-side API (out of scope for this phase -- document as a follow-up task).

**Verification commands**:

```bash
# Recreate container
docker compose -f docker/docker-compose.portainer-dev.yml up -d argos

# Verify socket not mounted
docker inspect argos-dev --format '{{range .Mounts}}{{.Source}}:{{.Destination}} {{end}}' | grep -c docker.sock
# Expected: 0

# Verify argos app still starts and serves UI
curl -sf http://localhost:5173/ | head -1
# Expected: HTML content

# Check if any API route references docker socket
grep -r 'docker.sock\|dockerode\|Docker' src/lib/server/ src/routes/api/ --include='*.ts' -l
# Document any files found as follow-up refactoring work
```

**Acceptance criteria**:

- `/var/run/docker.sock` is not mounted into the argos container.
- `/usr/bin/docker` binary is not mounted into the argos container.
- Argos web UI loads and health check passes.
- Any broken Docker-management features documented as follow-up tasks.

### Subtask 6.1.2.3: Remove pid:host Namespace Sharing

**Description**: Line 23 sets `pid: host` which allows the container to see and signal all host processes. The comment (L22) states this is "to manage Kismet processes" but Kismet runs inside the container, not on the host. The pid namespace sharing is unnecessary and dangerous: a compromised container process could kill any host process.

**Files affected**:

- `docker/docker-compose.portainer-dev.yml` -- Lines 22-23

**Changes**: Remove:

```yaml
# Use host PID namespace to manage Kismet processes
pid: host
```

**Verification commands**:

```bash
# Recreate container
docker compose -f docker/docker-compose.portainer-dev.yml up -d argos

# Verify PID namespace is container-isolated
docker inspect argos-dev --format '{{.HostConfig.PidMode}}'
# Expected: "" (empty, meaning container namespace)

# Verify Kismet process management still works inside container
docker exec argos-dev pgrep -a kismet
# Expected: kismet process visible (if running) with container-local PIDs

# Verify container cannot see host processes
docker exec argos-dev ps aux | grep -c dockerd
# Expected: 0 (dockerd is a host process, should not be visible)
```

**Acceptance criteria**:

- `docker inspect` shows PidMode is empty (not "host").
- Kismet can be started and stopped from within the container.
- Container cannot enumerate host processes.

### Subtask 6.1.2.4: Replace privileged:true With Device Access (hackrf-backend)

**Description**: The hackrf-backend service (L96) uses `privileged: true` despite only needing USB device access for the HackRF One. The Dockerfile already creates a non-root user (`hackrf:hackrf`, Dockerfile L20-21) and sets `USER hackrf` (L41), but privileged mode overrides all user restrictions.

**Files affected**:

- `docker/docker-compose.portainer-dev.yml` -- Line 96

**Changes**: Replace:

```yaml
privileged: true
```

With:

```yaml
cap_drop:
    - ALL
security_opt:
    - no-new-privileges:true
```

The existing `devices: ["/dev/bus/usb:/dev/bus/usb"]` (L91-92) provides USB access without needing privileged mode. The HackRF One is a USB device that requires only standard USB permissions, not raw hardware access.

If the hackrf-backend fails to access the HackRF device, add a `group_add: ["plugdev"]` or create udev rules on the host to set device permissions. As a last resort, add `cap_add: [SYS_RAWIO]`.

**Verification commands**:

```bash
# Recreate container
docker compose -f docker/docker-compose.portainer-dev.yml up -d hackrf-backend

# Verify privileged is false
docker inspect hackrf-backend-dev --format '{{.HostConfig.Privileged}}'
# Expected: false

# Verify USB device visible
docker exec hackrf-backend-dev lsusb 2>/dev/null | grep -i hackrf
# Expected: HackRF One device listed (if connected)

# Verify health check passes
docker inspect hackrf-backend-dev --format '{{.State.Health.Status}}'
# Expected: healthy

# Verify non-root user is effective
docker exec hackrf-backend-dev whoami
# Expected: hackrf
```

**Acceptance criteria**:

- `docker inspect` shows `Privileged: false`.
- `CapDrop` contains ALL.
- HackRF device accessible via USB passthrough.
- Container runs as non-root user `hackrf`.
- Flask API responds on port 8092.

#### Privilege Reduction Validation Checklist

After each service's privilege reduction (Subtasks 6.1.2.1 and 6.1.2.4), the following hardware tests MUST pass:

- **argos**: `iw dev wlan0 scan` returns results (WiFi monitor mode), `docker ps` works (container management)
- **hackrf-backend**: `hackrf_info` returns device serial number, `lsusb | grep 1d50:6089` shows HackRF
- **openwebrx**: SDR device enumeration succeeds, WebSDR waterfall renders

If ANY test fails, revert to `privileged: true` for that service and document the specific missing capability. The missing capability can then be added surgically (e.g., `SYS_ADMIN` instead of full privileged mode) in a follow-up iteration.

#### Docker User Namespace Remapping (DISA STIG V-235819)

User namespace remapping (`userns-remap` in Docker daemon config) prevents container root from mapping to host root. Evaluation:

- **PREREQUISITE**: `privileged: true` must be removed first (userns-remap is incompatible with privileged mode)
- **COMPATIBILITY**: Requires testing with USB device passthrough (HackRF, WiFi adapters)
- **RECOMMENDATION**: Evaluate after privilege reduction is complete. If USB passthrough breaks under userns-remap, document as accepted risk with compensating control (AppArmor profile).
- **VERIFICATION**: `docker info | grep 'User Namespace'` shows remapping active

### Subtask 6.1.2.5: Bind Ports to Localhost

**Description**: All port mappings bind to `0.0.0.0` (all interfaces), exposing services to the entire network. On a field-deployed system, this means any device on the tactical network can access Portainer (full Docker control), Ollama (LLM inference), and HackRF API (RF transmission). Only the Argos UI (port 5173) should be network-accessible.

**Files affected**:

- `docker/docker-compose.portainer-dev.yml` -- Line 86 (hackrf-backend ports)
- `docker/docker-compose.portainer.yml` -- Lines 9-10 (portainer ports)
- `docker/docker-compose.ollama.yml` -- Line 9 (ollama port)

**Changes**:

In `docker-compose.portainer-dev.yml` L86:

```yaml
    # Before:
    ports:
      - "8092:8092"
    # After:
    ports:
      - "127.0.0.1:8092:8092"
```

In `docker-compose.portainer.yml` L9-10:

```yaml
    # Before:
    ports:
      - "9000:9000"
      - "9443:9443"
    # After:
    ports:
      - "127.0.0.1:9000:9000"
      - "127.0.0.1:9443:9443"
```

In `docker-compose.ollama.yml` L9:

```yaml
    # Before:
    ports:
      - "11434:11434"
    # After:
    ports:
      - "127.0.0.1:11434:11434"
```

Note: The argos service uses `network_mode: host` so port binding is not applicable -- it inherits all host ports. The `openwebrx` service (L117-118) should also be bound to localhost but is on-demand, so address it in the same change.

In `docker-compose.portainer-dev.yml` L117-118:

```yaml
    # Before:
    ports:
      - "8073:8073"
    # After:
    ports:
      - "127.0.0.1:8073:8073"
```

**Verification commands**:

```bash
# Recreate all services
docker compose -f docker/docker-compose.portainer-dev.yml up -d
docker compose -f docker/docker-compose.portainer.yml up -d
docker compose -f docker/docker-compose.ollama.yml up -d

# Verify hackrf-backend binds to localhost only
docker inspect hackrf-backend-dev --format '{{json .HostConfig.PortBindings}}' | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['8092/tcp'][0]['HostIp']=='127.0.0.1', 'NOT localhost'"
# Expected: no assertion error

# Verify portainer binds to localhost only
docker inspect portainer --format '{{json .HostConfig.PortBindings}}' | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['9000/tcp'][0]['HostIp']=='127.0.0.1'"
# Expected: no assertion error

# Verify ollama binds to localhost only
docker inspect argos-ollama --format '{{json .HostConfig.PortBindings}}' | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['11434/tcp'][0]['HostIp']=='127.0.0.1'"
# Expected: no assertion error

# Verify Argos UI still accessible from network (host network mode)
curl -sf http://localhost:5173/ | head -1
# Expected: HTML content
```

**Acceptance criteria**:

- hackrf-backend port 8092 bound to 127.0.0.1 only.
- portainer ports 9000 and 9443 bound to 127.0.0.1 only.
- ollama port 11434 bound to 127.0.0.1 only.
- openwebrx port 8073 bound to 127.0.0.1 only.
- Argos UI accessible from network via host network mode.
- No service port binds to 0.0.0.0 except Argos main app (via host network).

### Subtask 6.1.2.6: Disable Flask Debug Mode in hackrf-backend

**Description**: Lines 89-90 of the compose file set `FLASK_ENV=development` and `FLASK_DEBUG=1`. Flask debug mode enables the Werkzeug interactive debugger, which provides a Python REPL accessible from the browser at any unhandled exception. This is a direct RCE vector: any user who can reach port 8092 and trigger an error gets arbitrary code execution inside the container.

**Files affected**:

- `docker/docker-compose.portainer-dev.yml` -- Lines 89-90

**Changes**: Replace:

```yaml
- FLASK_ENV=development
- FLASK_DEBUG=1
```

With:

```yaml
- FLASK_ENV=production
- FLASK_DEBUG=0
```

The `--reload` flag in the command (L100) provides hot-reload without the debug REPL. To retain development logging, add `- LOG_LEVEL=DEBUG` as a separate environment variable that the Flask app can consume for verbose logging without enabling the interactive debugger.

**Verification commands**:

```bash
# Recreate container
docker compose -f docker/docker-compose.portainer-dev.yml up -d hackrf-backend

# Verify FLASK_DEBUG is 0
docker exec hackrf-backend-dev env | grep FLASK_DEBUG
# Expected: FLASK_DEBUG=0

# Verify FLASK_ENV is production
docker exec hackrf-backend-dev env | grep FLASK_ENV
# Expected: FLASK_ENV=production

# Verify Werkzeug debugger is NOT active
# Trigger an error endpoint and check for debugger
curl -s http://localhost:8092/api/nonexistent 2>&1 | grep -c "Werkzeug"
# Expected: 0 (no Werkzeug debugger in response)

# Verify API still responds
curl -sf http://localhost:8092/api/health
# Expected: JSON health response
```

**Acceptance criteria**:

- `FLASK_DEBUG` is 0.
- `FLASK_ENV` is `production`.
- Werkzeug interactive debugger is not accessible on error pages.
- Hot-reload still functions via `--reload` flag.
- API health endpoint responds correctly.

---

## Task 6.1.3: Docker Compose Resource Limits and Health Checks

**Objective**: Add missing resource limits (CPU, PIDs) and health checks to all services. Currently, no service has a CPU limit, no service has a PIDs limit, and 2 of 4 active services lack health checks.

**Risk**: LOW -- Adding limits only constrains misbehaving processes; well-behaved services are unaffected.

### Subtask 6.1.3.1: Add CPU and PIDs Limits to All Services

**Description**: No service in any compose file has `cpus` or `pids_limit` set. On an 8 GB RPi 5 with 4 cores, an unbounded container could monopolize all CPU or fork-bomb the host.

**Files affected**:

- `docker/docker-compose.portainer-dev.yml` -- argos (after L64), hackrf-backend (after L99)
- `docker/docker-compose.portainer.yml` -- portainer (after L14)
- `docker/docker-compose.ollama.yml` -- ollama (after L7)

**Changes**: Add to each service:

| Service        | cpus | pids_limit | Rationale                                            |
| -------------- | ---- | ---------- | ---------------------------------------------------- |
| argos          | 3.0  | 256        | Needs multi-core for Node.js + Kismet. 3 of 4 cores. |
| hackrf-backend | 1.0  | 64         | Single Flask process with eventlet.                  |
| portainer      | 0.5  | 64         | Lightweight management UI.                           |
| ollama         | 2.0  | 32         | CPU inference needs multiple cores but not all.      |
| openwebrx      | 1.0  | 64         | SDR processing.                                      |
| bettercap      | 1.0  | 64         | Network scanning.                                    |

Example for argos service:

```yaml
cpus: 3.0
pids_limit: 256
```

**Verification commands**:

```bash
# Recreate containers
docker compose -f docker/docker-compose.portainer-dev.yml up -d
docker compose -f docker/docker-compose.portainer.yml up -d
docker compose -f docker/docker-compose.ollama.yml up -d

# Verify CPU limits
docker inspect argos-dev --format '{{.HostConfig.NanoCpus}}'
# Expected: 3000000000 (3.0 CPUs in nanoseconds)

docker inspect hackrf-backend-dev --format '{{.HostConfig.NanoCpus}}'
# Expected: 1000000000 (1.0 CPU)

docker inspect portainer --format '{{.HostConfig.NanoCpus}}'
# Expected: 500000000 (0.5 CPU)

docker inspect argos-ollama --format '{{.HostConfig.NanoCpus}}'
# Expected: 2000000000 (2.0 CPUs)

# Verify PID limits
docker inspect argos-dev --format '{{.HostConfig.PidsLimit}}'
# Expected: 256

docker inspect hackrf-backend-dev --format '{{.HostConfig.PidsLimit}}'
# Expected: 64

docker inspect portainer --format '{{.HostConfig.PidsLimit}}'
# Expected: 64

docker inspect argos-ollama --format '{{.HostConfig.PidsLimit}}'
# Expected: 32
```

**Acceptance criteria**:

- All 4 active services have `cpus` limit set.
- All 4 active services have `pids_limit` set.
- No service can consume more than its allocated CPU share.
- All services start and pass health checks within their resource constraints.

### Subtask 6.1.3.2: Add Health Checks to Portainer and Ollama

**Description**: Portainer (docker-compose.portainer.yml) and Ollama (docker-compose.ollama.yml) have no health check defined. Without health checks, Docker cannot detect and restart a hung service.

**Files affected**:

- `docker/docker-compose.portainer.yml` -- Add after L14
- `docker/docker-compose.ollama.yml` -- Add after L7

**Changes**:

For portainer:

```yaml
healthcheck:
    test: ['CMD', 'wget', '--spider', '-q', 'http://localhost:9000/api/status']
    interval: 30s
    timeout: 5s
    retries: 3
    start_period: 15s
```

For ollama:

```yaml
healthcheck:
    test: ['CMD', 'curl', '-sf', 'http://localhost:11434/api/tags']
    interval: 60s
    timeout: 10s
    retries: 3
    start_period: 30s
```

Note: Ollama uses a 60s interval because inference requests can legitimately take 60+ seconds on CPU-only ARM hardware; a 30s interval would produce false unhealthy during active inference.

**Verification commands**:

```bash
# Recreate containers
docker compose -f docker/docker-compose.portainer.yml up -d
docker compose -f docker/docker-compose.ollama.yml up -d

# Wait for start_period + one interval
sleep 60

# Verify health status
docker inspect portainer --format '{{.State.Health.Status}}'
# Expected: healthy

docker inspect argos-ollama --format '{{.State.Health.Status}}'
# Expected: healthy

# Verify health check configuration
docker inspect portainer --format '{{json .Config.Healthcheck}}'
# Expected: JSON with test, interval, timeout, retries, start_period

docker inspect argos-ollama --format '{{json .Config.Healthcheck}}'
# Expected: JSON with test, interval, timeout, retries, start_period
```

**Acceptance criteria**:

- Portainer container shows `healthy` status.
- Ollama container shows `healthy` status.
- Both health checks use appropriate intervals for their service characteristics.
- `docker ps` shows health status for all 4 containers.

**FINDING: Health Check Inconsistency Between Dockerfile and Compose**

- Dockerfile (L147-148): `curl -f http://localhost:5173/health` with 3s timeout
- Compose (L70-75): `curl -f http://0.0.0.0:5173/` with 10s timeout

These differ in: host (localhost vs 0.0.0.0), endpoint (/health vs /), and timeout (3s vs 10s).

**Remediation**: Standardize both to `curl -f http://localhost:5173/health` with 10s timeout. The /health endpoint provides application-level validation; the root endpoint only confirms the HTTP server is listening. Update Dockerfile L147-148 to use 10s timeout and Compose L70-75 to use `localhost` and `/health` path.

### Subtask 6.1.3.3: Fix Portainer Restart Policy

**Description**: Portainer uses `restart: always` (portainer.yml L7). This means Portainer will restart even after a manual `docker stop`, which is surprising behavior. The other services correctly use `restart: unless-stopped`.

**Files affected**:

- `docker/docker-compose.portainer.yml` -- Line 7

**Changes**: Replace:

```yaml
restart: always
```

With:

```yaml
restart: unless-stopped
```

**Verification commands**:

```bash
docker compose -f docker/docker-compose.portainer.yml up -d

docker inspect portainer --format '{{.HostConfig.RestartPolicy.Name}}'
# Expected: unless-stopped
```

**Acceptance criteria**:

- Portainer restart policy is `unless-stopped`.
- Portainer still auto-restarts after system reboot.
- `docker stop portainer` followed by waiting 30s does NOT trigger a restart.

### Subtask 6.1.3.4: Add read_only Filesystem Where Possible

**Description**: No service uses `read_only: true`. A read-only root filesystem prevents an attacker who gains code execution from writing persistent backdoors, crontabs, or SSH keys. Services that need writable paths can use `tmpfs` mounts.

**Files affected**:

- `docker/docker-compose.portainer-dev.yml` -- hackrf-backend service (L80-105)
- `docker/docker-compose.portainer.yml` -- portainer service

**Changes**:

For hackrf-backend, add:

```yaml
read_only: true
tmpfs:
    - /tmp:rw,noexec,nosuid,size=50m
```

Note: argos-dev cannot use read_only because it mounts source code read-write for hot reload. Portainer needs writable `/data` volume. For portainer, add:

```yaml
read_only: true
tmpfs:
    - /tmp:rw,noexec,nosuid,size=10m
```

The portainer_data volume mount already handles `/data` persistence.

**Verification commands**:

```bash
docker compose -f docker/docker-compose.portainer-dev.yml up -d hackrf-backend
docker compose -f docker/docker-compose.portainer.yml up -d

# Verify read_only
docker inspect hackrf-backend-dev --format '{{.HostConfig.ReadonlyRootfs}}'
# Expected: true

docker inspect portainer --format '{{.HostConfig.ReadonlyRootfs}}'
# Expected: true

# Verify services still function
docker inspect hackrf-backend-dev --format '{{.State.Health.Status}}'
# Expected: healthy

# Verify tmpfs mounted
docker inspect hackrf-backend-dev --format '{{json .HostConfig.Tmpfs}}'
# Expected: {"/tmp":"rw,noexec,nosuid,size=50m"}
```

**Acceptance criteria**:

- hackrf-backend has `ReadonlyRootfs: true`.
- portainer has `ReadonlyRootfs: true`.
- Both services remain functional with tmpfs for writable paths.
- argos-dev is explicitly documented as excluded from read_only (source mount requirement).

---

## Task 6.1.4: .dockerignore Audit and Improvement

**Objective**: The root `.dockerignore` (symlinked from `config/.dockerignore`, 73 lines) excludes common development artifacts but misses several large directories and files that inflate the Docker build context. Current estimated context size after .dockerignore: ~400 MB. Target: under 60 MB.

**Risk**: LOW -- .dockerignore only affects build context, not runtime behavior.

### Subtask 6.1.4.1: Add Missing Exclusions to Root .dockerignore

**Description**: The following paths are NOT excluded by the current `.dockerignore` but should be, as they are not needed in the Docker image:

| Path              | Size                     | Reason for exclusion                                                                                        |
| ----------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `hackrf_emitter/` | 271 MB (270 MB is .venv) | Separate container; has its own Dockerfile                                                                  |
| `archive/`        | 752 KB                   | Historical files, not used at runtime                                                                       |
| `plans/`          | 2.8 MB                   | Audit documentation, not used at runtime                                                                    |
| `rf_signals.db`   | 7.3 MB                   | Runtime database, should be mounted or created at startup                                                   |
| `core.*`          | 20 MB (34 files)         | Core dumps from crashes                                                                                     |
| `docker/`         | 136 KB                   | Docker config files, not needed inside image (except Dockerfile itself, which is excluded by existing rule) |
| `.p10k.zsh`       | 96 KB                    | Referenced via `COPY docker/.p10k.zsh`, not from root                                                       |
| `deployment/`     | 40 KB                    | SystemD service files                                                                                       |
| `scripts/audit-*` | N/A                      | Audit scripts not needed at runtime                                                                         |
| `*.db`            | Variable                 | SQLite databases                                                                                            |
| `*.pyc`           | Variable                 | Python bytecode                                                                                             |
| `__pycache__/`    | Variable                 | Python cache                                                                                                |

**Files affected**:

- `config/.dockerignore` -- Append after Line 73

**Changes**: Append to `config/.dockerignore`:

```
# Large directories not needed in image
hackrf_emitter/
archive/
plans/
deployment/

# Database files (created at runtime)
*.db
*.db-journal
*.db-wal

# Core dumps
core.*

# Python artifacts
*.pyc
__pycache__/
.venv/
venv/

# ZSH config at root level (COPY uses docker/.p10k.zsh path)
.p10k.zsh
.zshrc
```

**Verification commands**:

```bash
# Count lines in updated .dockerignore
wc -l config/.dockerignore
# Expected: ~95 lines (73 original + ~22 new)

# Verify symlink still works
ls -la .dockerignore
# Expected: symlink to config/.dockerignore

# Build and check that hackrf_emitter is excluded
docker build -t argos:context-test -f docker/Dockerfile --target deps . 2>&1 | head -5
# Note: BuildKit does not show context size. Verify by:
docker run --rm argos:context-test ls /app/hackrf_emitter 2>&1
# Expected: "No such file or directory" (excluded by .dockerignore, but also by stage --
# more reliable: check that build time decreased)

# Time the build to confirm context reduction
time docker build -t argos:context-test -f docker/Dockerfile --target deps --no-cache .
# Expected: significantly faster context transfer
```

**Acceptance criteria**:

- `hackrf_emitter/`, `archive/`, `plans/`, `deployment/`, `core.*`, `*.db`, and `__pycache__/` are all listed in `.dockerignore`.
- Build context transfer time decreases measurably.
- No runtime functionality is broken (hackrf_emitter is a separate container).

---

## Task 6.1.5: Credential Externalization

**Objective**: Remove all hardcoded default passwords from version-controlled compose files and externalize them to a `.env` file that is gitignored. Currently, 4 passwords are hardcoded in compose files that are checked into git.

**Risk**: LOW -- Only changes where credentials are sourced from, not the credentials themselves.

### Subtask 6.1.5.1: Move All Passwords to docker/.env

**Description**: The following credentials are currently hardcoded:

| Credential                 | File                             | Line | Current Value |
| -------------------------- | -------------------------------- | ---- | ------------- |
| KISMET_PASSWORD            | docker-compose.portainer-dev.yml | L42  | `password`    |
| OPENWEBRX_PASSWORD default | docker-compose.portainer-dev.yml | L121 | `hackrf`      |
| BETTERCAP_PASSWORD default | docker-compose.portainer-dev.yml | L156 | `argos`       |
| KISMET_USER                | docker-compose.portainer-dev.yml | L41  | `admin`       |

**Files affected**:

- `docker/.env` -- Expand from 1 line to include all credentials
- `docker/docker-compose.portainer-dev.yml` -- Lines 41-42, 121, 156

**Changes**:

1. Update `docker/.env`:

```
ARGOS_DIR=/home/kali/Documents/Argos/Argos
KISMET_USER=admin
KISMET_PASSWORD=CHANGEME_kismet_$(hostname)
OPENWEBRX_PASSWORD=CHANGEME_openwebrx_$(hostname)
BETTERCAP_USER=admin
BETTERCAP_PASSWORD=CHANGEME_bettercap_$(hostname)
```

Note: The `$(hostname)` will NOT expand in a .env file. Use actual values. The point is to NOT use dictionary words (`password`, `hackrf`, `argos`) as defaults.

2. Update compose references:

In `docker-compose.portainer-dev.yml`, replace:

```yaml
- KISMET_USER=admin
- KISMET_PASSWORD=password
```

With:

```yaml
- KISMET_USER=${KISMET_USER:?Set KISMET_USER in docker/.env}
- KISMET_PASSWORD=${KISMET_PASSWORD:?Set KISMET_PASSWORD in docker/.env}
```

Replace the OPENWEBRX default (L121):

```yaml
# Before:
- OPENWEBRX_ADMIN_PASSWORD=${OPENWEBRX_PASSWORD:-hackrf}
# After:
- OPENWEBRX_ADMIN_PASSWORD=${OPENWEBRX_PASSWORD:?Set OPENWEBRX_PASSWORD in docker/.env}
```

Replace the BETTERCAP default (L155-156):

```yaml
# Before:
- BETTERCAP_API_USER=${BETTERCAP_USER:-admin}
- BETTERCAP_API_PASSWORD=${BETTERCAP_PASSWORD:-argos}
# After:
- BETTERCAP_API_USER=${BETTERCAP_USER:?Set BETTERCAP_USER in docker/.env}
- BETTERCAP_API_PASSWORD=${BETTERCAP_PASSWORD:?Set BETTERCAP_PASSWORD in docker/.env}
```

### Subtask 6.1.5.2: Create docker/.env.example Template

**Description**: Create a template file that documents all required environment variables without containing actual secrets. This file IS committed to git.

**Files affected**:

- `docker/.env.example` -- New file

**Changes**: Create `docker/.env.example`:

```
# Argos Docker Environment Configuration
# Copy this file to .env and fill in values:
#   cp .env.example .env

# Host source directory (absolute path)
ARGOS_DIR=/home/kali/Documents/Argos/Argos

# Kismet WiFi scanner credentials
KISMET_USER=admin
KISMET_PASSWORD=

# OpenWebRX SDR web interface
OPENWEBRX_PASSWORD=

# Bettercap network recon
BETTERCAP_USER=admin
BETTERCAP_PASSWORD=
```

### Subtask 6.1.5.3: Ensure docker/.env Is Gitignored

**Description**: Verify that `docker/.env` is in `.gitignore` and will not be accidentally committed. The root `.gitignore` may already cover `.env` but we must verify it covers the `docker/` subdirectory path.

**Files affected**:

- `.gitignore` -- Verify or add entry

**Verification commands**:

```bash
# Check if docker/.env is gitignored
git check-ignore docker/.env
# Expected: docker/.env (means it IS ignored)

# If not ignored, check what .gitignore says
grep -n '\.env' .gitignore
# Look for patterns that would match docker/.env

# Verify .env.example is NOT gitignored
git check-ignore docker/.env.example
# Expected: empty (not ignored, can be committed)
```

**Acceptance criteria**:

- `docker/.env` contains all credentials previously hardcoded in compose files.
- `docker/.env` is gitignored (verified by `git check-ignore`).
- `docker/.env.example` exists with placeholder values and IS committable.
- Compose files use `${VAR:?error}` syntax (fail-fast if env var missing).
- No password with a dictionary-word default remains in any compose file.
- `docker compose config --quiet` succeeds when docker/.env is populated.

#### Secrets Management Strategy

**Current State**: Kismet password hardcoded as literal "password" (L42). OpenWebRX defaults to "hackrf". Bettercap defaults to "argos".

**Required End State**: All security-critical credentials externalized to `.env` file.

**Implementation**:

1. Create `.env.example` with placeholder values and documentation comments (covered by Subtask 6.1.5.2).
2. Update `setup-host.sh` to prompt for credential values during first-time setup and write `.env` with mode 0600.
3. Update `docker-compose.portainer-dev.yml`: Replace `KISMET_PASSWORD=password` with `KISMET_PASSWORD=${KISMET_PASSWORD:?Set KISMET_PASSWORD in .env}` (covered by Subtask 6.1.5.1).
4. Verify `.env` is in `.gitignore` (already present, covered by Subtask 6.1.5.3).
5. Remove ALL default fallback values for security-critical variables (no `:-password` patterns).

**Verification**: `grep -r 'password\|hackrf\|argos' docker/docker-compose.portainer-dev.yml` returns zero matches for literal credentials.

---

## Task 6.1.6: Build Context and Layer Optimization

**Objective**: Reduce the Docker image layer size by eliminating redundant apt installations between stages, consolidating RUN commands, and using multi-stage COPY more efficiently.

**Risk**: MEDIUM -- Layer changes require full image rebuild and testing.

### Subtask 6.1.6.1: Deduplicate Kismet Installation Between Builder and Runner

**Description**: The Kismet apt repository setup and package installation appears in both the builder stage (Lines 30-52, 23 lines) and the runner stage (Lines 106-122, 17 lines). This code is nearly identical. While multi-stage builds inherently require separate installs (layers are not shared), the runner stage installs packages that are only needed in the builder (pciutils, net-tools) and the builder installs packages only needed in devtools (zsh, git -- addressed in Task 6.1.1.1).

**Files affected**:

- `docker/Dockerfile` -- Lines 30-52 (builder), Lines 106-122 (runner)

**Changes**:

1. In the builder stage, remove `zsh`, `git`, `fontconfig`, `unzip`, `bat` from the apt-get install (these move to devtools in Task 6.1.1.1).
2. In the runner stage, remove `zsh` (L120) -- the runner does not need an interactive shell.
3. In the runner stage, remove `gnupg` and `wget` after the key import by adding `&& apt-get purge -y gnupg wget && apt-get autoremove -y` before `rm -rf /var/lib/apt/lists/*`.

**Verification commands**:

```bash
# Build runner stage
docker build -t argos:runner-test -f docker/Dockerfile --target runner .
docker image inspect argos:runner-test --format '{{.Size}}' | awk '{printf "%.0f MB\n", $1/1024/1024}'
# Expected: under 1200 MB

# Verify Kismet is present in runner
docker run --rm argos:runner-test kismet --version
# Expected: Kismet version string

# Verify ZSH is NOT in runner
docker run --rm argos:runner-test which zsh 2>&1
# Expected: error (zsh not found)
```

**Acceptance criteria**:

- Runner stage does not contain ZSH, gnupg, or wget.
- Runner stage contains Kismet, wireless-tools, iw, usbutils, procps, curl, gpsd-clients.
- Runner stage image size is measurably smaller than before.

### Subtask 6.1.6.2: Add Non-Root User to Runner Stage

**Description**: The runner stage (L101-151) runs as root with no USER directive. The comment on L150 says "Start the application (as root for hardware access)" but the runner stage is the production target, and SvelteKit does not need root to serve HTTP. Hardware access is handled by device mounts and capabilities.

**Files affected**:

- `docker/Dockerfile` -- Between L136 and L138 (after COPY static, before ENV)

**Changes**: Add after the COPY operations and before ENV:

```dockerfile
# Create non-root user for production
RUN groupadd -r argos && useradd -r -g argos -d /app -s /bin/false argos \
    && chown -R argos:argos /app

USER argos
```

Update L150 comment to remove "as root" justification.

**Verification commands**:

```bash
docker build -t argos:runner-test -f docker/Dockerfile --target runner .
docker run --rm argos:runner-test whoami
# Expected: argos

docker run --rm argos:runner-test id
# Expected: uid=NNN(argos) gid=NNN(argos) groups=NNN(argos)
```

**Acceptance criteria**:

- Runner stage runs as non-root user `argos`.
- `node build` starts successfully as non-root.
- Application can write to /app (owned by argos user).

---

## Task 6.1.7: HackRF Backend Dockerfile Optimization

**Objective**: Remove build-essential (297 MB) from the final image and add a multi-stage build to the hackrf-backend Dockerfile. Currently the 730 MB image includes C compilers that are only needed to build python-hackrf wheel.

**Risk**: MEDIUM -- Python native extensions require exact library compatibility.

### Subtask 6.1.7.1: Convert to Multi-Stage Build

**Description**: The current single-stage Dockerfile installs `build-essential` (L15) for compiling Cython and python-hackrf, then leaves these build tools in the final image. A multi-stage build compiles in a builder stage and copies only the compiled wheels to a slim runtime stage.

**Files affected**:

- `hackrf_emitter/backend/Dockerfile` -- Complete rewrite

**Changes**: Replace the entire Dockerfile with:

```dockerfile
# Stage 1: Build native extensions
FROM python:3.11-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    pkg-config \
    libhackrf-dev \
    libusb-1.0-0-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

COPY requirements.txt .
RUN pip install --no-cache-dir Cython>=3.1.0
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# Stage 2: Runtime
FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    hackrf \
    libhackrf-dev \
    libusb-1.0-0-dev \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd -r hackrf && useradd -r -g hackrf hackrf

WORKDIR /app

# Copy compiled Python packages from builder
COPY --from=builder /install /usr/local

COPY . .
RUN chown -R hackrf:hackrf /app

USER hackrf

EXPOSE 8092

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8092/api/health')" || exit 1

CMD ["gunicorn", "--worker-class", "eventlet", "-w", "1", "-b", "0.0.0.0:8092", "app:app"]
```

**Verification commands**:

```bash
# Build the new multi-stage image
docker build -t argos-hackrf-backend:optimized -f hackrf_emitter/backend/Dockerfile hackrf_emitter/backend/

# Compare sizes
docker image inspect argos-hackrf-backend:dev --format '{{.Size}}' | awk '{printf "Old: %.0f MB\n", $1/1024/1024}'
docker image inspect argos-hackrf-backend:optimized --format '{{.Size}}' | awk '{printf "New: %.0f MB\n", $1/1024/1024}'
# Expected: New < 500 MB (down from 730 MB)

# Verify Python imports work
docker run --rm argos-hackrf-backend:optimized python -c "import flask; import numpy; print('OK')"
# Expected: OK

# Verify health check
docker run -d --name hackrf-test argos-hackrf-backend:optimized
sleep 15
docker inspect hackrf-test --format '{{.State.Health.Status}}'
# Expected: healthy
docker rm -f hackrf-test

# Verify build-essential is NOT in the final image
docker run --rm argos-hackrf-backend:optimized dpkg -l build-essential 2>&1 | grep -c "^ii"
# Expected: 0
```

**Acceptance criteria**:

- Final image size under 500 MB.
- `build-essential` not present in final image.
- All Python imports succeed (flask, numpy, hackrf-related).
- Health check passes.
- Non-root user `hackrf` is effective.

---

## Task 6.1.8: Ollama Compose Memory Limit Verification

**Objective**: Document that the Ollama memory limit IS correctly applied (correcting the earlier audit claim) and add the missing CPU limit and health check.

**Risk**: LOW -- Ollama limits are already working; this task adds monitoring and CPU constraints.

### Subtask 6.1.8.1: Add CPU Limit and Health Check to Ollama

**Description**: The Ollama compose file has a memory limit (confirmed working at 2 GB) but no CPU limit and no health check. On CPU-only ARM inference, Ollama can consume all 4 cores during token generation, starving other services.

**Files affected**:

- `docker/docker-compose.ollama.yml` -- Add after L7 (restart)

**Changes**: This is covered by Task 6.1.3 subtasks. No separate changes needed here. This task serves as a cross-reference to confirm the Ollama memory limit correction.

**Verification commands**:

```bash
# Confirm memory limit is applied
docker inspect argos-ollama --format '{{.HostConfig.Memory}}' | awk '{printf "%.0f MB\n", $1/1024/1024}'
# Expected: 2048 MB

# Confirm from Task 6.1.3.1 that CPU limit is applied
docker inspect argos-ollama --format '{{.HostConfig.NanoCpus}}'
# Expected: 2000000000

# Confirm from Task 6.1.3.2 that health check is applied
docker inspect argos-ollama --format '{{.State.Health.Status}}'
# Expected: healthy
```

**Acceptance criteria**:

- Memory limit confirmed at 2 GB (2,147,483,648 bytes).
- CPU limit of 2.0 applied (from Task 6.1.3.1).
- Health check present (from Task 6.1.3.2).
- All three constraints verified via `docker inspect`.

---

## Task 6.1.9: Dead Docker File Cleanup

**Objective**: Remove dead files and obsolete artifacts from the Docker directory.

**Risk**: LOW -- Deleting unused files has no runtime impact.

### Subtask 6.1.9.1: Delete docker/setup-shell.sh

**Description**: `docker/setup-shell.sh` (56 lines) is a standalone script that duplicates all Oh My Zsh, Powerlevel10k, plugin, font, Atuin, and Claude Code installation steps already present in the Dockerfile (Lines 54-74). It is not referenced by any Dockerfile, compose file, or CI configuration. It was likely the precursor to the Dockerfile commands and was never deleted.

**Files affected**:

- `docker/setup-shell.sh` -- Delete

**Verification commands**:

```bash
# Verify no references to setup-shell.sh exist
grep -r 'setup-shell' docker/ scripts/ .github/ Makefile 2>/dev/null | grep -v '.bak'
# Expected: empty (no references)

# Delete the file
rm docker/setup-shell.sh

# Verify deletion
ls docker/setup-shell.sh 2>&1
# Expected: "No such file or directory"
```

**Acceptance criteria**:

- `docker/setup-shell.sh` does not exist.
- No Dockerfile, compose file, script, or CI configuration references it.

### Subtask 6.1.9.2: Remove Deprecated version Key From Compose Files

**Description**: All 3 compose files use `version: '3.8'` (portainer-dev.yml L11, portainer.yml L1, ollama.yml L1). Docker Compose v2 (which is what runs on this system -- v2.32.4) ignores the `version` key and emits a deprecation warning. The `version` key is a v1-era artifact.

**Files affected**:

- `docker/docker-compose.portainer-dev.yml` -- Line 11
- `docker/docker-compose.portainer.yml` -- Line 1
- `docker/docker-compose.ollama.yml` -- Line 1

**Changes**: Remove the `version: '3.8'` line and any blank line immediately following it from each file.

**Verification commands**:

```bash
# Verify version key removed
grep -n "^version:" docker/docker-compose.portainer-dev.yml docker/docker-compose.portainer.yml docker/docker-compose.ollama.yml
# Expected: empty (no matches)

# Validate compose files parse correctly
docker compose -f docker/docker-compose.portainer-dev.yml config --quiet
docker compose -f docker/docker-compose.portainer.yml config --quiet
docker compose -f docker/docker-compose.ollama.yml config --quiet
# Expected: all three exit 0 with no output
```

**Acceptance criteria**:

- No compose file contains a `version:` key.
- All compose files validate successfully with `docker compose config --quiet`.

---

## Task 6.1.10: Docker Disk Reclamation

**Objective**: Reclaim 24.09 GB of Docker disk space from build cache (21.01 GB), dangling images (1.86 GB), and orphaned volumes (1.22 GB).

**Risk**: LOW -- Only removes unused artifacts. Active containers, images, and volumes are preserved.

> **Verification Note**: The 24 GB estimate is projected based on `docker system df` output at the time of the audit. Run `docker system df` before and after cleanup to measure actual reclamation. Disk usage changes between audit time and execution time (e.g., additional builds, new images pulled) may cause the actual reclamation to differ from the projection.

### Subtask 6.1.10.1: Prune Build Cache

**Description**: Docker BuildKit has accumulated 21.01 GB of build cache across 153 cache entries, all inactive. This is from iterative Dockerfile development and should be reclaimed.

**Verification commands (pre-execution)**:

```bash
docker system df
# Note the "Build Cache" RECLAIMABLE value
```

**Execution**:

```bash
docker builder prune --all --force
```

**Verification commands (post-execution)**:

```bash
docker system df
# Expected: Build Cache RECLAIMABLE near 0
# Expected: approximately 21 GB reclaimed
```

**Acceptance criteria**:

- Build cache reclaimable drops to under 500 MB.
- All active containers still running: `docker ps --format '{{.Names}}'` shows 4 containers.

### Subtask 6.1.10.2: Remove Dangling Image

**Description**: One dangling image (no repository/tag) exists at 1.86 GB. This is a previous build of the argos image that was superseded.

**Verification commands (pre-execution)**:

```bash
docker images --filter "dangling=true"
# Expected: 1 image, ~1.86 GB
```

**Execution**:

```bash
docker image prune --force
```

**Verification commands (post-execution)**:

```bash
docker images --filter "dangling=true"
# Expected: 0 images
```

**Acceptance criteria**:

- Zero dangling images remain.
- All tagged images still present: argos:dev, argos-hackrf-backend:dev, ollama/ollama:latest, portainer/portainer-ce:latest.

### Subtask 6.1.10.3: Remove Orphaned Volumes

**Description**: 11 volumes exist but only 5 are actively used by running containers. The 6 orphaned volumes consume 1.22 GB and are artifacts from previous compose stack names or manual runs.

Active volumes (used by running containers):

- `docker_argos-node-modules`
- `docker_argos-svelte-kit`
- `docker_argos-atuin-data`
- `docker_ollama-data`
- `portainer_data`

Orphaned volumes (not used by any container):

- `argos-node-modules` (created 2026-02-02, old stack prefix)
- `argos-svelte-kit` (created 2026-02-02, old stack prefix)
- `argos_argos-node-modules` (created 2026-01-29, oldest stack prefix)
- `argos_argos-svelte-kit` (created 2026-01-29, oldest stack prefix)
- `docker_openwebrx-hackrf-settings` (created 2026-02-06, on-demand service)
- `openwebrx-hackrf-settings` (created 2026-02-02, old stack prefix)

Note: `docker_openwebrx-hackrf-settings` is used by the `openwebrx` service when started with the `tools` profile. It contains OpenWebRX configuration. Before deleting, confirm it is not needed:

```bash
docker volume inspect docker_openwebrx-hackrf-settings --format '{{.CreatedAt}}'
# If recent and contains customized settings, keep it
```

**Execution**:

```bash
# Remove definitively orphaned volumes (old stack prefixes)
docker volume rm argos-node-modules argos-svelte-kit argos_argos-node-modules argos_argos-svelte-kit openwebrx-hackrf-settings

# Optionally remove docker_openwebrx-hackrf-settings if no custom config needed
# docker volume rm docker_openwebrx-hackrf-settings
```

**Verification commands (post-execution)**:

```bash
docker volume ls -q | wc -l
# Expected: 5 or 6 (down from 11)

docker system df
# Expected: Local Volumes RECLAIMABLE near 0
```

**Acceptance criteria**:

- Orphaned volumes with old stack prefixes deleted.
- Active volumes intact and containers unaffected.
- `docker volume ls` shows only actively-used volumes.

---

## 6. Verification Checklist

Execute after all tasks are complete:

| #   | Check                    | Command                                                                                           | Expected Result                                        |
| --- | ------------------------ | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| V1  | All 4 containers running | `docker ps --format '{{.Names}}' \| sort`                                                         | argos-dev, argos-ollama, hackrf-backend-dev, portainer |
| V2  | All containers healthy   | `docker ps --format '{{.Names}} {{.Status}}' \| grep -v healthy`                                  | Empty (all show healthy)                               |
| V3  | Argos UI loads           | `curl -sf http://localhost:5173/ \| head -1`                                                      | HTML content                                           |
| V4  | HackRF API responds      | `curl -sf http://localhost:8092/api/health`                                                       | JSON response                                          |
| V5  | Portainer UI loads       | `curl -sf http://localhost:9000/`                                                                 | HTML or redirect                                       |
| V6  | Ollama API responds      | `curl -sf http://localhost:11434/api/tags`                                                        | JSON response                                          |
| V7  | argos not privileged     | `docker inspect argos-dev --format '{{.HostConfig.Privileged}}'`                                  | false                                                  |
| V8  | hackrf not privileged    | `docker inspect hackrf-backend-dev --format '{{.HostConfig.Privileged}}'`                         | false                                                  |
| V9  | No docker.sock mount     | `docker inspect argos-dev --format '{{range .Mounts}}{{.Source}} {{end}}' \| grep -c docker.sock` | 0                                                      |
| V10 | No pid:host              | `docker inspect argos-dev --format '{{.HostConfig.PidMode}}'`                                     | "" (empty)                                             |
| V11 | Ports bound to localhost | See Task 6.1.2.5 verification commands                                                            | All non-argos ports on 127.0.0.1                       |
| V12 | Flask debug off          | `docker exec hackrf-backend-dev env \| grep FLASK_DEBUG`                                          | FLASK_DEBUG=0                                          |
| V13 | CPU limits set           | `docker inspect argos-dev --format '{{.HostConfig.NanoCpus}}'`                                    | Non-zero value                                         |
| V14 | PID limits set           | `docker inspect argos-dev --format '{{.HostConfig.PidsLimit}}'`                                   | Non-zero value                                         |
| V15 | No hardcoded passwords   | `grep -n 'password\|hackrf\|argos' docker/docker-compose.portainer-dev.yml \| grep -iv '\${'`     | Only comments or non-credential strings                |
| V16 | .env.example exists      | `ls docker/.env.example`                                                                          | File exists                                            |
| V17 | docker/.env gitignored   | `git check-ignore docker/.env`                                                                    | docker/.env                                            |
| V18 | setup-shell.sh deleted   | `ls docker/setup-shell.sh 2>&1`                                                                   | No such file or directory                              |
| V19 | No version: in compose   | `grep -c '^version:' docker/docker-compose.*.yml`                                                 | 0                                                      |
| V20 | Disk reclaimed           | `docker system df`                                                                                | Build Cache RECLAIMABLE < 500 MB                       |
| V21 | Orphaned volumes gone    | `docker volume ls -q \| wc -l`                                                                    | 5 or 6                                                 |
| V22 | .dockerignore updated    | `grep 'hackrf_emitter' config/.dockerignore`                                                      | Match found                                            |

---

## 7. Traceability Matrix

This matrix maps each finding from the audit evidence to the task and subtask that resolves it.

| #   | Finding                                                                                  | Severity          | Task   | Subtask                              |
| --- | ---------------------------------------------------------------------------------------- | ----------------- | ------ | ------------------------------------ |
| F1  | argos runs privileged + pid:host + network:host + docker.sock = zero containment         | CRITICAL          | 6.1.2  | 6.1.2.1, 6.1.2.2, 6.1.2.3            |
| F2  | Runs as root (HOME=/root, no USER directive)                                             | CRITICAL          | 6.1.6  | 6.1.6.2                              |
| F3  | curl-to-shell installs (Oh My Zsh, Atuin) with no checksum                               | CRITICAL          | 6.1.1  | 6.1.1.1 (isolated to devtools stage) |
| F4  | Kismet GPG key fetched with no fingerprint verification                                  | CRITICAL          | 6.1.1  | 6.1.1.4                              |
| F5  | Docker socket mount enables full host Docker API access                                  | CRITICAL          | 6.1.2  | 6.1.2.2                              |
| F6  | KISMET_PASSWORD=password hardcoded in compose                                            | CRITICAL          | 6.1.5  | 6.1.5.1                              |
| F7  | Flask debug mode (FLASK_DEBUG=1) = RCE vector (network-accessible Werkzeug debugger)     | **CRITICAL (P0)** | 6.1.2  | 6.1.2.6 (EXECUTE FIRST)              |
| F8  | Unpinned git clones for 4 ZSH plugins                                                    | HIGH              | 6.1.1  | 6.1.1.2                              |
| F9  | Unpinned npm global install of claude-code                                               | HIGH              | 6.1.1  | 6.1.1.1 (isolated to devtools stage) |
| F10 | 8 ports exposed to all network interfaces                                                | HIGH              | 6.1.2  | 6.1.2.5                              |
| F11 | OPENWEBRX_PASSWORD defaults to "hackrf"                                                  | HIGH              | 6.1.5  | 6.1.5.1                              |
| F12 | BETTERCAP_PASSWORD defaults to "argos"                                                   | HIGH              | 6.1.5  | 6.1.5.1                              |
| F13 | hackrf-backend uses privileged:true                                                      | HIGH              | 6.1.2  | 6.1.2.4                              |
| F14 | No read_only, no-new-privileges, cap_drop:ALL, pids_limit, cpus limit                    | MEDIUM            | 6.1.3  | 6.1.3.1, 6.1.3.4; 6.1.2.1, 6.1.2.4   |
| F15 | COPY . . copies unnecessary files (hackrf_emitter/.venv 270MB, etc.)                     | CRITICAL (perf)   | 6.1.4  | 6.1.4.1                              |
| F16 | Redundant COPY scripts after COPY . .                                                    | HIGH (perf)       | 6.1.1  | 6.1.1.3                              |
| F17 | 828 MB apt layer in builder (includes dev tools)                                         | HIGH (perf)       | 6.1.1  | 6.1.1.1                              |
| F18 | Duplicated apt install in runner stage (reinstalls Kismet, ZSH)                          | HIGH (perf)       | 6.1.6  | 6.1.6.1                              |
| F19 | hackrf-backend includes build-essential (297 MB) in final image                          | HIGH (perf)       | 6.1.7  | 6.1.7.1                              |
| F20 | 123 MB Claude Code, 39.6 MB Atuin, 21 MB ZSH plugins, 10.4 MB fonts in builder           | MEDIUM (perf)     | 6.1.1  | 6.1.1.1                              |
| F21 | Dev compose uses --target builder (4 GB) not runner (~1 GB)                              | MEDIUM (perf)     | 6.1.1  | 6.1.1.1                              |
| F22 | .dockerignore missing hackrf_emitter/, archive/, plans/, rf_signals.db, core.\*, docker/ | MEDIUM            | 6.1.4  | 6.1.4.1                              |
| F23 | Only 1 of ~16 env vars externalized in docker/.env                                       | MEDIUM            | 6.1.5  | 6.1.5.1, 6.1.5.2                     |
| F24 | No .env.production template                                                              | MEDIUM            | 6.1.5  | 6.1.5.2                              |
| F25 | Dead file: docker/setup-shell.sh (56 lines)                                              | LOW               | 6.1.9  | 6.1.9.1                              |
| F26 | Deprecated version: '3.8' in compose files                                               | LOW               | 6.1.9  | 6.1.9.2                              |
| F27 | 24.09 GB reclaimable Docker disk (build cache, dangling images, orphaned volumes)        | MEDIUM            | 6.1.10 | 6.1.10.1, 6.1.10.2, 6.1.10.3         |
| F28 | Ollama deploy.resources claimed silently ignored                                         | N/A (CORRECTION)  | 6.1.8  | 6.1.8.1 (documenting correction)     |
| F29 | No health checks for portainer or ollama                                                 | MEDIUM            | 6.1.3  | 6.1.3.2                              |
| F30 | Portainer restart:always should be unless-stopped                                        | LOW               | 6.1.3  | 6.1.3.3                              |
| F31 | No CPU or PIDs limits on any service                                                     | MEDIUM            | 6.1.3  | 6.1.3.1                              |

---

## 8. Execution Order and Dependencies

Tasks must be executed in the following order due to dependencies:

```
Phase 0 (IMMEDIATE -- P0 RCE remediation):
  6.1.2.6 (Disable Flask debug) -- Zero dependencies, eliminates live RCE vector

Phase 1 (Parallel):
  6.1.4  (.dockerignore)     -- No dependencies
  6.1.5  (Credentials)       -- No dependencies
  6.1.9  (Dead files)        -- No dependencies
  6.1.10 (Disk reclamation)  -- No dependencies, verify with `docker system df` before/after

Phase 2 (Sequential, requires Phase 1):
  6.1.1  (Dockerfile stages) -- Requires 6.1.4 (updated .dockerignore for builds)
  6.1.7  (HackRF Dockerfile) -- Independent of 6.1.1

Phase 3 (Sequential, requires Phase 2):
  6.1.6  (Layer optimization) -- Requires 6.1.1 (stage split complete)

Phase 4 (Sequential, requires rebuilt images):
  6.1.2  (Compose security)  -- Requires images from Phase 2/3
  6.1.3  (Resource limits)   -- Requires compose changes from 6.1.2
  6.1.8  (Ollama verification) -- Requires 6.1.3
```

Total estimated execution time: 2-4 hours (including image rebuilds on ARM).

---

## 9. Out-of-Scope Items (Documented for Follow-Up)

| Item                                                            | Reason                                                             | Suggested Phase                          |
| --------------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------- |
| Refactor Argos code that calls Docker API from inside container | Requires application code changes                                  | Phase 7 (Application)                    |
| Replace curl-to-shell installs with checksummed downloads       | Oh My Zsh and Atuin have no official checksummed release artifacts | Accept risk (isolated to devtools stage) |
| Migrate from network_mode:host to bridge networking for argos   | Requires rearchitecting WiFi monitor mode access                   | Phase 7 (Network)                        |
| Pin base images (node:20-bookworm-slim) to digest               | Requires ongoing maintenance of digest updates                     | Phase 6.2 (CI/CD)                        |
| Add Docker image scanning (Trivy/Grype) to CI                   | Requires CI pipeline (currently broken)                            | Phase 6.2 (CI/CD)                        |
| Implement Docker secrets for credential management              | Requires Swarm mode or alternative secrets manager                 | Phase 6.2 (CI/CD)                        |

---

**END OF DOCUMENT**

**Document size**: ~510 lines
**Tasks**: 10 (6.1.1 through 6.1.10)
**Subtasks**: 41
**Findings addressed**: 31 (27 original + 4 corrections/verifications)
**Audit corrections applied**: F7 reclassified HIGH->CRITICAL(P0), privilege reduction validation checklist added, Docker userns-remap evaluation added, secrets management strategy added, health check inconsistency finding added, disk reclamation verification caveat added
