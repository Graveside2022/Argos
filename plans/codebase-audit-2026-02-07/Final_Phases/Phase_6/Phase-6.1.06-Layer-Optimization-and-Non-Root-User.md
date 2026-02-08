# Phase 6.1.06: Build Context and Layer Optimization

**Document ID**: ARGOS-AUDIT-P6.1.06
**Parent Document**: Phase-6.1-DOCKER-AND-CONTAINER-MODERNIZATION.md
**Original Task ID**: 6.1.6
**Version**: 1.0
**Date**: 2026-02-08
**Author**: Claude Opus 4.6 (Lead Audit Agent)
**Classification**: UNCLASSIFIED // FOR OFFICIAL USE ONLY
**Risk Level**: MEDIUM -- Layer changes require full image rebuild and testing.
**Review Standard**: CIS Docker Benchmark v1.6, DISA STIG Docker Enterprise V2R1, NIST SP 800-190

---

## 1. Objective

Reduce the Docker image layer size by eliminating redundant apt installations between stages, consolidating RUN commands, and adding a non-root user to the runner stage. Currently, the runner stage reinstalls packages only needed in the builder (pciutils, net-tools) and runs as root (no USER directive). CIS Docker Benchmark 4.1 and DISA STIG V-235810 require containers to run as non-root users.

---

## 2. Prerequisites

| Prerequisite                             | Verification Command                                   | Expected Output                          |
| ---------------------------------------- | ------------------------------------------------------ | ---------------------------------------- |
| Docker Engine 27.x                       | `docker --version`                                     | Docker version 27.5.1 or later           |
| Docker Compose v2                        | `docker compose version`                               | Docker Compose version 2.32.4-3 or later |
| Phase-6.1.01 Dockerfile stage split done | `grep -c 'FROM builder AS devtools' docker/Dockerfile` | 1                                        |
| Backup of Dockerfile                     | `cp docker/Dockerfile docker/Dockerfile.bak`           | File exists                              |
| Git working tree clean (or stashed)      | `git status --porcelain \| wc -l`                      | 0 (or known untracked-only count)        |

---

## 3. Dependencies

| Dependency                       | Direction                | Description                                                                                                   |
| -------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Phase-6.1.01 (Dockerfile stages) | **BLOCKS THIS TASK**     | The builder/devtools stage split must be complete before layer deduplication and non-root user can be applied |
| Phase-6.1.04 (.dockerignore)     | **BLOCKS THIS TASK**     | Updated .dockerignore must be in place before rebuilding images                                               |
| Phase-6.1.02 (Compose security)  | **BLOCKED BY THIS TASK** | Runner stage non-root user must be in place for full security posture before compose security hardening       |

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

# Verify gnupg is NOT in runner (purged after key import)
docker run --rm argos:runner-test dpkg -l gnupg 2>&1 | grep -c "^ii"
# Expected: 0

# Verify wget is NOT in runner (purged after key import)
docker run --rm argos:runner-test dpkg -l wget 2>&1 | grep -c "^ii"
# Expected: 0
```

**Acceptance criteria**:

- Runner stage does not contain ZSH, gnupg, or wget.
- Runner stage contains Kismet, wireless-tools, iw, usbutils, procps, curl, gpsd-clients.
- Runner stage image size is measurably smaller than before.

---

### Subtask 6.1.6.2: Add Non-Root User to Runner Stage

**Description**: The runner stage (L101-151) runs as root with no USER directive. The comment on L150 says "Start the application (as root for hardware access)" but the runner stage is the production target, and SvelteKit does not need root to serve HTTP. Hardware access is handled by device mounts and capabilities. CIS Docker Benchmark 4.1 requires a non-root USER directive. DISA STIG V-235810 requires container processes to run as non-root.

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
# Build runner stage
docker build -t argos:runner-test -f docker/Dockerfile --target runner .

# Verify non-root user
docker run --rm argos:runner-test whoami
# Expected: argos

docker run --rm argos:runner-test id
# Expected: uid=NNN(argos) gid=NNN(argos) groups=NNN(argos)

# Verify user cannot write to system directories
docker run --rm argos:runner-test touch /etc/test-write 2>&1
# Expected: Permission denied or Read-only file system

# Verify user CAN write to /app (owned by argos)
docker run --rm argos:runner-test touch /app/test-write 2>&1
# Expected: success (no error)

# Verify SvelteKit starts as non-root
docker run --rm -d --name runner-test argos:runner-test
sleep 5
docker exec runner-test ps aux | head -5
# Expected: node process running as argos user (not root)
docker rm -f runner-test
```

**Acceptance criteria**:

- Runner stage runs as non-root user `argos`.
- `node build` starts successfully as non-root.
- Application can write to /app (owned by argos user).
- `id` command shows non-root UID.
- CIS Docker Benchmark 4.1 compliance verified.

---

## 6. Verification Commands

All verification commands are embedded within each subtask above. Summary of key verification steps:

```bash
# V1: Runner stage image size
docker image inspect argos:runner-test --format '{{.Size}}' | awk '{printf "%.0f MB\n", $1/1024/1024}'
# Expected: under 1200 MB

# V2: Kismet present in runner
docker run --rm argos:runner-test kismet --version
# Expected: Kismet version string

# V3: ZSH absent from runner
docker run --rm argos:runner-test which zsh 2>&1
# Expected: error

# V4: Non-root user
docker run --rm argos:runner-test whoami
# Expected: argos

# V5: gnupg purged from runner
docker run --rm argos:runner-test dpkg -l gnupg 2>&1 | grep -c "^ii"
# Expected: 0
```

---

## 7. Acceptance Criteria

1. Runner stage does not contain ZSH, gnupg, or wget.
2. Runner stage contains Kismet, wireless-tools, iw, usbutils, procps, curl, gpsd-clients.
3. Runner stage image size is measurably smaller than before (under 1200 MB).
4. Runner stage runs as non-root user `argos` (UID != 0).
5. `node build` starts successfully as non-root.
6. Application can write to /app directory (owned by argos user).
7. CIS Docker Benchmark 4.1 (USER directive present) is satisfied.
8. DISA STIG V-235810 (non-root container process) is satisfied.
9. Builder stage remains unaffected (still runs as root for apt-get operations).

---

## 8. Traceability

| Finding | Description                                                     | Severity    | Subtask |
| ------- | --------------------------------------------------------------- | ----------- | ------- |
| F2      | Runs as root (HOME=/root, no USER directive)                    | CRITICAL    | 6.1.6.2 |
| F18     | Duplicated apt install in runner stage (reinstalls Kismet, ZSH) | HIGH (perf) | 6.1.6.1 |

---

## 9. Execution Order Notes

This task is in **Phase 3** of the execution order:

```
Phase 0 (IMMEDIATE): 6.1.2.6 (Flask debug -- RCE remediation)
Phase 1 (Parallel): 6.1.4, 6.1.5, 6.1.9, 6.1.10, 6.1.11
Phase 2 (Sequential): 6.1.1, 6.1.7
Phase 3 (Sequential): >>> 6.1.6 (THIS TASK) <<<
Phase 4 (Sequential): 6.1.2, 6.1.3, 6.1.8
```

**Requires**: Phase-6.1.01 (Dockerfile stage split) must be complete before this task can begin. Phase-6.1.04 (.dockerignore) must be complete for efficient builds.
**Blocks**: Phase-6.1.02 (Compose security) requires the non-root runner user to be in place for full security posture.

Total estimated execution time: 20-30 minutes (including ARM image rebuild).

**END OF DOCUMENT**
