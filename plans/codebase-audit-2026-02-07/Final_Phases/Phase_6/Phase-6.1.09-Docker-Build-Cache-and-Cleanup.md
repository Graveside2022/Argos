# Phase 6.1.09: Dead Docker File Cleanup

**Document ID**: ARGOS-AUDIT-P6.1.09
**Parent Document**: Phase-6.1-DOCKER-AND-CONTAINER-MODERNIZATION.md
**Original Task ID**: 6.1.9
**Version**: 1.0
**Date**: 2026-02-08
**Author**: Claude Opus 4.6 (Lead Audit Agent)
**Classification**: UNCLASSIFIED // FOR OFFICIAL USE ONLY
**Risk Level**: LOW -- Deleting unused files and removing deprecated keys has no runtime impact.
**Review Standard**: CIS Docker Benchmark v1.6, DISA STIG Docker Enterprise V2R1, NIST SP 800-190

---

## 1. Objective

Remove dead files and obsolete artifacts from the Docker directory. Specifically: delete the dead `docker/setup-shell.sh` script (56 lines that duplicate Dockerfile instructions) and remove the deprecated `version: '3.8'` key from all 3 compose files (which Docker Compose v2 ignores and emits deprecation warnings about).

---

## 2. Prerequisites

| Prerequisite                        | Verification Command                                                                     | Expected Output                          |
| ----------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------- |
| Docker Engine 27.x                  | `docker --version`                                                                       | Docker version 27.5.1 or later           |
| Docker Compose v2                   | `docker compose version`                                                                 | Docker Compose version 2.32.4-3 or later |
| Backup of compose files             | `cp docker/docker-compose.portainer-dev.yml docker/docker-compose.portainer-dev.yml.bak` | File exists                              |
| Backup of setup-shell.sh            | `cp docker/setup-shell.sh docker/setup-shell.sh.bak 2>/dev/null; echo done`              | done                                     |
| Git working tree clean (or stashed) | `git status --porcelain \| wc -l`                                                        | 0 (or known untracked-only count)        |

---

## 3. Dependencies

| Dependency | Direction                | Description                                                                 |
| ---------- | ------------------------ | --------------------------------------------------------------------------- |
| None       | **BLOCKS THIS TASK**     | This task has no inbound dependencies and can execute in Phase 1 (Parallel) |
| None       | **BLOCKED BY THIS TASK** | This task has no downstream dependencies                                    |

---

## 4. Rollback Strategy

```bash
# Restore setup-shell.sh if needed
cp docker/setup-shell.sh.bak docker/setup-shell.sh

# Restore compose files with version key
cp docker/docker-compose.portainer-dev.yml.bak docker/docker-compose.portainer-dev.yml
cp docker/docker-compose.portainer.yml.bak docker/docker-compose.portainer.yml
cp docker/docker-compose.ollama.yml.bak docker/docker-compose.ollama.yml

# Validate compose files
docker compose -f docker/docker-compose.portainer-dev.yml config --quiet
docker compose -f docker/docker-compose.portainer.yml config --quiet
docker compose -f docker/docker-compose.ollama.yml config --quiet
```

---

## 5. Subtask Details

### Subtask 6.1.9.1: Delete docker/setup-shell.sh

**Description**: `docker/setup-shell.sh` (56 lines) is a standalone script that duplicates all Oh My Zsh, Powerlevel10k, plugin, font, Atuin, and Claude Code installation steps already present in the Dockerfile (Lines 54-74). It is not referenced by any Dockerfile, compose file, or CI configuration. It was likely the precursor to the Dockerfile commands and was never deleted.

**Files affected**:

- `docker/setup-shell.sh` -- Delete

**Changes**: Delete the file entirely.

**Verification commands**:

```bash
# Pre-deletion: Verify no references to setup-shell.sh exist
grep -r 'setup-shell' docker/ scripts/ .github/ Makefile 2>/dev/null | grep -v '.bak'
# Expected: empty (no references)

# Also check for references in Dockerfile and compose files
grep -r 'setup-shell' docker/Dockerfile docker/docker-compose.*.yml 2>/dev/null
# Expected: empty (no references)

# Delete the file
rm docker/setup-shell.sh

# Verify deletion
ls docker/setup-shell.sh 2>&1
# Expected: "No such file or directory"

# Verify docker build still succeeds (script was not used in build)
docker compose -f docker/docker-compose.portainer-dev.yml config --quiet
# Expected: exit 0
```

**Acceptance criteria**:

- `docker/setup-shell.sh` does not exist.
- No Dockerfile, compose file, script, or CI configuration references it.
- Docker build and compose operations unaffected.

