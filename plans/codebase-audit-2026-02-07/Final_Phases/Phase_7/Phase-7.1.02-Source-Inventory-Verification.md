# Phase 7.1.02: Source Inventory Verification

**Decomposed from**: Phase-7.1-PRE-MIGRATION-BASELINE.md (Subtasks 7.1.1.1 through 7.1.1.4)
**Risk Level**: LOW -- Read-only analysis. No production code modified.
**Prerequisites**: Phase-7.1.01-Build-Health-Prerequisite-Gate.md (all three gates must pass)
**Estimated Duration**: 30-45 minutes
**Audit Date**: 2026-02-08
**Auditor**: Claude Opus 4.6 (Final Gate Audit)

---

## Purpose

Before deleting any code, you must know exactly what exists. This sub-task creates a verified, line-counted inventory of every file in the `hackrf_emitter/` tree. This inventory serves three purposes:

1. **Deletion completeness verification** -- Phase 7.7 must delete every file listed here, and no others.
2. **Migration scope accuracy** -- The TypeScript replacement must cover the functionality in all 18 non-empty Python source files.
3. **Original plan correction** -- The original Phase 7 plan contained 5 factual errors in file counts, line counts, and file references. These are formally corrected here.

---

## Subtask 7.1.1.1: Python Backend File Inventory

Record the exact state of every file in `hackrf_emitter/backend/` (excluding `.venv/` and `__pycache__/`).

**Verified inventory (27 project files):**

| #   | File (relative to hackrf_emitter/backend/)     | Lines | Type                                 |
| --- | ---------------------------------------------- | ----- | ------------------------------------ |
| 1   | `rf_workflows/enhanced_workflows.py`           | 1,385 | Protocol orchestration               |
| 2   | `rf_workflows/hackrf_controller.py`            | 795   | Hardware control                     |
| 3   | `rf_workflows/modulation_workflows.py`         | 672   | Signal modulation                    |
| 4   | `rf_workflows/universal_signal_cache.py`       | 625   | Signal cache (primary)               |
| 5   | `rf_workflows/adsb_protocol.py`                | 580   | ADS-B protocol encoder               |
| 6   | `rf_workflows/drone_video_jamming_protocol.py` | 579   | Drone video jamming                  |
| 7   | `rf_workflows/elrs_jamming_protocol.py`        | 559   | ELRS jamming                         |
| 8   | `rf_workflows/gps_protocol.py`                 | 460   | GPS L1 C/A encoder                   |
| 9   | `rf_workflows/wideband_signal_cache.py`        | 371   | Signal cache (wideband)              |
| 10  | `rf_workflows/raw_energy_protocol.py`          | 340   | Broadband energy emission            |
| 11  | `rf_workflows/elrs_protocol.py`                | 330   | ExpressLRS protocol                  |
| 12  | `app.py`                                       | 406   | Flask application + routes           |
| 13  | `utils/config_manager.py`                      | 254   | Configuration management             |
| 14  | `sweep_bridge.py`                              | 172   | hackrf_sweep to python-hackrf bridge |
| 15  | `initialize_cache.py`                          | 119   | Cache initialization                 |
| 16  | `simple_test.py`                               | 101   | Test utilities                       |
| 17  | `utils/safety_manager.py`                      | 95    | Safety limits (all-permissive)       |
| 18  | `rf_workflows/crc16_python.py`                 | 70    | CRC-16 implementations               |
| 19  | `rf_workflows/__init__.py`                     | 0     | Package marker                       |
| 20  | `utils/__init__.py`                            | 0     | Package marker                       |
| 21  | `__init__.py`                                  | 0     | Package marker                       |
| 22  | `Dockerfile`                                   | 52    | Python container build               |
| 23  | `requirements.txt`                             | 11    | Python dependencies                  |
| 24  | `README.md`                                    | 88    | Documentation                        |
| 25  | `.dockerignore`                                | 58    | Docker ignore rules                  |
| 26  | `run_cache_init.sh`                            | 34    | Cache init script                    |
| 27  | `package-lock.json`                            | 6     | Artifact                             |

**Total Python source lines**: 7,913 (across 18 non-empty .py files)
**Total backend project files**: 27

