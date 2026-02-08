# Phase 6.1.10: Docker Disk Reclamation

**Document ID**: ARGOS-AUDIT-P6.1.10
**Parent Document**: Phase-6.1-DOCKER-AND-CONTAINER-MODERNIZATION.md
**Original Task ID**: 6.1.10
**Version**: 1.0
**Date**: 2026-02-08
**Author**: Claude Opus 4.6 (Lead Audit Agent)
**Classification**: UNCLASSIFIED // FOR OFFICIAL USE ONLY
**Risk Level**: LOW -- Only removes unused artifacts. Active containers, images, and volumes are preserved.
**Review Standard**: CIS Docker Benchmark v1.6, DISA STIG Docker Enterprise V2R1, NIST SP 800-190

---

## 1. Objective

Reclaim approximately 24.09 GB of Docker disk space from build cache (21.01 GB), dangling images (1.86 GB), and orphaned volumes (1.22 GB). On a field-deployed RPi 5 with a 500 GB NVMe, 24 GB of wasted Docker disk space represents nearly 5% of total storage and degrades I/O performance due to unnecessary filesystem overhead.

> **Verification Note**: The 24 GB estimate is projected based on `docker system df` output at the time of the audit. Run `docker system df` before and after cleanup to measure actual reclamation. Disk usage changes between audit time and execution time (e.g., additional builds, new images pulled) may cause the actual reclamation to differ from the projection.

---

## 2. Prerequisites

| Prerequisite                        | Verification Command                      | Expected Output                                        |
| ----------------------------------- | ----------------------------------------- | ------------------------------------------------------ |
| Docker Engine 27.x                  | `docker --version`                        | Docker version 27.5.1 or later                         |
| All 4 containers running            | `docker ps --format '{{.Names}}' \| sort` | argos-dev, argos-ollama, hackrf-backend-dev, portainer |
| Pre-cleanup disk usage recorded     | `docker system df`                        | Build Cache, Images, Volumes sizes noted               |
| No active builds in progress        | `docker buildx ls \| grep -c running`     | 0                                                      |
| Git working tree clean (or stashed) | `git status --porcelain \| wc -l`         | 0 (or known untracked-only count)                      |

---

## 3. Dependencies

| Dependency | Direction                | Description                                                                 |
| ---------- | ------------------------ | --------------------------------------------------------------------------- |
| None       | **BLOCKS THIS TASK**     | This task has no inbound dependencies and can execute in Phase 1 (Parallel) |
| None       | **BLOCKED BY THIS TASK** | This task has no downstream dependencies                                    |

**IMPORTANT**: Execute this task BEFORE Phase 2 image rebuilds (Tasks 6.1.1, 6.1.7) to free disk space for the new builds. Executing it after rebuilds would also remove the newly created build cache.

---

## 4. Rollback Strategy

```bash
# Build cache, dangling images, and orphaned volumes CANNOT be restored once pruned.
# This is an irreversible operation.
# Mitigation: Only prune AFTER verifying all active containers are running.
# If an image was accidentally pruned, rebuild it:
docker build -t argos:dev -f docker/Dockerfile --target builder .
docker build -t argos-hackrf-backend:dev -f hackrf_emitter/backend/Dockerfile hackrf_emitter/backend/

# Volumes: If an active volume was accidentally removed, it will be recreated
# on next container start but data will be lost. This is why we only remove
# orphaned volumes that are NOT used by any running container.
```

---

## 5. Subtask Details

### Subtask 6.1.10.1: Prune Build Cache

**Description**: Docker BuildKit has accumulated 21.01 GB of build cache across 153 cache entries, all inactive. This is from iterative Dockerfile development and should be reclaimed. Build cache can always be regenerated on the next build -- it only speeds up subsequent builds.

**Files affected**:

- No files -- Docker daemon storage only

**Changes**: Execute build cache prune.

**Verification commands (pre-execution)**:

```bash
# Record current build cache size
docker system df
# Note the "Build Cache" SIZE and RECLAIMABLE values
# Expected: ~21 GB RECLAIMABLE

# Count cache entries
docker buildx du 2>/dev/null | tail -1
# Expected: total size ~21 GB
```

**Execution**:

```bash
docker builder prune --all --force
```

**Verification commands (post-execution)**:

```bash
# Verify build cache cleared
docker system df
# Expected: Build Cache RECLAIMABLE near 0
# Expected: approximately 21 GB reclaimed

# Verify all active containers still running
docker ps --format '{{.Names}}' | sort
# Expected: argos-dev, argos-ollama, hackrf-backend-dev, portainer
```

**Acceptance criteria**:

- Build cache reclaimable drops to under 500 MB.
- All 4 active containers still running after prune.
- No tagged images removed.

---

### Subtask 6.1.10.2: Remove Dangling Image

**Description**: One dangling image (no repository/tag) exists at 1.86 GB. This is a previous build of the argos image that was superseded. Dangling images serve no purpose -- they are intermediate layers from previous builds that are no longer referenced by any tagged image.

**Files affected**:

- No files -- Docker daemon storage only

**Changes**: Execute image prune.

**Verification commands (pre-execution)**:

```bash
# List dangling images
docker images --filter "dangling=true"
# Expected: 1 image, ~1.86 GB

# Verify no running container uses a dangling image
docker images --filter "dangling=true" --format '{{.ID}}' | while read id; do
  docker ps --filter "ancestor=$id" --format '{{.Names}}'
done
# Expected: empty (no running containers use dangling images)
```

