# Phase 6.4.07: --help and --dry-run Support

**Document ID**: ARGOS-AUDIT-P6.4.07
**Parent Document**: Phase-6.4-SHELL-SCRIPT-STANDARDIZATION-AND-QUALITY.md
**Original Task ID**: 6.4.7
**Version**: 1.0
**Date**: 2026-02-08
**Author**: Claude Opus 4.6 (Lead Audit Agent)
**Classification**: UNCLASSIFIED // FOR OFFICIAL USE ONLY
**Risk Level**: LOW (additive feature -- no existing behavior is changed)
**Review Standard**: CERT Secure Coding (SH), MISRA (adapted), NASA/JPL Rule Set (adapted)
**Target Corpus**: ~75-80 active scripts surviving Phase 6.2 consolidation

---

## 1. Objective

Add `--help` and `--dry-run` flag support to all scripts that perform destructive, stateful, or service-affecting operations. This enables operators to understand script behavior before execution and to preview changes without committing them.

**Current state:**

- 9 scripts (4.46%) support `--help`
- 0 scripts (0%) support `--dry-run`

**Target state:** All service management, installation, and deployment scripts (~55 post-consolidation) support both flags. Read-only diagnostic and monitoring scripts are excluded.

---

## 2. Prerequisites

| ID    | Prerequisite                                      | Verification Command                                                                 |
| ----- | ------------------------------------------------- | ------------------------------------------------------------------------------------ |
| PRE-1 | Phase 6.2 (consolidation) is complete             | `test -f plans/codebase-audit-2026-02-07/Final_Phases/Phase_6/Phase-6.2-COMPLETE.md` |
| PRE-2 | All dead scripts removed per Phase 6.2            | `find scripts/ -name "*.sh" -type f \| wc -l` returns 75-80                          |
| PRE-3 | No scripts reference deleted scripts              | `grep -rl "source.*deleted_script" scripts/ --include="*.sh" \| wc -l` returns 0     |
| PRE-4 | shellcheck 0.10.0+ installed                      | `shellcheck --version \| grep -q "version: 0.1"`                                     |
| PRE-5 | Git working tree clean                            | `git diff --quiet HEAD -- scripts/`                                                  |
| PRE-6 | Phase 6.3 (hardcoded paths) complete or in-flight | Document references Phase 6.3 for 62 hardcoded-path scripts                          |

**Execution environment:** Kali Linux 2025.4, aarch64 (RPi 5), kernel 6.12.34+rpt-rpi-2712.

### Task-Specific Prerequisites

- **Task 6.4.11 (Shared Library Creation) MUST be complete.** The `run_cmd` function and argument parsing patterns from `scripts/lib/args.sh` must be available.
- **Task 6.4.5 (Variable Quoting and Input Validation) SHOULD be complete.** Argument parsing depends on validated input patterns.
- **Task 6.4.3 (Header Block Standardization) MUST be complete.** Headers document the flags; the header must reference `--help` and `--dry-run`.

---

## 3. Dependencies

| Dependency | Direction | Task   | Reason                                                               |
| ---------- | --------- | ------ | -------------------------------------------------------------------- |
| AFTER      | Upstream  | 6.4.11 | `run_cmd` function and args parsing patterns must exist in common.sh |
| AFTER      | Upstream  | 6.4.3  | Headers must be in place to document the new flags                   |
| AFTER      | Upstream  | 6.4.5  | Argument validation patterns should be established first             |
| PARALLEL   | Peer      | 6.4.8  | Idempotency fixes can execute in parallel (independent scope)        |

---

## 4. Rollback Strategy

### Per-Task Commit

This task MUST be committed as a separate, atomic Git commit:

```
refactor(scripts): Phase 6.4.7 - help and dry-run support
```

This enables targeted rollback via `git revert <commit-sha>` without affecting other tasks.

### Rollback Decision Criteria

Immediate rollback if:

- `bash -n` syntax check fails on any modified script
- Any script's default behavior (no flags) changes after adding flag parsing
- `--help` produces output on stderr instead of stdout (must be stdout, exit 0)

---

## 5. Baseline Metrics

| Metric                   | Count | Percentage |
| ------------------------ | ----- | ---------- |
| `--help` flag support    | 9     | 4.46%      |
| `--dry-run` flag support | 0     | 0%         |

### Scope

This requirement applies to scripts in the following categories:

| Category           | Criteria                                      | Estimated Count        |
| ------------------ | --------------------------------------------- | ---------------------- |
| Service management | Starts, stops, or restarts systemd services   | ~30 post-consolidation |
| Installation       | Installs packages, modifies system config     | ~15 post-consolidation |
| Deployment         | Deploys containers, images, or configurations | ~10 post-consolidation |

**Excluded:** Diagnostic scripts (read-only), monitoring scripts (read-only), and one-off test scripts.

---

## 6. Task Details

### Required --help Implementation

```bash
usage() {
    cat <<USAGE
$(basename "$0") -- <one-line purpose>

USAGE:
    $(basename "$0") [OPTIONS] <required_args>

OPTIONS:
    -h, --help       Show this help message and exit
    -n, --dry-run    Show what would be done without making changes
    -v, --verbose    Enable verbose output

ARGUMENTS:
    <arg1>           Description of first argument

EXAMPLES:
    $(basename "$0") --dry-run
    $(basename "$0") -v wlan1

EXIT CODES:
    0   Success
    1   General error
    2   Invalid usage
    3   Missing dependency
USAGE
}

# Parse arguments
DRY_RUN=false
VERBOSE=false
while [[ $# -gt 0 ]]; do
    case "${1}" in
        -h|--help)
            usage
            exit 0
            ;;
        -n|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        --)
            shift
            break
            ;;
        -*)
            echo "ERROR: Unknown option: ${1}" >&2
            usage >&2
            exit 2
            ;;
        *)
            break
            ;;
    esac
done
```

### Required --dry-run Implementation

The `--dry-run` flag MUST prevent all side effects while printing every command that WOULD be executed. Implementation uses `run_cmd` from `scripts/lib/common.sh`:

```bash
# run_cmd is defined in scripts/lib/args.sh (sourced via common.sh):
run_cmd() {
    if [[ "${DRY_RUN}" == "true" ]]; then
        log_info "[DRY-RUN] Would execute: $*"
        return 0
    fi
    "$@"
}

# Usage in script body:
run_cmd systemctl restart kismet
run_cmd docker compose up -d
run_cmd cp "${SOURCE}" "${DEST}"
```

### Before/After Example

**Before (`scripts/start-kismet-safe.sh`):**

```bash
#!/bin/bash

echo "Starting Kismet safely..."
sudo systemctl start kismet-auto-wlan1
```

**After:**

```bash
#!/usr/bin/env bash
set -euo pipefail
# -------------------------------------------------------------------
# Script:        start-kismet-safe.sh
# Purpose:       Start Kismet service and configure WiFi adapter sources
# Usage:         sudo ./start-kismet-safe.sh [-h|--help] [-n|--dry-run] [adapter]
# Prerequisites: kismet (systemd service), WiFi adapter, root privileges
# Exit Codes:    0=success, 1=error, 2=usage, 3=missing dependency
# -------------------------------------------------------------------

source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"

DRY_RUN=false
while [[ $# -gt 0 ]]; do
    case "${1}" in
        -h|--help) usage; exit 0 ;;
        -n|--dry-run) DRY_RUN=true; shift ;;
        -*) log_error "Unknown option: ${1}"; usage >&2; exit 2 ;;
        *) break ;;
    esac
done

log_info "Starting Kismet safely..."
run_cmd sudo systemctl start kismet-auto-wlan1
```

### Detection

