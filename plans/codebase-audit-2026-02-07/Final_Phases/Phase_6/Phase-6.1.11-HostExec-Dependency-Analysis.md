# Phase 6.1.11: Independent Audit Security Remediations

**Document ID**: ARGOS-AUDIT-P6.1.11
**Parent Document**: Phase-6.1-DOCKER-AND-CONTAINER-MODERNIZATION.md
**Original Task ID**: 6.1.11
**Version**: 1.0
**Date**: 2026-02-08
**Author**: Claude Opus 4.6 (Lead Audit Agent)
**Classification**: UNCLASSIFIED // FOR OFFICIAL USE ONLY
**Risk Level**: HIGH -- Includes two CRITICAL findings (credential exposure and silent breakage of GSM-Evil subsystem) and two HIGH findings (unmitigated privileged container, unbounded logging on constrained hardware).
**Review Standard**: CIS Docker Benchmark v1.6, DISA STIG Docker Enterprise V2R1, NIST SP 800-190

---

## 1. Objective

Address all 7 actionable findings (CRITICAL-D1, CRITICAL-D2, HIGH-D3, HIGH-D4, MEDIUM-D5, MEDIUM-D6, LOW-D8) from the independent verification audit dated 2026-02-08. These findings were identified as gaps in the original plan and are promoted from the Appendix into proper subtasks with full specification. The findings span credential exposure, container privilege escalation, logging exhaustion, debug flag exposure, network-exposed attack tools, and git history auditing.

---

## 2. Prerequisites

| Prerequisite                        | Verification Command                                                                     | Expected Output                                        |
| ----------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Docker Engine 27.x                  | `docker --version`                                                                       | Docker version 27.5.1 or later                         |
| Docker Compose v2                   | `docker compose version`                                                                 | Docker Compose version 2.32.4-3 or later               |
| All 4 containers running            | `docker ps --format '{{.Names}}' \| sort`                                                | argos-dev, argos-ollama, hackrf-backend-dev, portainer |
| Backup of compose files             | `cp docker/docker-compose.portainer-dev.yml docker/docker-compose.portainer-dev.yml.bak` | File exists                                            |
| Backup of ollama compose            | `cp docker/docker-compose.ollama.yml docker/docker-compose.ollama.yml.bak`               | File exists                                            |
| Backup of portainer compose         | `cp docker/docker-compose.portainer.yml docker/docker-compose.portainer.yml.bak`         | File exists                                            |
| Git working tree clean (or stashed) | `git status --porcelain \| wc -l`                                                        | 0 (or known untracked-only count)                      |

---

## 3. Dependencies

| Dependency                      | Direction                           | Description                                                                                   |
| ------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------- |
| None                            | **BLOCKS THIS TASK**                | Subtasks 6.1.11.1-6.1.11.7 have no inbound dependencies and can execute in Phase 1 (Parallel) |
| Phase-6.1.02 Subtask 6.1.2.3    | **6.1.11.2 BLOCKS Subtask 6.1.2.3** | hostExec() dependency documentation must be complete before pid:host can be removed           |
| Phase-6.1.02 (Compose security) | **Related**                         | Subtask 6.1.11.3 (openwebrx privileges) complements Subtasks 6.1.2.1 and 6.1.2.4              |
| Phase-6.1.05 (Credentials)      | **Related**                         | Subtask 6.1.11.7 (git history audit) complements the credential externalization               |

---

## 4. Rollback Strategy

```bash
# Restore backed-up compose files
cp docker/docker-compose.portainer-dev.yml.bak docker/docker-compose.portainer-dev.yml
cp docker/docker-compose.portainer.yml.bak docker/docker-compose.portainer.yml
cp docker/docker-compose.ollama.yml.bak docker/docker-compose.ollama.yml

# Recreate all containers from restored compose
docker compose -f docker/docker-compose.portainer-dev.yml up -d
docker compose -f docker/docker-compose.portainer.yml up -d
docker compose -f docker/docker-compose.ollama.yml up -d

# Verify all containers healthy
docker ps --format 'table {{.Names}}\t{{.Status}}'
```

---

## 5. Subtask Details

### Subtask 6.1.11.1: Mount ~/.claude Read-Only

