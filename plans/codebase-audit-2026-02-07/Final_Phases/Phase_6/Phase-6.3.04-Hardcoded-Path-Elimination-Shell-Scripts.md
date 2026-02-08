# Phase 6.3.04: Hardcoded Path Elimination -- Shell Scripts

**Document ID**: ARGOS-AUDIT-P6.3.04
**Parent Document**: Phase-6.3-SYSTEMD-PATHS-AND-DEPLOYMENT-PIPELINE.md
**Original Task ID**: 6.3.4
**Version**: 1.0
**Date**: 2026-02-08
**Author**: Claude Opus 4.6 (Lead Audit Agent)
**Classification**: UNCLASSIFIED // FOR OFFICIAL USE ONLY
**Risk Level**: MEDIUM-HIGH
**Review Standard**: DISA STIG, NIST SP 800-123, CIS Benchmarks

---

## 1. Objective / Problem Statement

147 hardcoded path references exist across 64 shell scripts. These scripts reference `/home/ubuntu` and `/home/pi` paths that do not exist on the current deployment target (user `kali` at `/home/kali/Documents/Argos/Argos`). Every script that uses these paths will fail at runtime on the current system without manual editing.

This task replaces all 147 hardcoded path references with variables sourced from `scripts/lib/argos-env.sh`, the centralized shell environment library created in Task 6.3.1a.

### Current State vs Desired State

| Metric                                     | Current                       | Target                                                   |
| ------------------------------------------ | ----------------------------- | -------------------------------------------------------- |
| Hardcoded `/home/ubuntu` in `scripts/*.sh` | Present across multiple files | 0                                                        |
| Hardcoded `/home/pi` in `scripts/*.sh`     | Present across multiple files | 0                                                        |
| Total hardcoded path references            | 147 across 64 files           | 0                                                        |
| Scripts sourcing `argos-env.sh`            | 0                             | 64                                                       |
| Path variable contract consistency         | N/A                           | 100% (matches `paths.ts` and `.service.template` tokens) |

---

## 2. Prerequisites

- Task 6.3.01 Step 6.3.1a must be complete: `scripts/lib/argos-env.sh` must exist and be sourceable.
- The variable name contract (`ARGOS_DIR`, `ARGOS_USER`, `ARGOS_GROUP`, `ARGOS_HOME`) must be finalized.

---

## 3. Dependencies

- **Upstream**: Task 6.3.01 Step 6.3.1a (`scripts/lib/argos-env.sh` provides the canonical variable definitions)
- **Downstream**: Task 6.3.05 (Config Path Verification) validates all path elimination is complete
- **Cross-phase**: Phase 6.2 (Script Consolidation) depends on `argos-env.sh` being available. Phase 6.3 executes BEFORE Phase 6.2.
- **Independent of**: Tasks 6.3.3, 6.3.6, 6.3.6b, 6.3.7, 6.3.8, 6.3.9, 6.3.10 (can run in parallel on Track B)

---

## 4. Rollback Strategy

```bash
git checkout HEAD -- scripts/
```

For each affected shell script individually. The `scripts/lib/argos-env.sh` library created in Task 6.3.1a is not modified by this task.

---

## 5. Current State / Inventory

### 5.1 Detection Command

```bash
grep -rn '/home/ubuntu\|/home/pi' --include='*.sh' scripts/
# Result: 147 matches across 64 files
```

### 5.2 Batched File Inventory (by directory)

Due to the volume (64 files, 147 references), execution is batched by directory to allow incremental progress and verification.

| Batch | Directory                  | Files | Hardcoded Refs | Notes                                                    |
| ----- | -------------------------- | ----- | -------------- | -------------------------------------------------------- |
| 1     | `scripts/` (root)          | 38    | ~85            | Largest batch; includes start-_, setup-_, fix-\* scripts |
| 2     | `scripts/dev/`             | 3     | ~5             | Development helper scripts                               |
| 3     | `scripts/development/`     | 3     | ~4             | Development environment scripts                          |
| 4     | `scripts/deploy/`          | 3     | ~9             | Deployment automation scripts                            |
| 5     | `scripts/deployment/`      | 1     | ~1             | Deployment configuration                                 |
| 6     | `scripts/gps-integration/` | 3     | ~8             | GPS hardware integration scripts                         |
| 7     | `scripts/infrastructure/`  | 2     | ~3             | Infrastructure management scripts                        |
| 8     | `scripts/install/`         | 1     | ~10            | System dependency installation                           |
| 9     | `scripts/maintenance/`     | 1     | ~7             | Maintenance and cleanup scripts                          |
| 10    | `scripts/testing/`         | 3     | ~7             | Test runner and test setup scripts                       |

