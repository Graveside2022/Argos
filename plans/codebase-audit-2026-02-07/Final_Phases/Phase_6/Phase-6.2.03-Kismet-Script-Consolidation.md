# Phase 6.2.03: Kismet Script Consolidation

**Document ID**: ARGOS-AUDIT-P6.2.03
**Parent Document**: Phase-6.2-SHELL-SCRIPT-CONSOLIDATION.md
**Original Task ID**: 6.2.3
**Version**: 1.0
**Date**: 2026-02-08
**Author**: Claude Opus 4.6 (Lead Audit Agent)
**Classification**: UNCLASSIFIED // FOR OFFICIAL USE ONLY
**Risk Level**: MEDIUM
**Review Standard**: DoD STIG Shell Script Security, NIST SP 800-123, CIS Benchmarks

---

## 1. Objective

Reduce 13 Kismet-related files (10 .sh + 3 .conf) to 5 files total (4 .sh + 3 .conf -- 1 new unified `kismet.sh` replacing 5 merged scripts, plus 2 eliminated scripts). Archive 7 .sh files. Net reduction: 6 files.

---

## 2. Prerequisites

1. **Task 6.2.1 complete** (Duplicate Directory Elimination) -- ensures no duplicate Kismet scripts remain in testing/ or maintenance/.
2. **Phase 6.3 (`argos-env.sh`) must execute BEFORE this phase** so the new consolidated `kismet.sh` uses centralized paths from day one.
3. **Script dependency graph check** must be run (see Section 6.1).
4. **Pre-execution snapshot** (Phase-6.2.01 Section 4.1) must already exist.

---

## 3. Dependencies

| Dependency                   | Direction                    | Description                                                                 |
| ---------------------------- | ---------------------------- | --------------------------------------------------------------------------- |
| Task 6.2.1                   | Recommended before this task | Avoids confusion with duplicate directories                                 |
| Phase 6.3                    | BLOCKS this task             | Centralized path variables needed                                           |
| `start-kismet-with-alfa.sh`  | PRODUCTION-CRITICAL          | Referenced by `src/lib/server/wifite/processManager.ts` line 353            |
| `setup-kismet-adapter.sh`    | PRODUCTION-CRITICAL          | Referenced by `src/routes/api/kismet/start-with-adapter/+server.ts` line 21 |
| `kismet-no-auto-source.conf` | PRODUCTION-CRITICAL          | Referenced by `src/routes/api/kismet/start-safe/+server.ts` line 13         |
| `kismet-site-simple.conf`    | PRODUCTION-CRITICAL          | Referenced by `src/routes/api/kismet/start-with-adapter/+server.ts` line 11 |

---

## 4. Rollback Strategy

**CRITICAL**: No script file is ever deleted. All superseded Kismet scripts are moved to `scripts/_archived/phase-6.2/kismet/`.

```bash
# Restore a specific script:
cp scripts/_archived/phase-6.2/kismet/<original-name>.sh scripts/<original-name>.sh
chmod +x scripts/<original-name>.sh
sha256sum scripts/<original-name>.sh
grep "<original-name>" scripts/_archived/phase-6.2/CHECKSUMS-BEFORE.txt
```

---

## 5. Production-Critical Script Protection

The following Kismet-related scripts are referenced by production code and must NOT be archived:

| Script                               | Referenced By                                         | Line |
| ------------------------------------ | ----------------------------------------------------- | ---- |
| `scripts/start-kismet-with-alfa.sh`  | `src/lib/server/wifite/processManager.ts`             | 353  |
| `scripts/setup-kismet-adapter.sh`    | `src/routes/api/kismet/start-with-adapter/+server.ts` | 21   |
| `scripts/kismet-no-auto-source.conf` | `src/routes/api/kismet/start-safe/+server.ts`         | 13   |
| `scripts/kismet-site-simple.conf`    | `src/routes/api/kismet/start-with-adapter/+server.ts` | 11   |

**NOTE**: `start-kismet-with-alfa.sh` stays at its current path because it is referenced by `src/lib/server/wifite/processManager.ts` line 353. If this file is renamed, the TypeScript reference MUST be updated in the same commit.