**Verification command:**

```bash
# Count all backend files (excluding .venv/ and __pycache__/)
find /home/kali/Documents/Argos/Argos/hackrf_emitter/backend/ -type f \
  -not -path '*/.venv/*' \
  -not -path '*/__pycache__/*' \
  | wc -l

# Line counts for all Python source files
find /home/kali/Documents/Argos/Argos/hackrf_emitter/backend/ -name "*.py" \
  -not -path '*/.venv/*' \
  -not -path '*/__pycache__/*' \
  | xargs wc -l | sort -n

# Total Python source lines only
find /home/kali/Documents/Argos/Argos/hackrf_emitter/backend/ -name "*.py" \
  -not -path '*/.venv/*' \
  -not -path '*/__pycache__/*' \
  | xargs wc -l | tail -1
```

---

## Subtask 7.1.1.2: React Frontend File Inventory

Record the exact state of every source file in `hackrf_emitter/frontend/src/`.

| #   | File (relative to hackrf_emitter/frontend/src/) | Lines | Purpose                                    |
| --- | ----------------------------------------------- | ----- | ------------------------------------------ |
| 1   | `pages/Workflows.tsx`                           | 466   | RF workflow browser and launcher           |
| 2   | `pages/Dashboard.tsx`                           | 442   | System status, quick-start, emergency stop |
| 3   | `components/WorkflowForm.tsx`                   | 250   | Parameter configuration modal              |
| 4   | `pages/DeviceInfo.tsx`                          | 237   | HackRF device status display               |
| 5   | `pages/Settings.tsx`                            | 213   | Safety limits and guidelines               |
| 6   | `services/api.ts`                               | 197   | REST client to Flask backend               |
| 7   | `contexts/SocketContext.tsx`                    | 137   | Flask-SocketIO WebSocket context           |
| 8   | `components/Layout.tsx`                         | 128   | App layout with navigation                 |
| 9   | `pages/Library.tsx`                             | 113   | Cached signal browser                      |
| 10  | `components/ErrorBoundary.tsx`                  | 74    | React error boundary                       |
| 11  | `App.tsx`                                       | 26    | App root with routing                      |
| 12  | `index.tsx`                                     | 21    | React entry point                          |

**Total frontend source lines**: 2,304 (12 source files, excluding config)
**Total frontend source lines including config**: 2,362 (with postcss.config.js, tailwind.config.js, tsconfig.json, package.json)

**Verification command:**

```bash
# Count frontend source files
find /home/kali/Documents/Argos/Argos/hackrf_emitter/frontend/src/ -type f | wc -l

# Line counts for all frontend source files
find /home/kali/Documents/Argos/Argos/hackrf_emitter/frontend/src/ -type f | xargs wc -l | sort -n
```

---

## Subtask 7.1.1.3: Root-Level File Inventory

| #   | File (relative to hackrf_emitter/) | Lines | Purpose                      |
| --- | ---------------------------------- | ----- | ---------------------------- |
| 1   | `start.sh`                         | 495   | Service orchestration script |
| 2   | `start_services.sh`                | 194   | Multi-service launcher       |
| 3   | `.gitignore`                       | 250   | Git ignore rules             |
| 4   | `README.md`                        | 573   | Project documentation        |
| 5   | `pyproject.toml`                   | 44    | Python project config        |
| 6   | `pyrightconfig.json`               | 13    | Pyright type checker config  |

**Total root-level lines**: 1,569 (true root-level files)

Plus `.vscode/css_custom_data.json` (64 lines) in subdirectory.

**Verification command:**

```bash
# Verify root-level files exist and count lines
wc -l /home/kali/Documents/Argos/Argos/hackrf_emitter/start.sh \
      /home/kali/Documents/Argos/Argos/hackrf_emitter/start_services.sh \
      /home/kali/Documents/Argos/Argos/hackrf_emitter/.gitignore \
      /home/kali/Documents/Argos/Argos/hackrf_emitter/README.md \
      /home/kali/Documents/Argos/Argos/hackrf_emitter/pyproject.toml \
      /home/kali/Documents/Argos/Argos/hackrf_emitter/pyrightconfig.json
```

