# Phase 6.1.02: Docker Compose Security Hardening

**Document ID**: ARGOS-AUDIT-P6.1.02
**Parent Document**: Phase-6.1-DOCKER-AND-CONTAINER-MODERNIZATION.md
**Original Task ID**: 6.1.2
**Version**: 1.0
**Date**: 2026-02-08
**Author**: Claude Opus 4.6 (Lead Audit Agent)
**Classification**: UNCLASSIFIED // FOR OFFICIAL USE ONLY
**Risk Level**: HIGH -- Reducing privileges may break WiFi monitor mode, Kismet process management, or Docker-in-Docker tool launching. Each subtask must be tested individually before proceeding.
**Review Standard**: CIS Docker Benchmark v1.6, DISA STIG Docker Enterprise V2R1, NIST SP 800-190

---

> **P0 CRITICAL -- FLASK_DEBUG=1 IS A REMOTE CODE EXECUTION (RCE) VECTOR**
>
> FLASK_DEBUG=1 with Werkzeug's interactive debugger enabled is a Remote Code Execution (RCE) vector. Any user on the local network can execute arbitrary Python code via the debugger console at port 8092. On a military training network, this is a live exploit. Remediation: Remove FLASK_DEBUG=1 immediately from docker-compose.portainer-dev.yml:90. Create a separate docker-compose.dev-debug.yml overlay for explicit debug sessions only.
>
> This finding is addressed in Subtask 6.1.2.6 below and MUST be executed FIRST among all security hardening subtasks, before privilege reduction or port binding changes. The traceability matrix entry F7 is reclassified from HIGH to CRITICAL (P0).

---

## 1. Objective

Reduce the attack surface of the argos-dev container from its current configuration of `privileged: true` + `pid: host` + `network_mode: host` + Docker socket mount (effectively root on the host) to the minimum privilege set required for WiFi monitor mode and USB hardware access.

---

## 2. Prerequisites

| Prerequisite                         | Verification Command                                                                     | Expected Output                                        |
| ------------------------------------ | ---------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Docker Engine 27.x                   | `docker --version`                                                                       | Docker version 27.5.1 or later                         |
| Docker Compose v2                    | `docker compose version`                                                                 | Docker Compose version 2.32.4-3 or later               |
| All 4 containers running             | `docker ps --format '{{.Names}}' \| sort`                                                | argos-dev, argos-ollama, hackrf-backend-dev, portainer |
| Backup of compose files              | `cp docker/docker-compose.portainer-dev.yml docker/docker-compose.portainer-dev.yml.bak` | File exists                                            |
| Images rebuilt (Phase 2 complete)    | `docker images argos:dev --format '{{.CreatedAt}}'`                                      | Recent timestamp                                       |
| Phase-6.1.01 Dockerfile restructured | Builder/devtools stages verified                                                         | See Phase-6.1.01 acceptance criteria                   |

**CRITICAL PREREQUISITE for Subtask 6.1.2.3 (pid:host removal)**:

```bash
grep -rn 'hostExec' src/ --include='*.ts' | wc -l
# MUST return 0. If >0, DO NOT proceed -- hostExec() uses nsenter -t 1 -m
# which requires pid:host. See Phase-6.1.11 Subtask 6.1.11.2.
```

---

## 3. Dependencies

| Dependency                        | Direction                  | Description                                                                |
| --------------------------------- | -------------------------- | -------------------------------------------------------------------------- |
| Phase-6.1.01 (Dockerfile stages)  | **BLOCKS THIS TASK**       | Images must be rebuilt from restructured Dockerfile before compose changes |
| Phase-6.1.06 (Layer optimization) | **BLOCKS THIS TASK**       | Runner stage non-root user must be in place for full security posture      |
| Phase-6.1.11 Subtask 6.1.11.2     | **BLOCKS Subtask 6.1.2.3** | hostExec() refactoring must be complete before pid:host can be removed     |
| Phase-6.1.03 (Resource limits)    | **BLOCKED BY THIS TASK**   | Resource limits should be applied after compose security changes           |
| Subtask 6.1.2.6 (Flask debug)     | **EXECUTE FIRST**          | P0 RCE remediation -- zero dependencies, execute before all other subtasks |

---

## 4. Rollback Strategy

```bash
# Restore backed-up compose file
cp docker/docker-compose.portainer-dev.yml.bak docker/docker-compose.portainer-dev.yml

# Recreate all containers from restored compose
docker compose -f docker/docker-compose.portainer-dev.yml up -d

# Verify all containers healthy
docker ps --format 'table {{.Names}}\t{{.Status}}'
```

---

## 5. Subtask Details

### Subtask 6.1.2.6: Disable Flask Debug Mode in hackrf-backend [EXECUTE FIRST -- P0]

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

---

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

---

### Subtask 6.1.2.3: Remove pid:host Namespace Sharing

> **WARNING -- PREREQUISITE CHECK REQUIRED BEFORE EXECUTION**
>
> Before executing this subtask, verify that ALL `hostExec()` call sites have been refactored:
>
> ```bash
> grep -rn 'hostExec' src/ --include='*.ts' | wc -l
> # MUST return 0. If >0, DO NOT proceed -- hostExec() uses nsenter -t 1 -m
> # which requires pid:host. Removing pid:host will break all GSM-Evil
> # functionality (20+ call sites in src/routes/api/gsm-evil/) and any other
> # hostExec() consumers. See Phase-6.1.11 Subtask 6.1.11.2 for the full
> # dependency analysis.
> ```

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

---

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

---

#### Privilege Reduction Validation Checklist

After each service's privilege reduction (Subtasks 6.1.2.1 and 6.1.2.4), the following hardware tests MUST pass:

- **argos**: `iw dev wlan0 scan` returns results (WiFi monitor mode), `docker ps` works (container management)
- **hackrf-backend**: `hackrf_info` returns device serial number, `lsusb | grep 1d50:6089` shows HackRF
- **openwebrx**: SDR device enumeration succeeds, WebSDR waterfall renders

If ANY test fails, revert to `privileged: true` for that service and document the specific missing capability. The missing capability can then be added surgically (e.g., `SYS_ADMIN` instead of full privileged mode) in a follow-up iteration.

---

#### Docker User Namespace Remapping (DISA STIG V-235819)

User namespace remapping (`userns-remap` in Docker daemon config) prevents container root from mapping to host root. Evaluation:

- **PREREQUISITE**: `privileged: true` must be removed first (userns-remap is incompatible with privileged mode)
- **COMPATIBILITY**: Requires testing with USB device passthrough (HackRF, WiFi adapters)
- **RECOMMENDATION**: Evaluate after privilege reduction is complete. If USB passthrough breaks under userns-remap, document as accepted risk with compensating control (AppArmor profile).
- **VERIFICATION**: `docker info | grep 'User Namespace'` shows remapping active

---

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

---

## 6. Verification Commands

All verification commands are embedded within each subtask above. The parent document's verification checklist entries relevant to this task:

| #   | Check                    | Command                                                                                           | Expected                         |
| --- | ------------------------ | ------------------------------------------------------------------------------------------------- | -------------------------------- |
| V7  | argos not privileged     | `docker inspect argos-dev --format '{{.HostConfig.Privileged}}'`                                  | false                            |
| V8  | hackrf not privileged    | `docker inspect hackrf-backend-dev --format '{{.HostConfig.Privileged}}'`                         | false                            |
| V9  | No docker.sock mount     | `docker inspect argos-dev --format '{{range .Mounts}}{{.Source}} {{end}}' \| grep -c docker.sock` | 0                                |
| V10 | No pid:host              | `docker inspect argos-dev --format '{{.HostConfig.PidMode}}'`                                     | "" (empty)                       |
| V11 | Ports bound to localhost | See Subtask 6.1.2.5 verification commands                                                         | All non-argos ports on 127.0.0.1 |
| V12 | Flask debug off          | `docker exec hackrf-backend-dev env \| grep FLASK_DEBUG`                                          | FLASK_DEBUG=0                    |

---

## 7. Acceptance Criteria

1. **Subtask 6.1.2.6 [P0]**: FLASK_DEBUG=0, FLASK_ENV=production, Werkzeug debugger inaccessible, API functional.
2. **Subtask 6.1.2.1**: argos container Privileged=false, explicit capabilities, no-new-privileges, Kismet functional.
3. **Subtask 6.1.2.2**: Docker socket not mounted, Argos UI loads, broken Docker-management features documented.
4. **Subtask 6.1.2.3**: PidMode empty (BLOCKED until hostExec refactoring complete -- see Phase-6.1.11).
5. **Subtask 6.1.2.4**: hackrf-backend Privileged=false, CapDrop ALL, USB device accessible, non-root user effective.
6. **Subtask 6.1.2.5**: All non-argos ports bound to 127.0.0.1 only.

---

## 8. Traceability

| Finding | Description                                                                          | Severity          | Subtask                   |
| ------- | ------------------------------------------------------------------------------------ | ----------------- | ------------------------- |
| F1      | argos runs privileged + pid:host + network:host + docker.sock = zero containment     | CRITICAL          | 6.1.2.1, 6.1.2.2, 6.1.2.3 |
| F5      | Docker socket mount enables full host Docker API access                              | CRITICAL          | 6.1.2.2                   |
| F7      | Flask debug mode (FLASK_DEBUG=1) = RCE vector (network-accessible Werkzeug debugger) | **CRITICAL (P0)** | 6.1.2.6 (EXECUTE FIRST)   |
| F10     | 8 ports exposed to all network interfaces                                            | HIGH              | 6.1.2.5                   |
| F13     | hackrf-backend uses privileged:true                                                  | HIGH              | 6.1.2.4                   |
| F14     | No no-new-privileges, cap_drop:ALL                                                   | MEDIUM            | 6.1.2.1, 6.1.2.4          |

---

## 9. Execution Order Notes

**Subtask 6.1.2.6** is in **Phase 0 (IMMEDIATE)** -- it has zero dependencies and eliminates a live RCE vector. Execute before ALL other tasks.

The remaining subtasks (6.1.2.1-6.1.2.5) are in **Phase 4** of the execution order:

```
Phase 0 (IMMEDIATE): >>> 6.1.2.6 (THIS SUBTASK -- Flask debug) <<<
Phase 1 (Parallel): 6.1.4, 6.1.5, 6.1.9, 6.1.10, 6.1.11
Phase 2 (Sequential): 6.1.1, 6.1.7
Phase 3 (Sequential): 6.1.6
Phase 4 (Sequential): >>> 6.1.2.1-6.1.2.5 (REMAINING SUBTASKS) <<<, 6.1.3, 6.1.8
```

**Requires**: Phase-6.1.01 (Dockerfile stages) and Phase-6.1.06 (Layer optimization) must be complete.
**Blocks**: Phase-6.1.03 (Resource limits) requires compose changes from this task.
**BLOCKED**: Subtask 6.1.2.3 (pid:host removal) BLOCKED by Phase-6.1.11 Subtask 6.1.11.2 (hostExec dependency documentation).

Total estimated execution time: 30-45 minutes (excluding image rebuilds).

**END OF DOCUMENT**