---

## 6. Task Details

### 6.1 Script Dependency Graph Check

```bash
# Verify no Kismet script to be archived is sourced by a surviving script:
for f in start-kismet.sh start-kismet-safe.sh start-kismet-skip-adapter.sh \
  kismet-graceful-stop.sh stop-kismet-safe.sh safe-stop-kismet.sh update-kismet-service.sh; do
  result=$(grep -rn "source.*$f\|\\. .*$f\|bash.*$f" scripts/ --include='*.sh' 2>/dev/null | grep -v '_archived')
  if [ -n "$result" ]; then
    echo "BLOCKED: $f is sourced by: $result"
  fi
done
# If any BLOCKED lines appear, do NOT archive that script until the dependency is resolved.
```

### 6.2 Kismet Script Inventory

| File                           | Lines | Disposition                  | Reason                               |
| ------------------------------ | ----- | ---------------------------- | ------------------------------------ |
| `start-kismet.sh`              | 58    | MERGE into kismet.sh         | Basic start                          |
| `start-kismet-safe.sh`         | 53    | MERGE into kismet.sh         | Safe-mode start                      |
| `start-kismet-skip-adapter.sh` | 55    | MERGE into kismet.sh         | No-adapter start                     |
| `start-kismet-with-alfa.sh`    | 100   | KEEP (production-referenced) | Referenced by processManager.ts      |
| `configure-kismet-gps.sh`      | 67    | KEEP                         | GPS configuration                    |
| `setup-kismet-adapter.sh`      | 62    | KEEP (production-referenced) | Referenced by start-with-adapter API |
| `kismet-graceful-stop.sh`      | 36    | MERGE into kismet.sh         | Graceful stop                        |
| `safe-stop-kismet.sh`          | 23    | ARCHIVE                      | Subset of graceful-stop              |
| `stop-kismet-safe.sh`          | 117   | MERGE into kismet.sh         | Comprehensive stop                   |
| `update-kismet-service.sh`     | 28    | ARCHIVE                      | One-time setup                       |
| `kismet-gps-only.conf`         | 23    | KEEP                         | Referenced context (GPS-only config) |
| `kismet-no-auto-source.conf`   | 23    | KEEP (production-referenced) | Referenced by start-safe API         |
| `kismet-site-simple.conf`      | 25    | KEEP (production-referenced) | Referenced by start-with-adapter API |

### 6.3 Consolidated Kismet Scripts (Target: 4 .sh + 3 .conf = 7 total)

#### 6.3.1 kismet.sh (~180 lines) -- Unified start/stop/status

Merge logic from: `start-kismet.sh`, `start-kismet-safe.sh`, `start-kismet-skip-adapter.sh`, `kismet-graceful-stop.sh`, `stop-kismet-safe.sh`.

```
Usage: kismet.sh {start|start-safe|start-no-adapter|stop|force-stop|status} [OPTIONS]
  start           Standard Kismet start with adapter detection
  start-safe      Start with no-auto-source config
  start-no-adapter Start without WiFi adapter
  stop            Graceful shutdown
  force-stop      Kill all Kismet processes
  status          Show Kismet process state
```

#### 6.3.2 Files KEPT as-is

- `start-kismet-with-alfa.sh` (100 lines) -- production-referenced
- `setup-kismet-adapter.sh` (62 lines) -- production-referenced
- `configure-kismet-gps.sh` (67 lines) -- standalone GPS config
- `kismet-gps-only.conf` (23 lines) -- config file
- `kismet-no-auto-source.conf` (23 lines) -- production-referenced
- `kismet-site-simple.conf` (25 lines) -- production-referenced

### 6.4 Execution Steps

```bash
mkdir -p scripts/_archived/phase-6.2/kismet

# Archive 5 scripts being merged
for f in start-kismet.sh start-kismet-safe.sh start-kismet-skip-adapter.sh \
  kismet-graceful-stop.sh stop-kismet-safe.sh; do
  mv "scripts/$f" "scripts/_archived/phase-6.2/kismet/$f"
done

# Archive 2 scripts being eliminated
for f in safe-stop-kismet.sh update-kismet-service.sh; do
  mv "scripts/$f" "scripts/_archived/phase-6.2/kismet/$f"
done

# Create consolidated kismet.sh
# Implementation merges start/stop/status subcommands
```