### 5.3 Special Files Requiring Attention

Two existing scripts in the codebase attempt automated path replacement. These must be evaluated during this task:

| File                                         | Purpose                    | Action                                                                           |
| -------------------------------------------- | -------------------------- | -------------------------------------------------------------------------------- |
| `scripts/deploy/fix-hardcoded-paths.sh`      | Automated path replacement | Verify correctness; integrate into `generate-services.sh` or delete as redundant |
| `scripts/maintenance/fix-hardcoded-paths.sh` | Automated path replacement | Verify correctness; integrate into `generate-services.sh` or delete as redundant |

These scripts are themselves part of the problem (they contain hardcoded assumptions about source/target paths). After Task 6.3.4 is complete, they become redundant because all paths use variables from `argos-env.sh`.

---

## 6. Actions / Changes

### 6.1 Strategy

Shell scripts are not imported by TypeScript. Many are deployment/setup scripts run once. The fix strategy is:

1. **Source `argos-env.sh`** at the top of each script that uses hardcoded paths:

    ```bash
    # shellcheck source=lib/argos-env.sh
    . "$(dirname "$0")/lib/argos-env.sh"
    ```

    Or for scripts in subdirectories:

    ```bash
    # shellcheck source=../lib/argos-env.sh
    . "$(dirname "$0")/../lib/argos-env.sh"
    ```

2. **Replace hardcoded paths** with `${ARGOS_DIR}`, `${ARGOS_HOME}`, `${ARGOS_USER}`, etc.

3. **Verify syntax** after each batch with `bash -n`.

### 6.2 `scripts/lib/argos-env.sh` Content (reference -- created in Task 6.3.1a)

```bash
#!/usr/bin/env bash
# Argos environment detection -- source this at the top of every script.
# Provides: ARGOS_DIR, ARGOS_USER, ARGOS_GROUP, ARGOS_HOME

if [ -z "${ARGOS_DIR:-}" ]; then
  # Auto-detect: walk up from this script to find package.json
  _SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  _CANDIDATE="${_SCRIPT_DIR}"
  while [ "$_CANDIDATE" != "/" ]; do
    if [ -f "${_CANDIDATE}/package.json" ] && grep -q '"name": "argos"' "${_CANDIDATE}/package.json" 2>/dev/null; then
      ARGOS_DIR="${_CANDIDATE}"
      break
    fi
    _CANDIDATE="$(dirname "$_CANDIDATE")"
  done
  unset _SCRIPT_DIR _CANDIDATE
fi

if [ -z "${ARGOS_DIR:-}" ]; then
  echo "FATAL: Cannot determine ARGOS_DIR. Set it in environment or run from within the Argos repo." >&2
  exit 1
fi

export ARGOS_DIR
export ARGOS_USER="${ARGOS_USER:-$(whoami)}"
export ARGOS_GROUP="${ARGOS_GROUP:-$(id -gn)}"
export ARGOS_HOME="${ARGOS_HOME:-$(eval echo "~${ARGOS_USER}")}"
```

### 6.3 Path Substitution Patterns

For each script, apply these substitutions:

| Hardcoded Pattern             | Replacement Variable                                 |
| ----------------------------- | ---------------------------------------------------- |
| `/home/ubuntu/projects/Argos` | `${ARGOS_DIR}`                                       |
| `/home/pi/projects/Argos`     | `${ARGOS_DIR}`                                       |
| `/home/ubuntu` (standalone)   | `${ARGOS_HOME}`                                      |
| `/home/pi` (standalone)       | `${ARGOS_HOME}`                                      |
| `User=ubuntu` / `User=pi`     | `User=${ARGOS_USER}` (in service-generation context) |

### 6.4 Batch Execution Order

**Batch 1: `scripts/` (root) -- 38 files, ~85 references**

This is the largest and most critical batch. Process files in alphabetical order. For each file:

1. Add `source` line for `argos-env.sh` after the shebang and any `set -euo pipefail` directives.
2. Replace all `/home/ubuntu/projects/Argos` with `${ARGOS_DIR}`.
3. Replace all `/home/pi/projects/Argos` with `${ARGOS_DIR}`.
4. Replace standalone `/home/ubuntu` and `/home/pi` with `${ARGOS_HOME}`.
5. Run `bash -n <script>` to verify syntax.

**Batch 2: `scripts/dev/` -- 3 files, ~5 references**

Source path: `"$(dirname "$0")/../lib/argos-env.sh"` (one level up from `dev/` to reach `lib/`).

**Batch 3: `scripts/development/` -- 3 files, ~4 references**

Source path: `"$(dirname "$0")/../lib/argos-env.sh"` (one level up from `development/` to reach `lib/`).

**Batch 4: `scripts/deploy/` -- 3 files, ~9 references**

Source path: `"$(dirname "$0")/../lib/argos-env.sh"` (one level up from `deploy/` to reach `lib/`).

Special attention: `scripts/deploy/fix-hardcoded-paths.sh` -- evaluate whether this script is still needed after Task 6.3.4 is complete. If redundant, mark for deletion in Phase 6.2.

**Batch 5: `scripts/deployment/` -- 1 file, ~1 reference**

Source path: `"$(dirname "$0")/../lib/argos-env.sh"`.

**Batch 6: `scripts/gps-integration/` -- 3 files, ~8 references**

Source path: `"$(dirname "$0")/../lib/argos-env.sh"`.

**Batch 7: `scripts/infrastructure/` -- 2 files, ~3 references**

Source path: `"$(dirname "$0")/../lib/argos-env.sh"`.

**Batch 8: `scripts/install/` -- 1 file, ~10 references**

Source path: `"$(dirname "$0")/../lib/argos-env.sh"`. This batch has the highest density of hardcoded paths per file (10 references in 1 file), likely `install-system-dependencies.sh`.

**Batch 9: `scripts/maintenance/` -- 1 file, ~7 references**

Source path: `"$(dirname "$0")/../lib/argos-env.sh"`.

Special attention: `scripts/maintenance/fix-hardcoded-paths.sh` -- same evaluation as Batch 4. Likely redundant after this task.

**Batch 10: `scripts/testing/` -- 3 files, ~7 references**

Source path: `"$(dirname "$0")/../lib/argos-env.sh"`.

### 6.5 Example Transformation

**Before** (`scripts/start-droneid.sh`, representative example):

```bash
#!/usr/bin/env bash
set -euo pipefail

cd /home/pi/projects/Argos/RemoteIDReceiver/Receiver
source /home/pi/projects/Argos/RemoteIDReceiver/Receiver/venv/bin/activate
python3 /home/pi/projects/Argos/RemoteIDReceiver/Receiver/backend/dronesniffer/main.py -p 80
```

**After:**

```bash
#!/usr/bin/env bash
set -euo pipefail

# shellcheck source=lib/argos-env.sh
. "$(dirname "$0")/lib/argos-env.sh"

cd "${ARGOS_DIR}/RemoteIDReceiver/Receiver"
source "${ARGOS_DIR}/RemoteIDReceiver/Receiver/venv/bin/activate"
python3 "${ARGOS_DIR}/RemoteIDReceiver/Receiver/backend/dronesniffer/main.py" -p 80
```

---

## 7. Verification Commands

```bash
# 1. Verify zero hardcoded /home/ubuntu in shell scripts
grep -rn '/home/ubuntu' --include='*.sh' scripts/
# Expected: no output

# 2. Verify zero hardcoded /home/pi in shell scripts
grep -rn '/home/pi' --include='*.sh' scripts/
# Expected: no output

# 3. Verify argos-env.sh is sourceable (prerequisite from 6.3.1a)
bash -n scripts/lib/argos-env.sh
# Expected: exit 0

# 4. Verify auto-detection works from a subdirectory
cd /home/kali/Documents/Argos/Argos/scripts/dev && source ../lib/argos-env.sh && echo "ARGOS_DIR=$ARGOS_DIR"
# Expected: prints /home/kali/Documents/Argos/Argos

# 5. Spot-check 5 scripts still have valid syntax
bash -n scripts/start-droneid.sh
bash -n scripts/start-gsmevil2-fixed.sh
bash -n scripts/setup-celltower-db.sh
bash -n scripts/gsm-evil-start.sh
bash -n scripts/setup-gsmevil-sudoers.sh
# Expected: all exit 0 (syntax valid)

# 6. Verify all modified scripts source argos-env.sh
for f in $(grep -rl 'ARGOS_DIR' --include='*.sh' scripts/ | grep -v 'lib/argos-env.sh'); do
  grep -q 'argos-env.sh' "$f" || echo "MISSING SOURCE: $f"
done
# Expected: no output (all scripts that use ARGOS_DIR source the library)

# 7. Count remaining hardcoded home paths (combined check)
grep -rn '/home/ubuntu\|/home/pi' --include='*.sh' scripts/ | wc -l
# Expected: 0
```