---

### Subtask 6.1.9.2: Remove Deprecated version Key From Compose Files

**Description**: All 3 compose files use `version: '3.8'` (portainer-dev.yml L11, portainer.yml L1, ollama.yml L1). Docker Compose v2 (which is what runs on this system -- v2.32.4) ignores the `version` key and emits a deprecation warning. The `version` key is a v1-era artifact. Removing it eliminates the deprecation warning and clarifies that the compose files are v2 format.

**Files affected**:

- `docker/docker-compose.portainer-dev.yml` -- Line 11
- `docker/docker-compose.portainer.yml` -- Line 1
- `docker/docker-compose.ollama.yml` -- Line 1

**Changes**: Remove the `version: '3.8'` line and any blank line immediately following it from each file.

**Verification commands**:

```bash
# Verify version key removed from all compose files
grep -n "^version:" docker/docker-compose.portainer-dev.yml docker/docker-compose.portainer.yml docker/docker-compose.ollama.yml
# Expected: empty (no matches)

# Validate compose files parse correctly without version key
docker compose -f docker/docker-compose.portainer-dev.yml config --quiet
# Expected: exit 0 with no output

docker compose -f docker/docker-compose.portainer.yml config --quiet
# Expected: exit 0 with no output

docker compose -f docker/docker-compose.ollama.yml config --quiet
# Expected: exit 0 with no output

# Verify no deprecation warnings
docker compose -f docker/docker-compose.portainer-dev.yml config 2>&1 | grep -i 'version'
# Expected: no deprecation warning about version key

# Count remaining version: lines across all compose files
grep -c '^version:' docker/docker-compose.*.yml 2>/dev/null | grep -v ':0$'
# Expected: empty (all counts are 0)
```

**Acceptance criteria**:

- No compose file contains a `version:` key.
- All compose files validate successfully with `docker compose config --quiet`.
- No deprecation warnings emitted during compose operations.
- All services start and function correctly without the version key.

---

## 6. Verification Commands

All verification commands are embedded within each subtask above. Summary of key verification steps:

```bash
# V1: setup-shell.sh deleted
ls docker/setup-shell.sh 2>&1
# Expected: "No such file or directory"

# V2: No references to setup-shell.sh
grep -r 'setup-shell' docker/ scripts/ .github/ Makefile 2>/dev/null | grep -v '.bak'
# Expected: empty

# V3: No version: in compose files
grep -c '^version:' docker/docker-compose.portainer-dev.yml docker/docker-compose.portainer.yml docker/docker-compose.ollama.yml
# Expected: all 0

# V4: All compose files validate
docker compose -f docker/docker-compose.portainer-dev.yml config --quiet
docker compose -f docker/docker-compose.portainer.yml config --quiet
docker compose -f docker/docker-compose.ollama.yml config --quiet
# Expected: all exit 0
```

---

## 7. Acceptance Criteria

1. `docker/setup-shell.sh` does not exist on disk.
2. No Dockerfile, compose file, script, or CI configuration references `setup-shell.sh`.
3. No compose file contains a `version:` key.
4. All 3 compose files validate successfully with `docker compose config --quiet`.
5. No deprecation warnings emitted during compose config operations.
6. Docker build and all service operations are unaffected by these removals.

---

## 8. Traceability

| Finding | Description                                 | Severity | Subtask |
| ------- | ------------------------------------------- | -------- | ------- |
| F25     | Dead file: docker/setup-shell.sh (56 lines) | LOW      | 6.1.9.1 |
| F26     | Deprecated version: '3.8' in compose files  | LOW      | 6.1.9.2 |

---

## 9. Execution Order Notes

This task is in **Phase 1 (Parallel)** of the execution order:

```
Phase 0 (IMMEDIATE): 6.1.2.6 (Flask debug -- RCE remediation)
Phase 1 (Parallel): 6.1.4, 6.1.5, >>> 6.1.9 (THIS TASK) <<<, 6.1.10, 6.1.11
Phase 2 (Sequential): 6.1.1, 6.1.7
Phase 3 (Sequential): 6.1.6
Phase 4 (Sequential): 6.1.2, 6.1.3, 6.1.8
```

**Requires**: Nothing -- this task has zero dependencies and can be executed immediately after Phase 0.
**Blocks**: Nothing -- this task has no downstream dependencies.
**Parallel with**: Tasks 6.1.4, 6.1.5, 6.1.10, 6.1.11 -- all can execute concurrently.

Total estimated execution time: 5 minutes.

**END OF DOCUMENT**
