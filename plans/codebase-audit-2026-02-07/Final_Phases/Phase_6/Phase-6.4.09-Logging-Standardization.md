# Phase 6.4.09: Logging Standardization

**Document ID**: ARGOS-AUDIT-P6.4.09
**Parent Document**: Phase-6.4-SHELL-SCRIPT-STANDARDIZATION-AND-QUALITY.md
**Original Task ID**: 6.4.9
**Version**: 1.0
**Date**: 2026-02-08
**Author**: Claude Opus 4.6 (Lead Audit Agent)
**Classification**: UNCLASSIFIED // FOR OFFICIAL USE ONLY
**Risk Level**: LOW (output format change -- no behavioral change; risk of breaking scripts that capture stderr)
**Review Standard**: CERT Secure Coding (SH), MISRA (adapted), NASA/JPL Rule Set (adapted)
**Target Corpus**: ~75-80 active scripts surviving Phase 6.2 consolidation

---

## 1. Objective

Standardize all script logging to a consistent, structured, machine-parseable format using the centralized logging functions from `scripts/lib/common.sh`. Eliminate all per-script color definitions and ad-hoc logging functions.

**Current state:** The codebase uses at least 6 different logging styles:

| Style            | Example                             | Script Count |
| ---------------- | ----------------------------------- | ------------ |
| Plain echo       | `echo "Starting..."`                | ~150         |
| Bracketed tag    | `echo "[PASS] Done"`                | ~15          |
| Color with level | `echo -e "${GREEN}[INFO]${NC} msg"` | ~49          |
| Function-based   | `info "msg"`, `error "msg"`         | ~5           |
| No logging       | (silent operation)                  | ~20          |
| Mixed            | Different styles in same script     | ~30          |

**Target state:** All informational output uses `log_info`/`log_warn`/`log_error` from `common.sh`. Zero per-script color definitions. Zero per-script logging function definitions. All log output goes to stderr. Color output is disabled when stderr is not a terminal.

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

- **Task 6.4.11 (Shared Library Creation) MUST be complete.** The logging functions (`log_info`, `log_warn`, `log_error`, `log_fatal`, `log_debug`) must be defined in `scripts/lib/log.sh` and available via `common.sh`.
- **Task 6.4.8 (Idempotency Fixes) SHOULD be complete.** Idempotency patterns use `log_info` to report actions taken or skipped.

---

## 3. Dependencies

| Dependency | Direction  | Task   | Reason                                                     |
| ---------- | ---------- | ------ | ---------------------------------------------------------- |
| AFTER      | Upstream   | 6.4.11 | Logging functions must be defined in common.sh             |
| AFTER      | Upstream   | 6.4.8  | Idempotency patterns reference logging functions           |
| BEFORE     | Downstream | 6.4.10 | Exit code conventions depend on logging being standardized |

---

## 4. Rollback Strategy

### Per-Task Commit

This task MUST be committed as a separate, atomic Git commit:

```
refactor(scripts): Phase 6.4.9 - logging standardization
```

This enables targeted rollback via `git revert <commit-sha>` without affecting other tasks.

### Rollback Decision Criteria

Immediate rollback if:

- `bash -n` syntax check fails on any modified script
- Any script that captures stderr (`2>&1`) breaks due to new log format in stderr
- Log output is not parseable by `awk -F'[][]' '{print $4}'` (level extraction)

---

## 5. Baseline Metrics

| Metric                                | Count |
| ------------------------------------- | ----- |
| Per-script color definitions          | 49    |
| Per-script logging function defs      | ~5    |
| Plain `echo` for informational output | ~150  |

### Baseline Reproduction Commands

```bash
cd /home/kali/Documents/Argos/Argos

# Scripts with per-script color definitions
grep -rl "RED=.*033\|GREEN=.*033\|YELLOW=.*033" scripts/ --include="*.sh" | wc -l
# Result: 49

# Scripts with per-script log functions
grep -rn "^info()\|^warn()\|^error()\|^log()" scripts/ --include="*.sh" | wc -l
```

