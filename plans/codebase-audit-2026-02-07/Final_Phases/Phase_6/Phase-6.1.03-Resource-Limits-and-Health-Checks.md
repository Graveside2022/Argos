# Phase 6.1.03: Resource Limits and Health Checks

**Document ID**: ARGOS-AUDIT-P6.1.03
**Parent Document**: Phase-6.1-DOCKER-AND-CONTAINER-MODERNIZATION.md
**Original Task ID**: 6.1.3
**Version**: 1.0
**Date**: 2026-02-08
**Author**: Claude Opus 4.6 (Lead Audit Agent)
**Classification**: UNCLASSIFIED // FOR OFFICIAL USE ONLY
**Risk Level**: LOW -- Adding limits only constrains misbehaving processes; well-behaved services are unaffected.
**Review Standard**: CIS Docker Benchmark v1.6, DISA STIG Docker Enterprise V2R1, NIST SP 800-190

---

## 1. Objective

Add missing resource limits (CPU, PIDs) and health checks to all services. Currently, no service has a CPU limit, no service has a PIDs limit, and 2 of 4 active services lack health checks.

---

## 2. Prerequisites

| Prerequisite                          | Verification Command                                             | Expected Output                                        |
| ------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------ |
| Docker Engine 27.x                    | `docker --version`                                               | Docker version 27.5.1 or later                         |
| Docker Compose v2                     | `docker compose version`                                         | Docker Compose version 2.32.4-3 or later               |
| All 4 containers running              | `docker ps --format '{{.Names}}' \| sort`                        | argos-dev, argos-ollama, hackrf-backend-dev, portainer |
| Backup of compose files               | See parent document rollback strategy                            | Backup files exist                                     |
| Phase-6.1.02 compose security applied | `docker inspect argos-dev --format '{{.HostConfig.Privileged}}'` | false                                                  |

---

## 3. Dependencies

| Dependency                         | Direction                | Description                                                              |
| ---------------------------------- | ------------------------ | ------------------------------------------------------------------------ |
| Phase-6.1.02 (Compose security)    | **BLOCKS THIS TASK**     | Compose security changes from Task 6.1.2 must be applied first           |
| Phase-6.1.08 (Ollama verification) | **BLOCKED BY THIS TASK** | Ollama verification requires CPU limits and health checks from this task |

---

## 4. Rollback Strategy

```bash
# Restore backed-up compose files
cp docker/docker-compose.portainer-dev.yml.bak docker/docker-compose.portainer-dev.yml
cp docker/docker-compose.portainer.yml.bak docker/docker-compose.portainer.yml
cp docker/docker-compose.ollama.yml.bak docker/docker-compose.ollama.yml

# Recreate containers
docker compose -f docker/docker-compose.portainer-dev.yml up -d
docker compose -f docker/docker-compose.portainer.yml up -d
docker compose -f docker/docker-compose.ollama.yml up -d

# Verify all containers healthy
docker ps --format 'table {{.Names}}\t{{.Status}}'
```

---

## 5. Subtask Details

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

---

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

---

**FINDING: Health Check Inconsistency Between Dockerfile and Compose**

- Dockerfile (L147-148): `curl -f http://localhost:5173/health` with 3s timeout
- Compose (L70-75): `curl -f http://0.0.0.0:5173/` with 10s timeout

These differ in: host (localhost vs 0.0.0.0), endpoint (/health vs /), and timeout (3s vs 10s).

**Remediation**: Standardize both to `curl -f http://localhost:5173/health` with 10s timeout. The /health endpoint provides application-level validation; the root endpoint only confirms the HTTP server is listening. Update Dockerfile L147-148 to use 10s timeout and Compose L70-75 to use `localhost` and `/health` path.

---

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

---

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

## 6. Verification Commands

All verification commands are embedded within each subtask above. The parent document's verification checklist entries relevant to this task:

| #   | Check                  | Command                                                          | Expected                 |
| --- | ---------------------- | ---------------------------------------------------------------- | ------------------------ |
| V2  | All containers healthy | `docker ps --format '{{.Names}} {{.Status}}' \| grep -v healthy` | Empty (all show healthy) |
| V13 | CPU limits set         | `docker inspect argos-dev --format '{{.HostConfig.NanoCpus}}'`   | Non-zero value           |
| V14 | PID limits set         | `docker inspect argos-dev --format '{{.HostConfig.PidsLimit}}'`  | Non-zero value           |

---

## 7. Acceptance Criteria

1. All 4 active services (argos, hackrf-backend, portainer, ollama) have explicit `cpus` limits.
2. All 4 active services have explicit `pids_limit` values.
3. Portainer and Ollama containers show `healthy` status with proper health checks.
4. Portainer restart policy changed from `always` to `unless-stopped`.
5. hackrf-backend and portainer have `ReadonlyRootfs: true` with tmpfs for writable paths.
6. argos-dev documented as excluded from read_only.
7. Health check inconsistency between Dockerfile and Compose resolved (standardized to localhost:5173/health with 10s timeout).
8. All services start and function correctly within their resource constraints.

---

## 8. Traceability

| Finding | Description                                                           | Severity | Subtask          |
| ------- | --------------------------------------------------------------------- | -------- | ---------------- |
| F14     | No read_only, no-new-privileges, cap_drop:ALL, pids_limit, cpus limit | MEDIUM   | 6.1.3.1, 6.1.3.4 |
| F29     | No health checks for portainer or ollama                              | MEDIUM   | 6.1.3.2          |
| F30     | Portainer restart:always should be unless-stopped                     | LOW      | 6.1.3.3          |
| F31     | No CPU or PIDs limits on any service                                  | MEDIUM   | 6.1.3.1          |

---

## 9. Execution Order Notes

This task is in **Phase 4** of the execution order:

```
Phase 0 (IMMEDIATE): 6.1.2.6 (Flask debug -- RCE remediation)
Phase 1 (Parallel): 6.1.4, 6.1.5, 6.1.9, 6.1.10, 6.1.11
Phase 2 (Sequential): 6.1.1, 6.1.7
Phase 3 (Sequential): 6.1.6
Phase 4 (Sequential): 6.1.2, >>> 6.1.3 (THIS TASK) <<<, 6.1.8
```

**Requires**: Phase-6.1.02 (Compose security hardening) must be complete.
**Blocks**: Phase-6.1.08 (Ollama verification) depends on CPU limits and health checks from this task.

Total estimated execution time: 15-20 minutes.

**END OF DOCUMENT**