**Description**: The `~/.claude` directory (containing `.credentials.json` with Claude API tokens, `history.jsonl`, `settings.json`) is mounted read-write into the argos-dev container at line 60 of the compose file. Any process inside the privileged container has full access to read AND modify Claude API credentials. CIS Docker Benchmark 5.5 and DISA STIG V-235832 both require that host credential directories not be mounted writable into containers. Changing the mount to read-only prevents credential exfiltration or tampering from inside the container while preserving the Claude Code CLI's ability to read its configuration.

**Files affected**:

- `docker/docker-compose.portainer-dev.yml` -- Line 60

**Changes**: Replace the volume mount:

```yaml
# Before:
- ${HOME}/.claude:/root/.claude:rw
# After:
- ${HOME}/.claude:/root/.claude:ro
```

If Claude Code CLI requires write access to specific files (e.g., `history.jsonl`), create a named volume for writable state and mount it at `/root/.claude/history` separately, keeping the credential files read-only.

**Verification commands**:

```bash
# Recreate container
docker compose -f docker/docker-compose.portainer-dev.yml up -d argos

# Verify mount is read-only
docker inspect argos-dev --format '{{range .Mounts}}{{if eq .Destination "/root/.claude"}}{{.RW}}{{end}}{{end}}'
# Expected: false

# Verify Claude Code can still read config
docker exec argos-dev ls /root/.claude/settings.json 2>/dev/null
# Expected: file exists (readable)

# Verify container cannot write to .claude
docker exec argos-dev touch /root/.claude/test-write 2>&1
# Expected: "Read-only file system" or "Permission denied"

# Verify health check still passes
docker inspect argos-dev --format '{{.State.Health.Status}}'
# Expected: healthy (after start_period)
```

**Acceptance criteria**:

- `docker inspect` confirms mount is read-only (RW: false).
- Claude Code CLI can read its configuration files inside the container.
- No process inside the container can modify host `~/.claude` directory.
- Container starts and health check passes.

---

### Subtask 6.1.11.2: Document hostExec()/nsenter Dependency Before pid:host Removal

**Description**: The `hostExec()` function in `src/lib/server/host-exec.ts` uses `nsenter -t 1 -m` to escape the container namespace and execute commands on the host. This mechanism requires `pid: host` (docker-compose.portainer-dev.yml L23) because `nsenter -t 1` targets PID 1, which is only the host init process when the container shares the host PID namespace. Subtask 6.1.2.3 proposes removing `pid: host` but does not account for the 20+ `hostExec()` call sites, primarily in `src/routes/api/gsm-evil/`. Removing `pid:host` without first refactoring these call sites will silently break all GSM-Evil functionality (IMSI capture, frequency scanning, cell tower monitoring).

**Files affected**:

- `src/lib/server/host-exec.ts` -- Primary hostExec() definition (read-only audit)
- `src/routes/api/gsm-evil/*.ts` -- 20+ files consuming hostExec() (read-only audit)

**Changes**:

1. Add an explicit prerequisite to Subtask 6.1.2.3 (already done via the WARNING block in Phase-6.1.02).
2. Document ALL hostExec() call sites by running the enumeration command.
3. Create a migration plan reference (out of scope for this phase) that replaces `hostExec()` with one of:
    - A host-side HTTP API that the container calls via localhost
    - A Docker sidecar pattern where GSM tools run in their own container
    - Direct device access via capabilities instead of host command execution
4. Until hostExec() is fully refactored, `pid: host` MUST remain in the compose file. Update the Subtask 6.1.2.3 status to BLOCKED.

**Verification commands**:

```bash
# Count all hostExec() consumers
grep -rn 'hostExec' src/ --include='*.ts' | wc -l
# Document the count -- this is the number of call sites that must be refactored
# before Subtask 6.1.2.3 can proceed

# List all files consuming hostExec()
grep -rn 'hostExec' src/ --include='*.ts' -l
# Document this list as the refactoring scope for Phase 7

# Verify pid:host is still present (MUST NOT be removed yet)
grep -n 'pid: host' docker/docker-compose.portainer-dev.yml
# Expected: match found (pid:host still in place)

# Verify the WARNING block exists in Phase-6.1.02
grep -c 'PREREQUISITE CHECK REQUIRED' plans/codebase-audit-2026-02-07/Final_Phases/Phase_6/Phase-6.1.02-Docker-Compose-Security-Hardening.md
# Expected: 1 or more matches
```