---

## 6. Task Details

### Required Log Format

```
[2026-02-08T14:30:00Z] [INFO] [script-name.sh] Message text here
[2026-02-08T14:30:01Z] [WARN] [script-name.sh] Warning message
[2026-02-08T14:30:02Z] [ERROR] [script-name.sh] Error message
```

Format specification:

- **Timestamp**: ISO 8601 UTC format from `date -u +"%Y-%m-%dT%H:%M:%SZ"`
- **Level**: One of `DEBUG`, `INFO`, `WARN`, `ERROR`, `FATAL`
- **Script name**: `$(basename "$0")` -- identifies the source in aggregated logs
- **Message**: Free-form text, no trailing newline (echo provides it)

### Implementation via Shared Library

The logging functions are defined in `scripts/lib/log.sh` (via `scripts/lib/common.sh`, Task 6.4.11) and sourced by every script. Individual scripts MUST NOT define their own logging functions.

```bash
# In scripts/lib/log.sh (sourced via common.sh):
_log() {
    local level="${1}"
    shift
    local timestamp
    timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    local script_name
    script_name=$(basename "${BASH_SOURCE[2]:-${BASH_SOURCE[1]:-$0}}")
    local color=""
    case "${level}" in
        ERROR|FATAL) color="${_CLR_RED}" ;;
        WARN)        color="${_CLR_YELLOW}" ;;
        INFO)        color="${_CLR_GREEN}" ;;
        DEBUG)       color="${_CLR_BLUE}" ;;
    esac
    echo -e "${color}[${timestamp}] [${level}] [${script_name}]${_CLR_NC} $*" >&2
}

log_debug() { _log "DEBUG" "$@"; }
log_info()  { _log "INFO" "$@"; }
log_warn()  { _log "WARN" "$@"; }
log_error() { _log "ERROR" "$@"; }
log_fatal() { _log "FATAL" "$@"; exit "${EXIT_ERROR}"; }
```

### Log Level Filtering

The `ARGOS_LOG_LEVEL` environment variable controls minimum log level:

| ARGOS_LOG_LEVEL | DEBUG  | INFO   | WARN   | ERROR | FATAL |
| --------------- | ------ | ------ | ------ | ----- | ----- |
| DEBUG           | shown  | shown  | shown  | shown | shown |
| INFO (default)  | hidden | shown  | shown  | shown | shown |
| WARN            | hidden | hidden | shown  | shown | shown |
| ERROR           | hidden | hidden | hidden | shown | shown |

### Color Output

Color codes MUST only be used when output is connected to a terminal (not piped or redirected):

```bash
# In scripts/lib/log.sh:
if [[ -t 2 ]]; then
    readonly _CLR_RED='\033[0;31m'
    readonly _CLR_GREEN='\033[0;32m'
    readonly _CLR_YELLOW='\033[1;33m'
    readonly _CLR_BLUE='\033[0;34m'
    readonly _CLR_NC='\033[0m'
else
    readonly _CLR_RED=''
    readonly _CLR_GREEN=''
    readonly _CLR_YELLOW=''
    readonly _CLR_BLUE=''
    readonly _CLR_NC=''
fi
```

### Migration Path

**Step 1:** Replace all informational `echo` statements with `log_info`:

```bash
# Before:
echo "Starting Kismet safely..."

# After:
log_info "Starting Kismet safely..."
```

**Step 2:** Replace all error `echo` statements with `log_error`:

```bash
# Before:
echo "ERROR: Docker is not running" >&2

# After:
log_error "Docker is not running"
```

**Step 3:** Remove all per-script color variable definitions and custom `info()`/`warn()`/`error()` function definitions. These are now provided by `common.sh`.