---

## Subtask 7.1.1.4: Correct False Claims from Original Plan

The original Phase 7 plan contained the following data integrity failures that MUST be corrected:

| #   | Original Claim                                   | Actual Value                                                                                                                    | Error Factor                        | Impact                                    |
| --- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | ----------------------------------------- |
| 1   | "Startup scripts: ~19,000 lines (combined)"      | 689 lines (start.sh=495, start_services.sh=194)                                                                                 | **27.6x overstated**                | Cascades to total deletion count          |
| 2   | "Total lines removed: ~30,000+"                  | ~12,412 hand-written lines (all non-vendored files)                                                                             | **2.4x overstated**                 | Misrepresents migration scope             |
| 3   | "Estimated Files Deleted: ~25"                   | 45 project files (27 backend + 12 frontend source + 6 root)                                                                     | **1.8x understated**                | Underestimates deletion work              |
| 4   | React frontend "2,388 lines"                     | 2,304 source / 2,362 including config                                                                                           | Minor -- depends on counting method |
| 5   | "Remove Python from docker/Dockerfile ~10 lines" | Python in main Dockerfile is BUILD-ONLY (node-gyp). Actual Python Dockerfile is at hackrf_emitter/backend/Dockerfile (52 lines) | **Wrong file referenced**           | Would leave the real Dockerfile undeleted |

**Verification commands:**

```bash
# Verify startup script line counts
wc -l /home/kali/Documents/Argos/Argos/hackrf_emitter/start.sh \
      /home/kali/Documents/Argos/Argos/hackrf_emitter/start_services.sh

# Verify total non-vendored lines
find /home/kali/Documents/Argos/Argos/hackrf_emitter/ -type f \
  -not -path '*/.venv/*' \
  -not -path '*/__pycache__/*' \
  -not -path '*/node_modules/*' \
  -not -name 'package-lock.json' \
  | xargs wc -l | tail -1

# Verify file count
find /home/kali/Documents/Argos/Argos/hackrf_emitter/ -type f \
  -not -path '*/.venv/*' \
  -not -path '*/__pycache__/*' \
  -not -path '*/node_modules/*' \
  -not -name 'package-lock.json' \
  | wc -l

# Verify Python in main Dockerfile is build-only (node-gyp context)
grep -n "python" /home/kali/Documents/Argos/Argos/docker/Dockerfile

# Verify the actual Python Dockerfile location and size
wc -l /home/kali/Documents/Argos/Argos/hackrf_emitter/backend/Dockerfile
```

---

## Verification Checklist

- [ ] All 27 backend project files verified with `find | wc -l` returning 27
- [ ] All 18 non-empty .py files verified with line counts matching table
- [ ] Total Python source lines verified as 7,913
- [ ] All 12 frontend source files verified with line counts matching table
- [ ] Total frontend source lines verified as 2,304 (or 2,362 including config)
- [ ] All 6 root-level files verified with line counts matching table
- [ ] Total root-level lines verified as 1,569
- [ ] False claim #1 (startup scripts) verified: 689 lines, not ~19,000
- [ ] False claim #2 (total lines) verified: ~12,412 lines, not ~30,000+
- [ ] False claim #3 (file count) verified: 45 files, not ~25
- [ ] False claim #5 (Dockerfile) verified: actual Dockerfile at hackrf_emitter/backend/Dockerfile

---

## Definition of Done

This sub-task is complete when:

1. Every file in the three inventory tables has been verified to exist at the listed path with the listed line count (tolerance: +/- 2 lines for trailing newline differences).
2. All five false claim corrections have been verified with the commands above.
3. No discrepancies remain between the tables and the filesystem.

---

## Cross-References

- **Required by**: Phase-7.1.05-Golden-Reference-File-Generation.md (must know which protocol files to generate references from)
- **Required by**: Phase-7.1.07-Function-Signature-Documentation.md (must know which modules to extract signatures from)
- **Required by**: Phase-7.7-DELETION-CLEANUP.md (must know exactly which files to delete)
- **Informs**: Phase-7.1.04-Python-in-SvelteKit-Dependencies.md (identifies files OUTSIDE this inventory)
