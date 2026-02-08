# Phase 6.1.04: .dockerignore Audit and Improvement

**Document ID**: ARGOS-AUDIT-P6.1.04
**Parent Document**: Phase-6.1-DOCKER-AND-CONTAINER-MODERNIZATION.md
**Original Task ID**: 6.1.4
**Version**: 1.0
**Date**: 2026-02-08
**Author**: Claude Opus 4.6 (Lead Audit Agent)
**Classification**: UNCLASSIFIED // FOR OFFICIAL USE ONLY
**Risk Level**: LOW -- .dockerignore only affects build context, not runtime behavior.
**Review Standard**: CIS Docker Benchmark v1.6, DISA STIG Docker Enterprise V2R1, NIST SP 800-190

---

## 1. Objective

The root `.dockerignore` (symlinked from `config/.dockerignore`, 73 lines) excludes common development artifacts but misses several large directories and files that inflate the Docker build context. Current estimated context size after .dockerignore: ~400 MB. Target: under 60 MB. Reducing the build context decreases build time, reduces network transfer during remote builds, and prevents sensitive or unnecessary files from being available inside the Docker build environment.

---

## 2. Prerequisites

| Prerequisite                        | Verification Command                               | Expected Output                          |
| ----------------------------------- | -------------------------------------------------- | ---------------------------------------- |
| Docker Engine 27.x                  | `docker --version`                                 | Docker version 27.5.1 or later           |
| Docker Compose v2                   | `docker compose version`                           | Docker Compose version 2.32.4-3 or later |
| Root .dockerignore symlink intact   | `ls -la .dockerignore`                             | Symlink to config/.dockerignore          |
| config/.dockerignore exists         | `wc -l config/.dockerignore`                       | ~73 lines                                |
| Backup of .dockerignore             | `cp config/.dockerignore config/.dockerignore.bak` | File exists                              |
| Git working tree clean (or stashed) | `git status --porcelain \| wc -l`                  | 0 (or known untracked-only count)        |

---

## 3. Dependencies

| Dependency                       | Direction                | Description                                                                                           |
| -------------------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------- |
| Phase-6.1.01 (Dockerfile stages) | **BLOCKED BY THIS TASK** | Updated .dockerignore must be in place before rebuilding images to avoid sending 400 MB build context |
| Phase-6.1.07 (HackRF Dockerfile) | **BLOCKED BY THIS TASK** | HackRF Dockerfile rebuild also benefits from reduced build context                                    |
| None                             | **BLOCKS THIS TASK**     | This task has no inbound dependencies and can execute in Phase 1 (Parallel)                           |

---

## 4. Rollback Strategy

```bash
# Restore backed-up .dockerignore
cp config/.dockerignore.bak config/.dockerignore

# Verify symlink still points to config/.dockerignore
ls -la .dockerignore
# Expected: symlink to config/.dockerignore

# Verify build still works with original .dockerignore
docker build -t argos:rollback-test -f docker/Dockerfile --target deps . 2>&1 | head -5
```

---

## 5. Subtask Details

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

# Verify specific exclusions are present
grep -c 'hackrf_emitter' config/.dockerignore
# Expected: 1

grep -c 'plans/' config/.dockerignore
# Expected: 1

grep -c 'core\.\*' config/.dockerignore
# Expected: 1

grep -c '__pycache__' config/.dockerignore
# Expected: 1

# Build and check that hackrf_emitter is excluded
docker build -t argos:context-test -f docker/Dockerfile --target deps . 2>&1 | head -5
# Note: BuildKit does not show context size. Verify by:
docker run --rm argos:context-test ls /app/hackrf_emitter 2>&1
# Expected: "No such file or directory" (excluded by .dockerignore)

# Time the build to confirm context reduction
time docker build -t argos:context-test -f docker/Dockerfile --target deps --no-cache .
# Expected: significantly faster context transfer
```

**Acceptance criteria**:

- `hackrf_emitter/`, `archive/`, `plans/`, `deployment/`, `core.*`, `*.db`, and `__pycache__/` are all listed in `.dockerignore`.
- Build context transfer time decreases measurably.
- No runtime functionality is broken (hackrf_emitter is a separate container).
- Symlink from root `.dockerignore` to `config/.dockerignore` is intact.

---

## 6. Verification Commands

All verification commands are embedded within the subtask above. Summary of key verification steps:

```bash
# V1: .dockerignore line count
wc -l config/.dockerignore
# Expected: ~95 lines

# V2: Symlink intact
ls -la .dockerignore
# Expected: symlink to config/.dockerignore

# V3: hackrf_emitter excluded
grep 'hackrf_emitter' config/.dockerignore
# Expected: match found

# V4: Database files excluded
grep '^\*\.db$' config/.dockerignore
# Expected: match found

# V5: Core dumps excluded
grep 'core\.\*' config/.dockerignore
# Expected: match found

# V6: Python artifacts excluded
grep '__pycache__' config/.dockerignore
# Expected: match found

# V7: Build completes successfully with updated .dockerignore
docker build -t argos:context-test -f docker/Dockerfile --target deps .
# Expected: build succeeds
```

---

## 7. Acceptance Criteria

1. `hackrf_emitter/` excluded from build context (271 MB savings).
2. `archive/`, `plans/`, `deployment/` excluded from build context.
3. `*.db`, `*.db-journal`, `*.db-wal` excluded (prevents runtime databases from entering image).
4. `core.*` excluded (prevents core dumps from entering image).
5. `*.pyc`, `__pycache__/`, `.venv/`, `venv/` excluded (Python artifacts).
6. Root-level `.p10k.zsh` and `.zshrc` excluded.
7. Symlink from root `.dockerignore` to `config/.dockerignore` remains intact.
8. Build context reduced from ~400 MB to under 60 MB.
9. No runtime functionality broken by new exclusions.
10. `docker build` completes successfully with the updated .dockerignore.

---

## 8. Traceability

| Finding | Description                                                                              | Severity        | Subtask |
| ------- | ---------------------------------------------------------------------------------------- | --------------- | ------- |
| F15     | COPY . . copies unnecessary files (hackrf_emitter/.venv 270MB, etc.)                     | CRITICAL (perf) | 6.1.4.1 |
| F22     | .dockerignore missing hackrf_emitter/, archive/, plans/, rf_signals.db, core.\*, docker/ | MEDIUM          | 6.1.4.1 |

---

## 9. Execution Order Notes

This task is in **Phase 1 (Parallel)** of the execution order:

```
Phase 0 (IMMEDIATE): 6.1.2.6 (Flask debug -- RCE remediation)
Phase 1 (Parallel): >>> 6.1.4 (THIS TASK) <<<, 6.1.5, 6.1.9, 6.1.10, 6.1.11
Phase 2 (Sequential): 6.1.1 (requires this task complete), 6.1.7
Phase 3 (Sequential): 6.1.6
Phase 4 (Sequential): 6.1.2, 6.1.3, 6.1.8
```

**Requires**: Nothing -- this task has zero dependencies and can be executed immediately after Phase 0.
**Blocks**: Phase-6.1.01 (Dockerfile stages) and Phase-6.1.07 (HackRF Dockerfile) both require the updated .dockerignore to avoid sending 400 MB build context.
**Parallel with**: Tasks 6.1.5, 6.1.9, 6.1.10, 6.1.11 -- all can execute concurrently.

Total estimated execution time: 5-10 minutes.

**END OF DOCUMENT**