**Acceptance criteria**:

- Complete enumeration of all `hostExec()` call sites documented in this subtask output.
- Subtask 6.1.2.3 has a WARNING block noting the prerequisite (verified above).
- `pid: host` remains in the compose file until all call sites are refactored.
- Migration plan for hostExec() replacement documented as a Phase 7 follow-up item.

---

### Subtask 6.1.11.3: Reduce openwebrx Privileges

**Description**: The openwebrx service at line 124 of the compose file uses `privileged: true`. This is one of three services with full privileges, but Subtasks 6.1.2.1 and 6.1.2.4 only address argos and hackrf-backend. OpenWebRX requires USB device access for SDR hardware but does not need full host capabilities. The required access can be provided via `cap_add: [SYS_RAWIO]` with explicit device passthrough.

**Files affected**:

- `docker/docker-compose.portainer-dev.yml` -- Line 124 (openwebrx service)

**Changes**: Replace:

```yaml
privileged: true
```

With:

```yaml
cap_add:
    - SYS_RAWIO
cap_drop:
    - ALL
security_opt:
    - no-new-privileges:true
devices:
    - /dev/bus/usb:/dev/bus/usb
```

Note: The `devices:` block may already exist for openwebrx. If so, retain the existing device mapping and only replace the `privileged: true` line with the `cap_add`/`cap_drop`/`security_opt` block.

**Verification commands**:

```bash
# Start openwebrx with tools profile
docker compose -f docker/docker-compose.portainer-dev.yml --profile tools up -d openwebrx-hackrf

# Verify privileged is false
docker inspect openwebrx-hackrf --format '{{.HostConfig.Privileged}}'
# Expected: false

# Verify capabilities
docker inspect openwebrx-hackrf --format '{{json .HostConfig.CapAdd}}'
# Expected: ["SYS_RAWIO"]

docker inspect openwebrx-hackrf --format '{{json .HostConfig.CapDrop}}'
# Expected: ["ALL"]

# Verify no-new-privileges
docker inspect openwebrx-hackrf --format '{{json .HostConfig.SecurityOpt}}'
# Expected: contains "no-new-privileges:true"

# Verify USB device accessible
docker exec openwebrx-hackrf lsusb 2>/dev/null | head -5
# Expected: USB device listing (if SDR hardware connected)

# Verify WebSDR UI loads
curl -sf http://localhost:8073/ | head -1
# Expected: HTML content

# Stop openwebrx (on-demand service)
docker compose -f docker/docker-compose.portainer-dev.yml --profile tools stop openwebrx-hackrf
```

**Acceptance criteria**:

- `docker inspect` shows `Privileged: false` for openwebrx.
- `CapAdd` contains SYS_RAWIO.
- `CapDrop` contains ALL.
- `no-new-privileges` is true.
- USB devices accessible via device passthrough.
- OpenWebRX web UI loads on port 8073.

---

### Subtask 6.1.11.4: Add Logging Limits to All Compose Services

**Description**: The ollama, hackrf-backend, and portainer services have no `logging:` directive. Runtime confirms `LogConfig.Config: {}` (empty) for all three. On the 8 GB RPi 5 with a 500 GB NVMe, unbounded Docker JSON logging can exhaust disk space during extended field operations or degrade I/O performance when log files grow beyond several GB. The argos service also has no explicit logging config. All services should have explicit logging limits.

**Files affected**:

- `docker/docker-compose.ollama.yml` -- ollama service (add after restart line)
- `docker/docker-compose.portainer-dev.yml` -- hackrf-backend service (add after restart line)
- `docker/docker-compose.portainer-dev.yml` -- argos service (add after restart line)
- `docker/docker-compose.portainer.yml` -- portainer service (add after restart line)

**Changes**: Add the following block to each service:

```yaml
logging:
    driver: json-file
    options:
        max-size: '10m'
        max-file: '3'
```

This caps each service to 30 MB of log storage (3 files x 10 MB each). Total across 4 services: 120 MB maximum.

**Verification commands**:

```bash
# Recreate all services
docker compose -f docker/docker-compose.portainer-dev.yml up -d
docker compose -f docker/docker-compose.portainer.yml up -d
docker compose -f docker/docker-compose.ollama.yml up -d

# Verify logging config for each service
docker inspect argos-dev --format '{{json .HostConfig.LogConfig}}'
# Expected: {"Type":"json-file","Config":{"max-file":"3","max-size":"10m"}}

docker inspect hackrf-backend-dev --format '{{json .HostConfig.LogConfig}}'
# Expected: {"Type":"json-file","Config":{"max-file":"3","max-size":"10m"}}

docker inspect portainer --format '{{json .HostConfig.LogConfig}}'
# Expected: {"Type":"json-file","Config":{"max-file":"3","max-size":"10m"}}

docker inspect argos-ollama --format '{{json .HostConfig.LogConfig}}'
# Expected: {"Type":"json-file","Config":{"max-file":"3","max-size":"10m"}}

# Verify all services have logging limits (machine-parseable check)
for svc in argos-dev hackrf-backend-dev portainer argos-ollama; do
  limit=$(docker inspect "$svc" --format '{{index .HostConfig.LogConfig.Config "max-size"}}')
  echo "$svc: max-size=$limit"
done
# Expected: all show max-size=10m
```

**Acceptance criteria**:

- All 4 active services have `logging.driver: json-file` with `max-size: 10m` and `max-file: 3`.
- `docker inspect` confirms LogConfig for each service shows the configured limits.
- No service uses unbounded logging.
- Total log disk usage capped at 120 MB across all services.

---

### Subtask 6.1.11.5: Remove PUBLIC_ENABLE_DEBUG=true

**Description**: Line 37 of the compose file sets `PUBLIC_ENABLE_DEBUG=true`. SvelteKit's `PUBLIC_` prefix makes this environment variable accessible to client-side JavaScript via `$env/static/public`. If the frontend uses this flag to enable debug panels, verbose logging, or developer tools, it increases the client-side attack surface in production deployments. On a field-deployed military training system, debug interfaces should never be exposed to end users.

**Files affected**:

- `docker/docker-compose.portainer-dev.yml` -- Line 37

**Changes**: Remove the line entirely:

```yaml
# Remove this line:
- PUBLIC_ENABLE_DEBUG=true
```

If a debug mode is needed for development, it should be:

1. Controlled via a non-PUBLIC variable (e.g., `ENABLE_DEBUG=true`) that stays server-side only.
2. Or set only in a development-specific compose override file (e.g., `docker-compose.dev-debug.yml`).

**Verification commands**:

```bash
# Recreate container
docker compose -f docker/docker-compose.portainer-dev.yml up -d argos

# Verify PUBLIC_ENABLE_DEBUG is not set
docker exec argos-dev env | grep PUBLIC_ENABLE_DEBUG
# Expected: no output (variable not present)

# Verify compose file does not contain the variable
grep -n 'PUBLIC_ENABLE_DEBUG' docker/docker-compose.portainer-dev.yml
# Expected: no matches

# Verify no other PUBLIC_ debug flags remain
grep -n 'PUBLIC_.*DEBUG\|PUBLIC_.*DEV' docker/docker-compose.portainer-dev.yml
# Expected: no matches

# Verify app still starts (no dependency on this flag for core functionality)
curl -sf http://localhost:5173/ | head -1
# Expected: HTML content
```

**Acceptance criteria**:

- `PUBLIC_ENABLE_DEBUG` is not present in any compose file.
- No environment variable with `PUBLIC_` prefix exposes debug flags.
- Argos web UI loads and health check passes without the debug flag.

---

### Subtask 6.1.11.6: Bind Bettercap API to Localhost

**Description**: The bettercap service at line 157 of the compose file starts with `-api-rest-address 0.0.0.0`, which binds the Bettercap REST API to all network interfaces. Combined with `network_mode: host`, this exposes the full Bettercap API (which includes network reconnaissance, MITM attack capabilities, and packet injection) to every device on the tactical network. The Bettercap API should only be accessible from localhost, as the Argos UI proxies requests to it.

**Files affected**:

- `docker/docker-compose.portainer-dev.yml` -- Line 157 (bettercap command)

**Changes**: Replace in the bettercap service command:

```yaml
# Before:
-api-rest-address 0.0.0.0
# After:
-api-rest-address 127.0.0.1
```

**Verification commands**:

```bash
# Start bettercap with tools profile
docker compose -f docker/docker-compose.portainer-dev.yml --profile tools up -d bettercap

# Verify the command uses 127.0.0.1
docker inspect bettercap --format '{{json .Config.Cmd}}' | grep -o 'api-rest-address [0-9.]*'
# Expected: api-rest-address 127.0.0.1

# Verify API accessible from localhost
curl -sf -u admin:${BETTERCAP_PASSWORD} http://127.0.0.1:8081/api/session 2>/dev/null | head -1
# Expected: JSON response (if bettercap is running and credentials are correct)

# Verify compose file reflects the change
grep 'api-rest-address' docker/docker-compose.portainer-dev.yml
# Expected: contains 127.0.0.1

# Stop bettercap (on-demand service)
docker compose -f docker/docker-compose.portainer-dev.yml --profile tools stop bettercap
```

**Acceptance criteria**:

- Bettercap REST API binds to `127.0.0.1` only.
- API accessible from localhost inside the host.
- API not accessible from external network interfaces.
- Argos UI can still communicate with Bettercap via localhost proxy.

---

### Subtask 6.1.11.7: Audit Git History for Leaked Secrets

**Description**: Subtask 6.1.5.1 moves hardcoded credentials from compose files to `docker/.env`. However, the credentials (`password`, `hackrf`, `argos`) have been committed to git history in the compose files. Additionally, if any `.env` file was ever accidentally committed, it may contain secrets in the git object store. Before considering credentials externalized, the git history must be audited to confirm no `.env` files with secrets exist in any historical commit.

**Files affected**:

- Git repository history (read-only audit, no file modifications)

**Changes**: No file changes. This is an audit verification step.

**Verification commands**:

```bash
# Check if any .env files exist in git history
git log --all --full-history -- '*/.env' '*.env' --oneline
# Expected: either empty (no .env ever committed) or only commits that
# contain the single-line ARGOS_DIR= entry (no secrets)

# Check for .env content in any historical commit
git log --all --full-history -p -- '*/.env' '*.env' | grep -i 'password\|secret\|token\|api.key' | head -20
# Expected: no matches containing actual secret values

# Verify current compose files still have hardcoded passwords in git history
git log --all --full-history -p -- 'docker/docker-compose.portainer-dev.yml' | grep 'KISMET_PASSWORD=password' | head -5
# Expected: matches found (these are in history -- document but cannot easily remove)

# Check .gitignore covers docker/.env
git check-ignore docker/.env
# Expected: docker/.env (confirms it is ignored going forward)

# Check for any API keys or tokens in git history
git log --all --full-history -p -- '*.ts' '*.js' '*.yml' '*.yaml' | grep -iE 'api[_-]?key\s*[:=]' | grep -v 'process\.env\|CHANGEME\|placeholder\|example' | head -10
# Expected: no matches containing actual API key values
```

**Acceptance criteria**:

- No `.env` file containing secrets exists in any git commit.
- Historical commits containing hardcoded passwords in compose files are documented as accepted risk.
- `.gitignore` prevents future `.env` commits (verified by `git check-ignore`).
- If secrets are found in git history, document whether `git filter-branch` or `bfg` cleanup is needed (out of scope for this phase).

---

## 6. Verification Commands

All verification commands are embedded within each subtask above. The parent document's verification checklist entries relevant to this task:

| #   | Check                            | Command                                                                                                            | Expected                                    |
| --- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------- |
| V23 | ~/.claude mount read-only        | `docker inspect argos-dev --format '{{range .Mounts}}{{if eq .Destination "/root/.claude"}}{{.RW}}{{end}}{{end}}'` | false                                       |
| V24 | hostExec() call sites documented | `grep -rn 'hostExec' src/ --include='*.ts' \| wc -l`                                                               | Documented count (>0 means 6.1.2.3 BLOCKED) |
| V25 | openwebrx not privileged         | `docker inspect openwebrx-hackrf --format '{{.HostConfig.Privileged}}'`                                            | false (when running)                        |
| V26 | Logging limits on all services   | `docker inspect argos-ollama --format '{{json .HostConfig.LogConfig.Config}}'`                                     | {"max-file":"3","max-size":"10m"}           |
| V27 | PUBLIC_ENABLE_DEBUG removed      | `grep -c 'PUBLIC_ENABLE_DEBUG' docker/docker-compose.portainer-dev.yml`                                            | 0                                           |
| V28 | Bettercap API on localhost       | `grep 'api-rest-address' docker/docker-compose.portainer-dev.yml`                                                  | 127.0.0.1                                   |
| V29 | No .env secrets in git history   | `git log --all --full-history -p -- '*/.env' '*.env' \| grep -ic 'password\|secret\|token'`                        | 0 (or documented accepted risk)             |

