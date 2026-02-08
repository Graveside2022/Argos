# Phase 6.1.05: Credential Externalization

**Document ID**: ARGOS-AUDIT-P6.1.05
**Parent Document**: Phase-6.1-DOCKER-AND-CONTAINER-MODERNIZATION.md
**Original Task ID**: 6.1.5
**Version**: 1.0
**Date**: 2026-02-08
**Author**: Claude Opus 4.6 (Lead Audit Agent)
**Classification**: UNCLASSIFIED // FOR OFFICIAL USE ONLY
**Risk Level**: LOW -- Only changes where credentials are sourced from, not the credentials themselves.
**Review Standard**: CIS Docker Benchmark v1.6, DISA STIG Docker Enterprise V2R1, NIST SP 800-190

---

## 1. Objective

Remove all hardcoded default passwords from version-controlled compose files and externalize them to a `.env` file that is gitignored. Currently, 4 passwords are hardcoded in compose files that are checked into git. Dictionary-word defaults (`password`, `hackrf`, `argos`) in a military-deployed system are unacceptable. Compose files must use fail-fast `${VAR:?error}` syntax that refuses to start if credentials are not explicitly configured.

---

## 2. Prerequisites

| Prerequisite                        | Verification Command                                                                     | Expected Output                          |
| ----------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------- |
| Docker Engine 27.x                  | `docker --version`                                                                       | Docker version 27.5.1 or later           |
| Docker Compose v2                   | `docker compose version`                                                                 | Docker Compose version 2.32.4-3 or later |
| Backup of compose files             | `cp docker/docker-compose.portainer-dev.yml docker/docker-compose.portainer-dev.yml.bak` | File exists                              |
| Backup of docker/.env               | `cp docker/.env docker/.env.bak`                                                         | File exists                              |
| Git working tree clean (or stashed) | `git status --porcelain \| wc -l`                                                        | 0 (or known untracked-only count)        |
| docker/.env exists                  | `ls docker/.env`                                                                         | File exists                              |

---

## 3. Dependencies

| Dependency                      | Direction                | Description                                                                                            |
| ------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------ |
| None                            | **BLOCKS THIS TASK**     | This task has no inbound dependencies and can execute in Phase 1 (Parallel)                            |
| Phase-6.1.02 (Compose security) | **BLOCKED BY THIS TASK** | Compose security hardening should apply after credentials are externalized                             |
| Phase-6.1.11 Subtask 6.1.11.7   | **Related**              | Git history audit for leaked secrets should verify that credentials were never committed in .env files |

---

## 4. Rollback Strategy

```bash
# Restore backed-up compose file and .env
cp docker/docker-compose.portainer-dev.yml.bak docker/docker-compose.portainer-dev.yml
cp docker/.env.bak docker/.env

# Recreate containers
docker compose -f docker/docker-compose.portainer-dev.yml up -d

# Verify containers start with restored hardcoded credentials
docker ps --format 'table {{.Names}}\t{{.Status}}'
```

---

## 5. Subtask Details

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

**Verification commands**:

```bash
# Verify .env contains all credentials
grep -c 'KISMET_PASSWORD' docker/.env
# Expected: 1

grep -c 'OPENWEBRX_PASSWORD' docker/.env
# Expected: 1

grep -c 'BETTERCAP_PASSWORD' docker/.env
# Expected: 1

# Verify no literal passwords remain in compose file
grep -n 'KISMET_PASSWORD=password' docker/docker-compose.portainer-dev.yml
# Expected: no matches

grep -n 'OPENWEBRX_PASSWORD:-hackrf' docker/docker-compose.portainer-dev.yml
# Expected: no matches

grep -n 'BETTERCAP_PASSWORD:-argos' docker/docker-compose.portainer-dev.yml
# Expected: no matches

# Verify compose file uses fail-fast syntax
grep -c ':?' docker/docker-compose.portainer-dev.yml
# Expected: 5 (KISMET_USER, KISMET_PASSWORD, OPENWEBRX_PASSWORD, BETTERCAP_USER, BETTERCAP_PASSWORD)

# Validate compose file parses correctly with .env populated
docker compose -f docker/docker-compose.portainer-dev.yml config --quiet
# Expected: exit 0 with no output

# Verify that removing .env causes compose to fail
mv docker/.env docker/.env.tmp
docker compose -f docker/docker-compose.portainer-dev.yml config --quiet 2>&1 | head -3
# Expected: error about missing required variable
mv docker/.env.tmp docker/.env
```

**Acceptance criteria**:

- `docker/.env` contains all credentials previously hardcoded in compose files.
- No password with a dictionary-word default remains in any compose file.
- Compose files use `${VAR:?error}` syntax (fail-fast if env var missing).
- `docker compose config --quiet` succeeds when docker/.env is populated.
- `docker compose config` fails when docker/.env is absent (fail-fast verified).

---

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

**Verification commands**:

```bash
# Verify file exists
ls docker/.env.example
# Expected: file exists

# Verify file does NOT contain actual passwords
grep -c 'password\b' docker/.env.example
# Expected: 0 (no literal "password" as a value)

# Verify file IS committable (not gitignored)
git check-ignore docker/.env.example
# Expected: empty output (not ignored)

# Verify all required variables are documented
grep -c 'KISMET_PASSWORD' docker/.env.example
# Expected: 1

grep -c 'OPENWEBRX_PASSWORD' docker/.env.example
# Expected: 1

grep -c 'BETTERCAP_PASSWORD' docker/.env.example
# Expected: 1
```

**Acceptance criteria**:

- `docker/.env.example` exists with placeholder values (empty password fields).
- File does NOT contain actual secret values.
- File is NOT gitignored (can be committed to version control).
- All required variables are documented with comments.

---

### Subtask 6.1.5.3: Ensure docker/.env Is Gitignored

**Description**: Verify that `docker/.env` is in `.gitignore` and will not be accidentally committed. The root `.gitignore` may already cover `.env` but we must verify it covers the `docker/` subdirectory path.

**Files affected**:

- `.gitignore` -- Verify or add entry

**Changes**: If `docker/.env` is not already gitignored, add `docker/.env` to `.gitignore`.

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

# Verify .env file has restrictive permissions
ls -la docker/.env
# Expected: -rw------- (mode 0600) or similar restrictive permissions
```

**Acceptance criteria**:

- `docker/.env` is gitignored (verified by `git check-ignore`).
- `docker/.env.example` is NOT gitignored (can be committed).
- `.env` file permissions are 0600 or more restrictive.
- `git status` does not show `docker/.env` as untracked or modified.

---

## 6. Verification Commands

All verification commands are embedded within each subtask above. Summary of key verification steps:

```bash
# V1: No hardcoded passwords in compose
grep -n 'password\|hackrf\|argos' docker/docker-compose.portainer-dev.yml | grep -iv '\${'
# Expected: Only comments or non-credential strings

# V2: .env.example exists
ls docker/.env.example
# Expected: file exists

# V3: docker/.env gitignored
git check-ignore docker/.env
# Expected: docker/.env

# V4: Fail-fast syntax in compose
grep -c ':?' docker/docker-compose.portainer-dev.yml
# Expected: 5

# V5: Compose validates with .env
docker compose -f docker/docker-compose.portainer-dev.yml config --quiet
# Expected: exit 0
```

---

## 7. Acceptance Criteria

1. `docker/.env` contains all credentials previously hardcoded in compose files.
2. `docker/.env` is gitignored (verified by `git check-ignore`).
3. `docker/.env.example` exists with placeholder values and IS committable.
4. Compose files use `${VAR:?error}` syntax (fail-fast if env var missing).
5. No password with a dictionary-word default remains in any compose file.
6. `docker compose config --quiet` succeeds when docker/.env is populated.
7. `docker compose config` fails when docker/.env is absent (fail-fast verified).
8. Verification command `grep -n 'password\|hackrf\|argos' docker/docker-compose.portainer-dev.yml | grep -iv '\${'` returns only comments or non-credential strings.

---

## 8. Traceability

| Finding | Description                                        | Severity | Subtask          |
| ------- | -------------------------------------------------- | -------- | ---------------- |
| F6      | KISMET_PASSWORD=password hardcoded in compose      | CRITICAL | 6.1.5.1          |
| F11     | OPENWEBRX_PASSWORD defaults to "hackrf"            | HIGH     | 6.1.5.1          |
| F12     | BETTERCAP_PASSWORD defaults to "argos"             | HIGH     | 6.1.5.1          |
| F23     | Only 1 of ~16 env vars externalized in docker/.env | MEDIUM   | 6.1.5.1, 6.1.5.2 |
| F24     | No .env.production template                        | MEDIUM   | 6.1.5.2          |

---

## 9. Execution Order Notes

This task is in **Phase 1 (Parallel)** of the execution order:

```
Phase 0 (IMMEDIATE): 6.1.2.6 (Flask debug -- RCE remediation)
Phase 1 (Parallel): 6.1.4, >>> 6.1.5 (THIS TASK) <<<, 6.1.9, 6.1.10, 6.1.11
Phase 2 (Sequential): 6.1.1, 6.1.7
Phase 3 (Sequential): 6.1.6
Phase 4 (Sequential): 6.1.2, 6.1.3, 6.1.8
```

**Requires**: Nothing -- this task has zero dependencies and can be executed immediately after Phase 0.
**Blocks**: Phase-6.1.02 (Compose security) should apply after credentials are externalized.
**Related**: Phase-6.1.11 Subtask 6.1.11.7 (git history audit) should verify no .env files with secrets exist in git history.
**Parallel with**: Tasks 6.1.4, 6.1.9, 6.1.10, 6.1.11 -- all can execute concurrently.

Total estimated execution time: 10-15 minutes.

**END OF DOCUMENT**