**Execution**:

```bash
docker image prune --force
```

**Verification commands (post-execution)**:

```bash
# Verify zero dangling images
docker images --filter "dangling=true"
# Expected: 0 images listed

# Verify all tagged images still present
docker images --format '{{.Repository}}:{{.Tag}}' | sort
# Expected: argos:dev, argos-hackrf-backend:dev, ollama/ollama:latest, portainer/portainer-ce:latest
```

**Acceptance criteria**:

- Zero dangling images remain.
- All tagged images still present: argos:dev, argos-hackrf-backend:dev, ollama/ollama:latest, portainer/portainer-ce:latest.
- All 4 active containers still running.

---

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

**Files affected**:

- No files -- Docker daemon storage only

**Changes**: Remove orphaned volumes.

Note: `docker_openwebrx-hackrf-settings` is used by the `openwebrx` service when started with the `tools` profile. It contains OpenWebRX configuration. Before deleting, confirm it is not needed.

**Verification commands (pre-execution)**:

```bash
# List all volumes
docker volume ls
# Expected: 11 volumes

# Identify orphaned volumes (not used by any running container)
docker volume ls -q | while read vol; do
  used=$(docker ps -q --filter "volume=$vol" 2>/dev/null | wc -l)
  if [ "$used" = "0" ]; then echo "ORPHAN: $vol"; fi
done
# Expected: lists orphaned volumes

# Check OpenWebRX volume creation date
docker volume inspect docker_openwebrx-hackrf-settings --format '{{.CreatedAt}}' 2>/dev/null
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
# Count remaining volumes
docker volume ls -q | wc -l
# Expected: 5 or 6 (down from 11)

# Verify active volumes intact
docker volume ls -q | grep 'docker_argos-node-modules'
# Expected: docker_argos-node-modules

docker volume ls -q | grep 'docker_ollama-data'
# Expected: docker_ollama-data

docker volume ls -q | grep 'portainer_data'
# Expected: portainer_data

# Verify docker system df shows minimal reclaimable
docker system df
# Expected: Local Volumes RECLAIMABLE near 0

# Verify all containers still running
docker ps --format '{{.Names}}' | sort
# Expected: argos-dev, argos-ollama, hackrf-backend-dev, portainer
```

**Acceptance criteria**:

- Orphaned volumes with old stack prefixes deleted.
- Active volumes intact and containers unaffected.
- `docker volume ls` shows only actively-used volumes (5 or 6).
- All 4 containers still running and healthy.

---

## 6. Verification Commands

All verification commands are embedded within each subtask above. Summary of key verification steps:

```bash
# V1: Build cache reclaimed
docker system df | grep "Build Cache"
# Expected: RECLAIMABLE < 500 MB

# V2: No dangling images
docker images --filter "dangling=true" -q | wc -l
# Expected: 0

# V3: Orphaned volumes removed
docker volume ls -q | wc -l
# Expected: 5 or 6

# V4: All containers running
docker ps --format '{{.Names}}' | sort
# Expected: argos-dev, argos-ollama, hackrf-backend-dev, portainer

# V5: Total disk reclaimed (compare to pre-cleanup)
docker system df
# Expected: significant reduction from pre-cleanup values
```

---

## 7. Acceptance Criteria

1. Build cache reclaimable drops to under 500 MB (approximately 21 GB reclaimed).
2. Zero dangling images remain (approximately 1.86 GB reclaimed).
3. Orphaned volumes with old stack prefixes deleted (approximately 1.22 GB reclaimed).
4. All tagged images still present and functional.
5. All active volumes intact (docker_argos-node-modules, docker_argos-svelte-kit, docker_argos-atuin-data, docker_ollama-data, portainer_data).
6. All 4 active containers still running and healthy.
7. `docker system df` shows total reclaimable near 0 across all categories.
8. Total disk reclamation approximately 24 GB (actual value documented by pre/post comparison).

---

## 8. Traceability

| Finding | Description                                                                       | Severity | Subtask                      |
| ------- | --------------------------------------------------------------------------------- | -------- | ---------------------------- |
| F27     | 24.09 GB reclaimable Docker disk (build cache, dangling images, orphaned volumes) | MEDIUM   | 6.1.10.1, 6.1.10.2, 6.1.10.3 |

---

## 9. Execution Order Notes

This task is in **Phase 1 (Parallel)** of the execution order:

```
Phase 0 (IMMEDIATE): 6.1.2.6 (Flask debug -- RCE remediation)
Phase 1 (Parallel): 6.1.4, 6.1.5, 6.1.9, >>> 6.1.10 (THIS TASK) <<<, 6.1.11
Phase 2 (Sequential): 6.1.1, 6.1.7
Phase 3 (Sequential): 6.1.6
Phase 4 (Sequential): 6.1.2, 6.1.3, 6.1.8
```

**Requires**: Nothing -- this task has zero dependencies and can be executed immediately after Phase 0.
**Blocks**: Nothing directly, but should be executed BEFORE Phase 2 image rebuilds to free disk space.
**Parallel with**: Tasks 6.1.4, 6.1.5, 6.1.9, 6.1.11 -- all can execute concurrently.

**IMPORTANT TIMING**: Execute subtasks in order (6.1.10.1 -> 6.1.10.2 -> 6.1.10.3) because build cache prune first is safest (no risk to running containers), then dangling images, then orphaned volumes. Record `docker system df` output before and after each subtask for audit trail.

Total estimated execution time: 5-10 minutes.

**END OF DOCUMENT**
