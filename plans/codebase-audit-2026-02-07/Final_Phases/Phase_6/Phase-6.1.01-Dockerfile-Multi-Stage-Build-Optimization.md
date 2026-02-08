# Phase 6.1.01: Dockerfile Multi-Stage Build Optimization

**Document ID**: ARGOS-AUDIT-P6.1.01
**Parent Document**: Phase-6.1-DOCKER-AND-CONTAINER-MODERNIZATION.md
**Original Task ID**: 6.1.1
**Version**: 1.0
**Date**: 2026-02-08
**Author**: Claude Opus 4.6 (Lead Audit Agent)
**Classification**: UNCLASSIFIED // FOR OFFICIAL USE ONLY
**Risk Level**: MEDIUM -- Changes container shell experience. Interactive `docker exec -it argos-dev zsh` will only work if compose targets the devtools stage.
**Review Standard**: CIS Docker Benchmark v1.6, DISA STIG Docker Enterprise V2R1, NIST SP 800-190

---

## 1. Objective

Eliminate developer tooling (ZSH, Oh My Zsh, Powerlevel10k, Atuin, Nerd Fonts, Claude Code CLI) from the image layers used at runtime. These tools are baked into the builder stage (Lines 54-81, 828 MB apt layer) but serve no runtime purpose -- they exist only for interactive shell sessions. Restructure the build to use a dedicated `devtools` stage that is layered on top, reducing the builder image from 4 GB to approximately 1.5 GB.

---

## 2. Prerequisites

| Prerequisite                        | Verification Command                         | Expected Output                                        |
| ----------------------------------- | -------------------------------------------- | ------------------------------------------------------ |
| Docker Engine 27.x                  | `docker --version`                           | Docker version 27.5.1 or later                         |
| Docker Compose v2                   | `docker compose version`                     | Docker Compose version 2.32.4-3 or later               |
| Root or docker-group access         | `docker ps`                                  | Lists running containers without error                 |
| Git working tree clean (or stashed) | `git status --porcelain \| wc -l`            | 0 (or known untracked-only count)                      |
| All 4 containers running            | `docker ps --format '{{.Names}}' \| sort`    | argos-dev, argos-ollama, hackrf-backend-dev, portainer |
| Backup of Dockerfile                | `cp docker/Dockerfile docker/Dockerfile.bak` | File exists                                            |
| Updated .dockerignore               | `grep 'hackrf_emitter' config/.dockerignore` | Match found                                            |

---

## 3. Dependencies

| Dependency                        | Direction                | Description                                                                                           |
| --------------------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------- |
| Phase-6.1.04 (.dockerignore)      | **BLOCKS THIS TASK**     | Updated .dockerignore must be in place before rebuilding images to avoid sending 400 MB build context |
| Phase-6.1.06 (Layer optimization) | **BLOCKED BY THIS TASK** | Layer deduplication and non-root user require the stage split to be complete first                    |
| Phase-6.1.02 (Compose security)   | **BLOCKED BY THIS TASK** | Compose security hardening requires images built from the restructured Dockerfile                     |

---

## 4. Rollback Strategy

```bash
# Restore backed-up Dockerfile
cp docker/Dockerfile.bak docker/Dockerfile

# Rebuild image from restored Dockerfile
docker build -t argos:dev -f docker/Dockerfile --target builder .

# Recreate container
docker compose -f docker/docker-compose.portainer-dev.yml up -d argos

# Verify container is healthy
docker ps --format 'table {{.Names}}\t{{.Status}}'
```

---

## 5. Subtask Details

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

---

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

---

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

---

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

## 6. Verification Commands

All verification commands are embedded within each subtask above. Summary of key verification steps:

```bash
# V1: Builder stage size check
docker image inspect argos:builder-test --format '{{.Size}}' | awk '{printf "%.0f MB\n", $1/1024/1024}'
# Expected: under 2500 MB

# V2: Devtools stage has ZSH
docker run --rm argos:devtools-test zsh --version
# Expected: zsh version string

# V3: Builder stage lacks ZSH
docker run --rm argos:builder-test which zsh 2>&1
# Expected: error/empty

# V4: No redundant COPY lines in Dockerfile
grep -n 'COPY scripts' docker/Dockerfile | wc -l
# Expected: 0

# V5: GPG key verification in Dockerfile
grep -c 'sha256sum -c' docker/Dockerfile
# Expected: 2 (one per stage)

# V6: All plugins pinned
grep -c 'checkout' docker/Dockerfile
# Expected: 4 (one per plugin)
```

---

## 7. Acceptance Criteria

1. Builder stage image size under 2500 MB (down from 4000 MB).
2. Devtools stage contains all developer tooling: ZSH, Oh My Zsh, Powerlevel10k, Atuin, Claude Code, Nerd Fonts.
3. Builder stage does NOT contain any developer tooling.
4. `npm run build` completes successfully in builder stage.
5. All 4 ZSH plugins pinned to explicit commit hashes with `--depth=1`.
6. No unpinned git clones remain in the Dockerfile.
7. Lines 92-93 (redundant COPY scripts + chmod) removed.
8. All scripts present and executable in built image after COPY . . only.
9. Both Kismet GPG key fetches verify sha256 checksum before dearmoring.
10. Build fails if GPG key content changes (tamper detection).

---

## 8. Traceability

| Finding | Description                                                                    | Severity      | Subtask                              |
| ------- | ------------------------------------------------------------------------------ | ------------- | ------------------------------------ |
| F3      | curl-to-shell installs (Oh My Zsh, Atuin) with no checksum                     | CRITICAL      | 6.1.1.1 (isolated to devtools stage) |
| F4      | Kismet GPG key fetched with no fingerprint verification                        | CRITICAL      | 6.1.1.4                              |
| F8      | Unpinned git clones for 4 ZSH plugins                                          | HIGH          | 6.1.1.2                              |
| F9      | Unpinned npm global install of claude-code                                     | HIGH          | 6.1.1.1 (isolated to devtools stage) |
| F16     | Redundant COPY scripts after COPY . .                                          | HIGH (perf)   | 6.1.1.3                              |
| F17     | 828 MB apt layer in builder (includes dev tools)                               | HIGH (perf)   | 6.1.1.1                              |
| F20     | 123 MB Claude Code, 39.6 MB Atuin, 21 MB ZSH plugins, 10.4 MB fonts in builder | MEDIUM (perf) | 6.1.1.1                              |
| F21     | Dev compose uses --target builder (4 GB) not runner (~1 GB)                    | MEDIUM (perf) | 6.1.1.1                              |

---

## 9. Execution Order Notes

This task is in **Phase 2** of the execution order:

```
Phase 0 (IMMEDIATE): 6.1.2.6 (Flask debug -- RCE remediation)
Phase 1 (Parallel): 6.1.4, 6.1.5, 6.1.9, 6.1.10, 6.1.11
Phase 2 (Sequential): >>> 6.1.1 (THIS TASK) <<<, 6.1.7
Phase 3 (Sequential): 6.1.6 (requires this task complete)
Phase 4 (Sequential): 6.1.2, 6.1.3, 6.1.8
```

**Requires**: Phase-6.1.04 (.dockerignore update) must be complete before building images.
**Blocks**: Phase-6.1.06 (Layer optimization) cannot proceed until this stage split is complete.
**Parallel with**: Phase-6.1.07 (HackRF Dockerfile) is independent and can execute concurrently.

Total estimated execution time for this task: 30-45 minutes (including ARM image rebuild).

**END OF DOCUMENT**