```bash
# Scripts that manage services but lack --help
for f in $(grep -rl "systemctl\|docker compose\|docker-compose" scripts/ --include="*.sh"); do
    grep -q "\-\-help\|-h)" "$f" || echo "MISSING --help: $f"
done

# Scripts that manage services but lack --dry-run
for f in $(grep -rl "systemctl\|docker compose\|docker-compose" scripts/ --include="*.sh"); do
    grep -q "\-\-dry-run\|-n)" "$f" || echo "MISSING --dry-run: $f"
done

# Scripts that install packages but lack flags
for f in $(grep -rl "apt-get install\|apt install" scripts/ --include="*.sh"); do
    grep -q "\-\-help\|-h)" "$f" || echo "MISSING --help: $f"
done
```

---

## 7. Verification Commands

```bash
# All service management scripts must support --help
for f in $(grep -rl "systemctl\|docker compose\|docker-compose" scripts/ --include="*.sh"); do
    grep -q "\-\-help\|-h)" "$f" || echo "MISSING --help: $f"
done
# Expected: no output

# All service management scripts must support --dry-run
for f in $(grep -rl "systemctl\|docker compose\|docker-compose" scripts/ --include="*.sh"); do
    grep -q "\-\-dry-run\|-n)" "$f" || echo "MISSING --dry-run: $f"
done
# Expected: no output

# --help must exit 0
for f in $(find scripts/ -name "*.sh" -type f -exec grep -l "\-\-help" {} \;); do
    bash "$f" --help >/dev/null 2>&1
    RC=$?
    [ "$RC" -ne 0 ] && echo "FAIL: $f --help returned $RC (expected 0)"
done
# Expected: no output

# Argument parsing uses while/case (not ad-hoc if chains)
for f in $(grep -rl "\-\-help" scripts/ --include="*.sh"); do
    grep -q "case.*in" "$f" || echo "NO CASE STATEMENT: $f"
done
# Expected: no output

# Syntax check
find scripts/ -name "*.sh" -type f -exec bash -n {} \;
# Expected: exit 0
```

---

## 8. Acceptance Criteria

- [ ] All service management, installation, and deployment scripts support `--help`
- [ ] All service management, installation, and deployment scripts support `--dry-run`
- [ ] `--help` prints usage to stdout and exits with code 0
- [ ] `--dry-run` produces no side effects (no file writes, no service changes, no network calls)
- [ ] Unknown flags cause exit code 2 and print usage to stderr
- [ ] Argument parsing uses a `while/case` loop (not ad-hoc `if` chains)
- [ ] All `run_cmd` calls use the shared `run_cmd` from `common.sh` (not per-script definitions)

---

## 9. Traceability

| Task  | Deficiency                       | Standard           | Files Affected                 | Verification Command                                        |
| ----- | -------------------------------- | ------------------ | ------------------------------ | ----------------------------------------------------------- |
| 6.4.7 | 0 scripts with --dry-run support | Operational safety | ~30 service management scripts | `grep -rl "\-\-dry-run" scripts/ --include="*.sh" \| wc -l` |

---

## 10. Execution Order Notes

**Position in critical path:** 8th (after 6.4.11, 6.4.1, 6.4.6, 6.4.2, 6.4.3, 6.4.4, 6.4.5)

```
... --> 6.4.5 (quoting/validation) --> 6.4.13 (security) --> 6.4.7 (help/dry-run) --> 6.4.8 (idempotency) --> ...
```

According to the parent document Appendix A, Tasks 6.4.7 and 6.4.8 can execute in parallel because they have independent scopes. Task 6.4.7 adds argument parsing; Task 6.4.8 fixes idempotency patterns. Neither modifies the other's work.

This task is additive (new functionality) rather than corrective (fixing bugs), so it carries LOW risk.

---

```
END OF TASK DOCUMENT
Task:     6.4.7 - --help and --dry-run Support
Status:   FINAL
Version:  1.0
Date:     2026-02-08
```