---

## 8. Acceptance Criteria

From parent Section 13 verification checklist:

| #   | Check                                      | Command                                             | Expected  |
| --- | ------------------------------------------ | --------------------------------------------------- | --------- |
| 7   | No hardcoded /home/ubuntu in scripts/\*.sh | `grep -rn '/home/ubuntu' --include='*.sh' scripts/` | No output |
| 8   | No hardcoded /home/pi in scripts/\*.sh     | `grep -rn '/home/pi' --include='*.sh' scripts/`     | No output |
| 32  | argos-env.sh exists and is sourceable      | `bash -n scripts/lib/argos-env.sh`                  | Exit 0    |

### Additional Pass/Fail Criteria

1. All 64 modified scripts pass `bash -n` syntax check (exit 0).
2. Every script that references `${ARGOS_DIR}`, `${ARGOS_HOME}`, `${ARGOS_USER}`, or `${ARGOS_GROUP}` sources `argos-env.sh` before first use.
3. The `fix-hardcoded-paths.sh` scripts in `scripts/deploy/` and `scripts/maintenance/` are evaluated and documented as either integrated or marked for deletion.
4. No new hardcoded `/home/<user>` paths are introduced.
5. Variable substitution uses `${VAR}` form (not `$VAR`) for safety in string concatenation contexts.

---

## 9. Traceability

| Finding                                             | Task                            | Status  |
| --------------------------------------------------- | ------------------------------- | ------- |
| 147 hardcoded paths in 64 shell scripts             | 6.3.4                           | PLANNED |
| Scripts reference non-existent users (ubuntu, pi)   | 6.3.4                           | PLANNED |
| No centralized path configuration for shell scripts | 6.3.4 (via 6.3.1a argos-env.sh) | PLANNED |

### Risk Assessment

| Risk                                                              | Likelihood | Impact | Mitigation                                                                                         |
| ----------------------------------------------------------------- | ---------- | ------ | -------------------------------------------------------------------------------------------------- |
| Shell script path replacement breaks unrelated functionality      | Medium     | Medium | `bash -n` syntax check all scripts; integration test critical paths                                |
| Relative path to argos-env.sh incorrect for deeply nested scripts | Low        | Low    | Test sourcing from every subdirectory level; use auto-detection fallback in argos-env.sh           |
| Scripts run outside repo directory fail auto-detection            | Low        | Medium | Auto-detection walks up to filesystem root; if no package.json found, exits with clear FATAL error |

---

## 10. Execution Order Notes

This task runs on **Track B** (independent of the service templating/hardening chain on Track A).

**Position in execution chain:**

- After: Task 6.3.1a (argos-env.sh must exist)
- Parallel with: Tasks 6.3.3, 6.3.6, 6.3.6b
- Before: Task 6.3.5 (final verification) and Phase 6.2 (Script Consolidation)

**Recommended execution within this task:**

1. Verify `scripts/lib/argos-env.sh` exists and is sourceable (prerequisite).
2. Process Batch 1 (root `scripts/` directory -- largest batch, establishes the pattern).
3. Run verification commands for Batch 1.
4. Process Batches 2-10 in order.
5. Run full verification commands.
6. Evaluate `fix-hardcoded-paths.sh` scripts and document decision.

**Phase-level execution order**: Phase 6.3 must execute BEFORE Phase 6.2 (Script Consolidation). The centralized path library (`argos-env.sh`) created here must be available for consolidated scripts to `source` from day one.

---

END OF DOCUMENT