**Exceptions:** `echo` statements that produce machine-readable output (JSON, CSV, status codes) or user-facing prompts (`read -p`) MUST NOT be converted to logging functions. These use stdout; logging uses stderr.

### Detection

```bash
# Scripts with per-script color definitions (to be removed)
grep -rl "RED=.*033\|GREEN=.*033\|YELLOW=.*033" scripts/ --include="*.sh"

# Scripts with per-script log functions (to be removed)
grep -rn "^info()\|^warn()\|^error()\|^log()" scripts/ --include="*.sh"

# Plain echo statements that should be log_info (heuristic)
grep -rn 'echo ".*\.\.\."' scripts/ --include="*.sh" | head -20
```

---

## 7. Verification Commands

```bash
# No per-script color definitions
grep -rl "RED=.*033" scripts/ --include="*.sh" | grep -v "lib/common.sh\|lib/log.sh" | wc -l
# Expected: 0

# No per-script log function definitions
grep -rn "^info()\|^warn()\|^error()" scripts/ --include="*.sh" | grep -v "lib/common.sh\|lib/log.sh" | wc -l
# Expected: 0

# All scripts source common.sh
find scripts/ -name "*.sh" -type f -not -path "*/lib/*" -exec sh -c \
  'grep -q "source.*lib/common.sh\|\. .*lib/common.sh" "$1" || echo "MISSING: $1"' _ {} \;
# Expected: no output (all scripts source common.sh)

# Log output goes to stderr (spot check)
bash -c 'source scripts/lib/common.sh; log_info "test"' 2>/dev/null
# Expected: no output on stdout (log goes to stderr)

bash -c 'source scripts/lib/common.sh; log_info "test"' 2>&1 | grep -q "INFO"
# Expected: exit 0 (log appears on stderr)

# Color disabled when not terminal
bash -c 'source scripts/lib/common.sh; log_info "test"' 2>&1 | grep -q "033"
# Expected: exit 1 (no ANSI codes when stderr is not a terminal)

# Syntax check
find scripts/ -name "*.sh" -type f -exec bash -n {} \;
# Expected: exit 0
```

---

## 8. Acceptance Criteria

- [ ] All informational `echo` statements converted to `log_info`/`log_warn`/`log_error`
- [ ] All per-script color definitions removed (centralized in `log.sh`/`common.sh`)
- [ ] All per-script logging function definitions removed (centralized in `log.sh`/`common.sh`)
- [ ] Log output goes to stderr (stdout reserved for machine-readable data)
- [ ] Color output is disabled when stderr is not a terminal
- [ ] `ARGOS_LOG_LEVEL` environment variable controls verbosity
- [ ] Log format is parseable: `awk -F'[][]' '{print $4}'` extracts level

---

## 9. Traceability

| Task  | Deficiency                      | Standard                  | Files Affected     | Verification Command                                      |
| ----- | ------------------------------- | ------------------------- | ------------------ | --------------------------------------------------------- |
| 6.4.9 | 6+ inconsistent logging formats | NASA/JPL Rule 2 (adapted) | All ~75-80 scripts | `grep -rl "RED=.*033" scripts/ --include="*.sh" \| wc -l` |

---

## 10. Execution Order Notes

**Position in critical path:** 10th (after 6.4.8, before 6.4.10)

```
... --> 6.4.7 (help/dry-run) \
        6.4.8 (idempotency)  / --> 6.4.9 (logging) --> 6.4.10 (exit codes) --> ...
```

This task depends on Task 6.4.11 (shared library, which provides the logging functions) and benefits from Task 6.4.8 (idempotency patterns use logging). It must complete before Task 6.4.10 (exit codes) because exit code handling references logging functions.

The primary risk is that scripts currently capturing stderr (`2>&1`) may break when log messages change format. Audit all `2>&1` redirections before converting echo to log functions.

---

```
END OF TASK DOCUMENT
Task:     6.4.9 - Logging Standardization
Status:   FINAL
Version:  1.0
Date:     2026-02-08
```