---

## 7. Post-Execution Verification

```bash
# Count remaining Kismet scripts (excluding .conf files)
ls scripts/ | grep -i kismet | grep '\.sh$' | wc -l
# EXPECTED: 4 (kismet.sh NEW, start-kismet-with-alfa.sh, setup-kismet-adapter.sh, configure-kismet-gps.sh)

# Count remaining Kismet configs
ls scripts/ | grep -i kismet | grep '\.conf$' | wc -l
# EXPECTED: 3

# Verify production references
test -f scripts/start-kismet-with-alfa.sh && echo "PASS" || echo "FAIL"
test -f scripts/setup-kismet-adapter.sh && echo "PASS" || echo "FAIL"
test -f scripts/kismet-no-auto-source.conf && echo "PASS" || echo "FAIL"
test -f scripts/kismet-site-simple.conf && echo "PASS" || echo "FAIL"

# Syntax check new script
bash -n scripts/kismet.sh && echo "PASS: kismet.sh syntax" || echo "FAIL"

# Verify archived count
ls scripts/_archived/phase-6.2/kismet/ | wc -l
# EXPECTED: 7
```

---

## 8. Metrics

| Metric                           | Value                       |
| -------------------------------- | --------------------------- |
| Files Archived                   | 7 (5 merged + 2 eliminated) |
| Files Created (new consolidated) | 1 (kismet.sh)               |
| Net File Reduction               | 6 files                     |
| Lines Eliminated (archived)      | ~360 lines                  |
| Lines Created                    | ~180 lines in kismet.sh     |
| Net Line Reduction               | ~180 lines                  |

---

## 9. Acceptance Criteria

1. `ls scripts/ | grep -i kismet | grep '\.sh$' | wc -l` returns 4.
2. `ls scripts/ | grep -i kismet | grep '\.conf$' | wc -l` returns 3.
3. `kismet.sh` passes `bash -n` syntax check.
4. All 4 production-referenced Kismet files exist at their original paths (Section 5 table).
5. `scripts/_archived/phase-6.2/kismet/` contains exactly 7 files.
6. Script dependency graph check confirmed no archived Kismet script is `source`d by a surviving script.

---

## 10. Traceability

### Task 6.2.3: Kismet Consolidation (7 .sh archived, 1 new)

| Original Path                  | Disposition | Merged Into                                  |
| ------------------------------ | ----------- | -------------------------------------------- |
| `start-kismet.sh`              | ARCHIVED    | `kismet.sh` start subcommand                 |
| `start-kismet-safe.sh`         | ARCHIVED    | `kismet.sh` start-safe subcommand            |
| `start-kismet-skip-adapter.sh` | ARCHIVED    | `kismet.sh` start-no-adapter subcommand      |
| `kismet-graceful-stop.sh`      | ARCHIVED    | `kismet.sh` stop subcommand                  |
| `stop-kismet-safe.sh`          | ARCHIVED    | `kismet.sh` stop subcommand (primary source) |
| `safe-stop-kismet.sh`          | ARCHIVED    | Subset of stop-kismet-safe.sh                |
| `update-kismet-service.sh`     | ARCHIVED    | One-time setup, not needed ongoing           |

---

## 11. Execution Order Notes

From parent document Section 16:

```
Task 6.2.1 (Duplicate Dirs)     -- No dependencies, execute first
    |
    v
Task 6.2.2 (GSM)                -- Depends on 6.2.1
    |
Task 6.2.3 (Kismet) <<< THIS TASK -- Independent of 6.2.2, can run in parallel
    |
Task 6.2.4 (WiFi)               -- Independent of 6.2.2-6.2.3, can run in parallel
```

**This task (6.2.3) is independent of Tasks 6.2.2 and 6.2.4** and can execute in parallel with them after Task 6.2.1 completes. It does not block any other task except 6.2.7 (remaining organization) which must run last.

---

END OF DOCUMENT
