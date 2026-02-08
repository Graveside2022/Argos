# Phase 7.7.02: File Deletion Sequence

**Decomposed from**: Phase-7.7-DELETION-CLEANUP.md (Tasks 7.7.3 through 7.7.7)
**Risk Level**: HIGH -- Irreversible file deletion. Git tag MUST exist before execution.
**Prerequisites**: Phase-7.7.01 complete (git tag created, ALL gates passed)
**Estimated Duration**: 10 minutes
**Audit Date**: 2026-02-08
**Auditor**: Claude Opus 4.6 (Final Gate Audit)

---

## Purpose

Execute the ordered deletion of all hackrf_emitter files: React frontend, Python backend source,
Python virtual environment, and root-level configuration files. Each step is atomic and individually
committable. The sequence is designed so that partial completion does not leave the codebase in
an inconsistent state.

---

## Pre-Execution Gate

**STOP. Before executing ANY command in this file, verify:**

```bash
# Verify the safety tag exists
git tag -l 'pre-python-removal' | grep -q 'pre-python-removal' && echo "PASS: tag exists" || echo "ABORT: tag missing"

# Verify working directory is clean
git status --porcelain | wc -l
# Must be 0. If not, commit or stash changes first.
```

If either check fails, return to Phase-7.7.01 and complete it first.

---

## Task 7.7.3: Delete React Frontend

The React frontend was located at `hackrf_emitter/frontend/`. As of 2026-02-08, this directory
does NOT exist on disk (previously deleted or never deployed to this host). If the directory
exists on your deployment, execute the deletion. If not, skip to Task 7.7.4.

```bash
# Check if frontend exists
if [ -d "hackrf_emitter/frontend" ]; then
    rm -rf hackrf_emitter/frontend/
    echo "DELETED: hackrf_emitter/frontend/"
else
    echo "SKIP: hackrf_emitter/frontend/ does not exist (already removed)"
fi
```

**Files removed** (if directory exists -- 12 source files + config, 2,304 source lines + 17,705 package-lock.json):

- `hackrf_emitter/frontend/src/` (13 source files)
- `hackrf_emitter/frontend/public/` (2 files)
- `hackrf_emitter/frontend/package.json`
- `hackrf_emitter/frontend/package-lock.json`
- `hackrf_emitter/frontend/postcss.config.js`
- `hackrf_emitter/frontend/tailwind.config.js`
- `hackrf_emitter/frontend/tsconfig.json`

**Verification**:

```bash
test -d hackrf_emitter/frontend && echo "FAIL: frontend still exists" || echo "PASS: frontend removed"
```

**Commit** (optional, can batch with Task 7.7.4):

```bash
git add -A hackrf_emitter/frontend/
git commit -m "chore(phase7.7.3): delete React frontend from hackrf_emitter"
```

---

## Task 7.7.4: Delete Python Backend

Delete all Python backend source files, configuration, and non-code assets. This is the largest
deletion in the sequence: 21 Python files (7,913 lines) plus supporting files.

**IMPORTANT CORRECTION**: The original Phase 7.7 plan stated `config/settings.json` does not
exist. This is WRONG. The file `hackrf_emitter/backend/config/settings.json` (62 lines) DOES
exist on disk and MUST be deleted.

```bash
# Delete rf_workflows/ directory (12 Python files)
rm -rf hackrf_emitter/backend/rf_workflows/

# Delete utils/ directory (3 Python files)
rm -rf hackrf_emitter/backend/utils/

# Delete config/ directory (1 JSON file -- 62 lines -- DOES exist despite original plan claim)
rm -rf hackrf_emitter/backend/config/

# Delete individual backend files
rm hackrf_emitter/backend/app.py
rm hackrf_emitter/backend/sweep_bridge.py
rm hackrf_emitter/backend/initialize_cache.py
rm hackrf_emitter/backend/simple_test.py
rm hackrf_emitter/backend/__init__.py
rm hackrf_emitter/backend/Dockerfile
rm hackrf_emitter/backend/requirements.txt
rm hackrf_emitter/backend/README.md
rm hackrf_emitter/backend/.dockerignore
rm hackrf_emitter/backend/run_cache_init.sh
rm hackrf_emitter/backend/package-lock.json
```

### Complete File Inventory (Verified 2026-02-08)

**rf_workflows/ directory** (12 files):

| File                              | Lines |
| --------------------------------- | ----- |
| `__init__.py`                     | 0     |
| `adsb_protocol.py`                | 580   |
| `crc16_python.py`                 | 70    |
| `drone_video_jamming_protocol.py` | 579   |
| `elrs_jamming_protocol.py`        | 559   |
| `elrs_protocol.py`                | 330   |
| `enhanced_workflows.py`           | 1,385 |
| `gps_protocol.py`                 | 460   |
| `hackrf_controller.py`            | 795   |
| `modulation_workflows.py`         | 672   |
| `raw_energy_protocol.py`          | 340   |
| `universal_signal_cache.py`       | 625   |
| `wideband_signal_cache.py`        | 371   |

**utils/ directory** (3 files):

| File                | Lines |
| ------------------- | ----- |
| `__init__.py`       | 0     |
| `config_manager.py` | 254   |
| `safety_manager.py` | 95    |

**Root backend files** (9 files):