---

## 7. Acceptance Criteria

1. **Subtask 6.1.11.1**: `~/.claude` mount is read-only (RW: false), Claude Code can read config, cannot write.
2. **Subtask 6.1.11.2**: All hostExec() call sites enumerated and documented, pid:host remains until refactoring complete, Subtask 6.1.2.3 marked BLOCKED.
3. **Subtask 6.1.11.3**: openwebrx Privileged=false, SYS_RAWIO capability, CapDrop ALL, no-new-privileges, USB accessible.
4. **Subtask 6.1.11.4**: All 4 active services have logging limits (json-file, max-size 10m, max-file 3).
5. **Subtask 6.1.11.5**: PUBLIC*ENABLE_DEBUG not present in any compose file, no PUBLIC* debug flags.
6. **Subtask 6.1.11.6**: Bettercap API binds to 127.0.0.1 only, not accessible from external network.
7. **Subtask 6.1.11.7**: Git history audited for leaked secrets, results documented, .gitignore verified.

---

## 8. Traceability

| Finding | Description                                                                     | Severity | Subtask  |
| ------- | ------------------------------------------------------------------------------- | -------- | -------- |
| F32     | ~/.claude mounted read-write into container (API credentials exposed)           | CRITICAL | 6.1.11.1 |
| F33     | hostExec()/nsenter dependency on pid:host undocumented (GSM-Evil breakage risk) | CRITICAL | 6.1.11.2 |
| F34     | openwebrx privileged:true has no remediation subtask                            | HIGH     | 6.1.11.3 |
| F35     | Ollama/hackrf-backend/portainer have no logging limits                          | HIGH     | 6.1.11.4 |
| F36     | PUBLIC_ENABLE_DEBUG=true exposes debug flag to browser                          | MEDIUM   | 6.1.11.5 |
| F37     | Bettercap API binds to 0.0.0.0 (network-exposed attack tools)                   | MEDIUM   | 6.1.11.6 |
| F38     | No git history audit for leaked .env secrets                                    | LOW      | 6.1.11.7 |

---

## 9. Execution Order Notes

This task is in **Phase 1 (Parallel)** of the execution order:

```
Phase 0 (IMMEDIATE): 6.1.2.6 (Flask debug -- RCE remediation)
Phase 1 (Parallel): 6.1.4, 6.1.5, 6.1.9, 6.1.10, >>> 6.1.11 (THIS TASK) <<<
Phase 2 (Sequential): 6.1.1, 6.1.7
Phase 3 (Sequential): 6.1.6
Phase 4 (Sequential): 6.1.2, 6.1.3, 6.1.8
```

**Requires**: Nothing -- all 7 subtasks have zero inbound dependencies and can execute immediately after Phase 0.
**Blocks**: Subtask 6.1.11.2 BLOCKS Phase-6.1.02 Subtask 6.1.2.3 (pid:host removal cannot proceed until hostExec() dependency is documented and resolved).
**Parallel with**: Tasks 6.1.4, 6.1.5, 6.1.9, 6.1.10 -- all can execute concurrently.

**Internal execution order**: Subtasks 6.1.11.1 through 6.1.11.7 are independent of each other and can be executed in any order or in parallel. Recommended order for safety:

1. 6.1.11.5 (Remove PUBLIC_ENABLE_DEBUG -- lowest risk)
2. 6.1.11.4 (Add logging limits -- lowest risk)
3. 6.1.11.1 (Mount .claude read-only -- low risk)
4. 6.1.11.6 (Bind Bettercap to localhost -- low risk, on-demand service)
5. 6.1.11.3 (Reduce openwebrx privileges -- medium risk, on-demand service)
6. 6.1.11.2 (Document hostExec -- audit only, no changes)
7. 6.1.11.7 (Audit git history -- audit only, no changes)

Total estimated execution time: 30-45 minutes (including on-demand service startup for verification).

**END OF DOCUMENT**
