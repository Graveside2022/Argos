# Phase 6.1.08: Ollama Compose Memory Limit Verification

**Document ID**: ARGOS-AUDIT-P6.1.08
**Parent Document**: Phase-6.1-DOCKER-AND-CONTAINER-MODERNIZATION.md
**Original Task ID**: 6.1.8
**Version**: 1.0
**Date**: 2026-02-08
**Author**: Claude Opus 4.6 (Lead Audit Agent)
**Classification**: UNCLASSIFIED // FOR OFFICIAL USE ONLY
**Risk Level**: LOW -- Ollama limits are already working; this task adds monitoring and CPU constraints.
**Review Standard**: CIS Docker Benchmark v1.6, DISA STIG Docker Enterprise V2R1, NIST SP 800-190

---

## 1. Objective

Document that the Ollama memory limit IS correctly applied (correcting the earlier audit claim that `deploy.resources.limits.memory` was silently ignored) and verify that the CPU limit and health check added by Task 6.1.3 are functioning. This task serves as a cross-reference verification point to confirm the complete Ollama resource constraint posture after all preceding tasks have been applied.

**Audit Correction**: The original audit claimed "Ollama deploy.resources.limits.memory SILENTLY IGNORED by docker compose (needs Swarm or --compatibility)." This was **FALSE**. Docker Compose v2.32.4 correctly translates `deploy.resources.limits.memory` to the `Memory` cgroup. The Ollama container shows 2,147,483,648 bytes (2 GB) limit at runtime, confirmed by `docker inspect argos-ollama --format '{{json .HostConfig.Memory}}'`.

---

## 2. Prerequisites

| Prerequisite                         | Verification Command                                                       | Expected Output                          |
| ------------------------------------ | -------------------------------------------------------------------------- | ---------------------------------------- |
| Docker Engine 27.x                   | `docker --version`                                                         | Docker version 27.5.1 or later           |
| Docker Compose v2                    | `docker compose version`                                                   | Docker Compose version 2.32.4-3 or later |
| Ollama container running             | `docker ps --format '{{.Names}}' \| grep ollama`                           | argos-ollama                             |
| Phase-6.1.03 resource limits applied | `docker inspect argos-ollama --format '{{.HostConfig.NanoCpus}}'`          | Non-zero value (2000000000)              |
| Phase-6.1.03 health check applied    | `docker inspect argos-ollama --format '{{json .Config.Healthcheck}}'`      | JSON with test, interval, etc.           |
| Backup of ollama compose file        | `cp docker/docker-compose.ollama.yml docker/docker-compose.ollama.yml.bak` | File exists                              |

---

## 3. Dependencies

| Dependency                      | Direction                | Description                                                                                |
| ------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------ |
| Phase-6.1.03 (Resource limits)  | **BLOCKS THIS TASK**     | CPU limits and health checks from Task 6.1.3 must be applied before this verification task |
| Phase-6.1.02 (Compose security) | **BLOCKS THIS TASK**     | Compose security changes should be applied before final verification                       |
| None                            | **BLOCKED BY THIS TASK** | This is a terminal verification task with no downstream dependencies                       |

---

## 4. Rollback Strategy

```bash
# This task is primarily a verification step. If the Ollama container
# is unhealthy after Phase 6.1.3 changes, restore the compose file:
cp docker/docker-compose.ollama.yml.bak docker/docker-compose.ollama.yml

# Recreate container
docker compose -f docker/docker-compose.ollama.yml up -d

# Verify container is running
docker ps --format 'table {{.Names}}\t{{.Status}}' | grep ollama
```

---

## 5. Subtask Details

### Subtask 6.1.8.1: Verify Ollama Resource Constraints

**Description**: The Ollama compose file has a memory limit (confirmed working at 2 GB via `deploy.resources.limits.memory`) but previously lacked a CPU limit and health check. Task 6.1.3 adds both. This subtask verifies all three constraints are correctly applied and functioning together. On CPU-only ARM inference, Ollama can consume all 4 cores during token generation, starving other services. The CPU limit (2.0 cores from Task 6.1.3.1) prevents this starvation.

This subtask is primarily a cross-reference to confirm the Ollama memory limit correction and verify the complete resource constraint posture.

**Files affected**:

- No file changes -- this is a verification-only subtask
- `docker/docker-compose.ollama.yml` -- read for verification (changes made in Task 6.1.3)

**Changes**: No changes. This task serves as a cross-reference to confirm the Ollama memory limit correction and to verify that Task 6.1.3 constraints are applied.

**Verification commands**:

```bash
# V1: Confirm memory limit is applied (correcting earlier audit claim)
docker inspect argos-ollama --format '{{.HostConfig.Memory}}' | awk '{printf "%.0f MB\n", $1/1024/1024}'
# Expected: 2048 MB

# V2: Confirm exact byte value matches compose configuration
docker inspect argos-ollama --format '{{json .HostConfig.Memory}}'
# Expected: 2147483648 (exactly 2 GiB)

# V3: Confirm from Task 6.1.3.1 that CPU limit is applied
docker inspect argos-ollama --format '{{.HostConfig.NanoCpus}}'
# Expected: 2000000000 (2.0 CPUs)

# V4: Confirm from Task 6.1.3.2 that health check is applied
docker inspect argos-ollama --format '{{.State.Health.Status}}'
# Expected: healthy

# V5: Confirm health check configuration details
docker inspect argos-ollama --format '{{json .Config.Healthcheck}}'
# Expected: JSON with test containing curl to /api/tags, interval 60s, timeout 10s

# V6: Verify memory reservation is set (if using deploy.resources.reservations)
docker inspect argos-ollama --format '{{.HostConfig.MemoryReservation}}' | awk '{printf "%.0f MB\n", $1/1024/1024}'
# Expected: 1024 MB (1 GB reservation)

# V7: Verify Ollama API is responsive under resource constraints
curl -sf http://localhost:11434/api/tags
# Expected: JSON response listing available models

# V8: Verify the llama3.2:1b model is available
curl -sf http://localhost:11434/api/tags | python3 -c "import sys,json; d=json.load(sys.stdin); names=[m['name'] for m in d.get('models',[])]; assert any('llama3.2' in n for n in names), f'Model not found in {names}'"
# Expected: no assertion error

# V9: Verify PID limit from Task 6.1.3.1
docker inspect argos-ollama --format '{{.HostConfig.PidsLimit}}'
# Expected: 32

# V10: Combined resource constraint summary
echo "=== Ollama Resource Constraints ==="
echo -n "Memory: "; docker inspect argos-ollama --format '{{.HostConfig.Memory}}' | awk '{printf "%.0f MB\n", $1/1024/1024}'
echo -n "CPU: "; docker inspect argos-ollama --format '{{.HostConfig.NanoCpus}}' | awk '{printf "%.1f cores\n", $1/1000000000}'
echo -n "PIDs: "; docker inspect argos-ollama --format '{{.HostConfig.PidsLimit}}'
echo -n "Health: "; docker inspect argos-ollama --format '{{.State.Health.Status}}'
# Expected: Memory: 2048 MB, CPU: 2.0 cores, PIDs: 32, Health: healthy
```

**Acceptance criteria**:

- Memory limit confirmed at 2 GB (2,147,483,648 bytes) -- correcting earlier audit claim.
- CPU limit of 2.0 applied (from Task 6.1.3.1).
- PIDs limit of 32 applied (from Task 6.1.3.1).
- Health check present and reporting healthy (from Task 6.1.3.2).
- All four constraints verified via `docker inspect`.
- Ollama API responds to requests under resource constraints.
- llama3.2:1b model available and loadable.

---

## 6. Verification Commands

All verification commands are embedded within the subtask above. The parent document's verification checklist entries relevant to this task:

| #   | Check               | Command                                                            | Expected      |
| --- | ------------------- | ------------------------------------------------------------------ | ------------- |
| V6  | Ollama API responds | `curl -sf http://localhost:11434/api/tags`                         | JSON response |
| V13 | CPU limits set      | `docker inspect argos-ollama --format '{{.HostConfig.NanoCpus}}'`  | 2000000000    |
| V14 | PID limits set      | `docker inspect argos-ollama --format '{{.HostConfig.PidsLimit}}'` | 32            |

---

## 7. Acceptance Criteria

1. Memory limit confirmed at exactly 2,147,483,648 bytes (2 GiB) via `docker inspect`.
2. CPU limit of 2.0 cores confirmed via `docker inspect` (NanoCpus = 2000000000).
3. PIDs limit of 32 confirmed via `docker inspect`.
4. Health check present with 60s interval, 10s timeout, and healthy status.
5. Ollama API responds to `/api/tags` endpoint.
6. llama3.2:1b model is available in the model list.
7. The earlier audit claim that `deploy.resources.limits.memory` was silently ignored is formally corrected and documented.
8. All constraints function together without causing Ollama service degradation.

---

## 8. Traceability

| Finding | Description                                      | Severity         | Subtask                          |
| ------- | ------------------------------------------------ | ---------------- | -------------------------------- |
| F28     | Ollama deploy.resources claimed silently ignored | N/A (CORRECTION) | 6.1.8.1 (documenting correction) |
| F31     | No CPU or PIDs limits on any service             | MEDIUM           | 6.1.8.1 (verifying 6.1.3.1 fix)  |
| F29     | No health checks for portainer or ollama         | MEDIUM           | 6.1.8.1 (verifying 6.1.3.2 fix)  |

---

## 9. Execution Order Notes

This task is in **Phase 4** of the execution order:

```
Phase 0 (IMMEDIATE): 6.1.2.6 (Flask debug -- RCE remediation)
Phase 1 (Parallel): 6.1.4, 6.1.5, 6.1.9, 6.1.10, 6.1.11
Phase 2 (Sequential): 6.1.1, 6.1.7
Phase 3 (Sequential): 6.1.6
Phase 4 (Sequential): 6.1.2, 6.1.3, >>> 6.1.8 (THIS TASK) <<<
```

**Requires**: Phase-6.1.03 (Resource limits and health checks) must be complete -- this task verifies those changes for Ollama specifically.
**Blocks**: Nothing -- this is a terminal verification task.

Total estimated execution time: 5 minutes (verification only, no changes).

**END OF DOCUMENT**