| File                  | Lines | Type          |
| --------------------- | ----- | ------------- |
| `app.py`              | 406   | Python source |
| `sweep_bridge.py`     | 172   | Python source |
| `initialize_cache.py` | 119   | Python source |
| `simple_test.py`      | 101   | Python source |
| `__init__.py`         | 0     | Python source |
| `Dockerfile`          | --    | Docker config |
| `requirements.txt`    | --    | Dependencies  |
| `README.md`           | --    | Documentation |
| `.dockerignore`       | --    | Docker config |
| `run_cache_init.sh`   | --    | Shell script  |
| `package-lock.json`   | --    | Generated     |

**config/ directory** (1 file):

| File            | Lines | Note                                        |
| --------------- | ----- | ------------------------------------------- |
| `settings.json` | 62    | DOES exist (original plan said it does not) |

**Total Python source**: 21 files, 7,913 lines (verified via `wc -l`)

**Verification**:

```bash
# Verify no Python files remain in backend
find hackrf_emitter/backend/ -name "*.py" -type f 2>/dev/null | wc -l
# Expected: 0

# Verify only .venv remains (if present)
ls hackrf_emitter/backend/ 2>/dev/null
# Expected: only .venv/ (or empty)
```

**Commit**:

```bash
git add -A hackrf_emitter/backend/
git commit -m "chore(phase7.7.4): delete Python backend source from hackrf_emitter"
```

---

## Task 7.7.5: Delete Python Virtual Environment

The `.venv` directory is in `.gitignore` and not tracked by git, but it consumes ~270 MB of disk
space. Delete it to reclaim storage.

```bash
rm -rf hackrf_emitter/backend/.venv/
```

**Disk space freed**: ~270 MB, ~6,749 files (virtualenv libraries, pip cache)

**Verification**:

```bash
test -d hackrf_emitter/backend/.venv && echo "FAIL: .venv still exists" || echo "PASS: .venv removed"
```

**Note**: This deletion will NOT appear in `git status` because `.venv` is gitignored.
No commit is needed for this step.

---

## Task 7.7.6: Delete Root-Level hackrf_emitter Files

Delete the top-level configuration and startup files in `hackrf_emitter/`.

```bash
rm hackrf_emitter/start.sh
rm hackrf_emitter/start_services.sh
rm hackrf_emitter/.gitignore
rm hackrf_emitter/README.md
rm hackrf_emitter/pyproject.toml
rm hackrf_emitter/pyrightconfig.json
rm -rf hackrf_emitter/.vscode/
```

### File Details

| File                 | Lines | Purpose                                                   |
| -------------------- | ----- | --------------------------------------------------------- |
| `start.sh`           | 495   | Backend startup orchestrator                              |
| `start_services.sh`  | 194   | Service launcher                                          |
| `.gitignore`         | --    | Git ignore rules                                          |
| `README.md`          | --    | Project documentation                                     |
| `pyproject.toml`     | --    | Python project config                                     |
| `pyrightconfig.json` | --    | Pyright type checker config                               |
| `.vscode/`           | --    | VSCode workspace settings (contains css_custom_data.json) |

**Verification**:

```bash
# Check what remains
ls -la hackrf_emitter/ 2>/dev/null
# Expected: only backend/ directory (now empty except possibly __pycache__)
```

**Commit**:

```bash
git add -A hackrf_emitter/
git commit -m "chore(phase7.7.6): delete root-level hackrf_emitter files and config"
```

---

## Task 7.7.7: Delete Empty hackrf_emitter Directory

After all contents have been removed, delete the now-empty directory tree.

```bash
# SAFETY: Verify directory is empty (or contains only ignorable remnants)
find hackrf_emitter/ -type f 2>/dev/null
# Must return 0 files. If any files remain, investigate before proceeding.

# If empty, delete the directory tree
rm -rf hackrf_emitter/
```

**IMPORTANT**: If `find` shows any remaining files, do NOT proceed with `rm -rf`. Investigate
each file -- it may be a file missed by the deletion sequence or a new file added after the
plan was written.

**Verification**:

```bash
test -d hackrf_emitter && echo "FAIL: hackrf_emitter still exists" || echo "PASS: hackrf_emitter removed"
```

**Commit**:

```bash
git add -A hackrf_emitter/
git commit -m "chore(phase7.7.7): remove empty hackrf_emitter directory"
```

---

## Verification Checklist

- [ ] React frontend directory deleted (or confirmed already absent)
- [ ] Python backend rf_workflows/ deleted (12 files)
- [ ] Python backend utils/ deleted (3 files)
- [ ] Python backend config/ deleted (1 file -- settings.json)
- [ ] Python backend root files deleted (11 individual files)
- [ ] Python virtual environment deleted (~270 MB freed)
- [ ] Root-level hackrf_emitter files deleted (6 files + .vscode/)
- [ ] hackrf_emitter/ directory verified empty and removed
- [ ] `test -d hackrf_emitter` returns false
- [ ] All deletion steps committed to git

---

## Definition of Done

This sub-task is complete when:

1. The `hackrf_emitter/` directory does not exist on disk
2. All deletions have been committed to git
3. No stray files remain from the Python backend or React frontend

---

## Cross-References

- **Previous**: Phase-7.7.01-Pre-Deletion-Safety.md (git tag + gate verification)
- **Next**: Phase-7.7.03-Docker-and-Infrastructure-Cleanup.md (Docker compose + package.json)
- **Rollback**: Phase-7.7.05-Post-Deletion-Verification.md (git checkout from tag)
- **Parent**: Phase-7.7-DELETION-CLEANUP.md
