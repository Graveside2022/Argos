# Phase 6.4: Shell Script Standardization and Quality Enforcement

```
Classification:  UNCLASSIFIED // FOUO
Project:         Argos SDR & Network Analysis Console
Phase:           6.4 of Codebase Audit 2026-02-07
Scope:           Shell script quality, safety, and maintainability standards
Author:          Alex Thompson, Principal Software Architect
Date:            2026-02-08
Revision:        1.1 FINAL (CORRECTED)
Standards:       CERT Secure Coding (SH), MISRA (adapted), NASA/JPL Rule Set (adapted)
Prerequisite:    Phase 6.2 (Shell Script Consolidation) MUST be complete
Target Corpus:   ~75-80 active scripts surviving Phase 6.2 consolidation
```

---

## Table of Contents

1.  [Executive Summary](#1-executive-summary)
2.  [Prerequisites and Entry Criteria](#2-prerequisites-and-entry-criteria)
3.  [Rollback Strategy](#3-rollback-strategy)
4.  [Baseline Evidence](#4-baseline-evidence)
5.  [Task 6.4.1: Shebang Standardization](#task-641-shebang-standardization)
6.  [Task 6.4.2: Strict Mode Enforcement](#task-642-strict-mode-enforcement)
7.  [Task 6.4.3: Header Block Standardization](#task-643-header-block-standardization)
8.  [Task 6.4.4: ShellCheck Compliance](#task-644-shellcheck-compliance)
9.  [Task 6.4.5: Variable Quoting and Input Validation](#task-645-variable-quoting-and-input-validation)
10. [Task 6.4.6: Trap and Cleanup Handlers](#task-646-trap-and-cleanup-handlers)
11. [Task 6.4.7: --help and --dry-run Support](#task-647---help-and---dry-run-support)
12. [Task 6.4.8: Idempotency Fixes](#task-648-idempotency-fixes)
13. [Task 6.4.9: Logging Standardization](#task-649-logging-standardization)
14. [Task 6.4.10: Exit Code Conventions](#task-6410-exit-code-conventions)
15. [Task 6.4.11: Shared Library Creation](#task-6411-shared-library-creation)
16. [Task 6.4.12: CI Integration](#task-6412-ci-integration)
17. [Verification Checklist](#17-verification-checklist)
18. [Traceability Matrix](#18-traceability-matrix)

---

## 1. Executive Summary

The Argos `scripts/` directory contains 202 shell scripts. Phase 6.2 consolidates these to approximately 75-80 active scripts by eliminating duplicates and dead code. This phase (6.4) takes those surviving scripts and brings them to a uniform quality standard suitable for production deployment on Army EW training platforms.

**Current state (pre-Phase 6.2 baseline, 202 scripts):**

| Metric                                   | Count | Percentage |
| ---------------------------------------- | ----- | ---------- |
| Shebang `#!/bin/bash` (hardcoded)        | 200   | 99.0%      |
| Shebang `#!/usr/bin/env bash` (portable) | 0     | 0%         |
| Malformed shebang (`#\!/bin/bash`)       | 1     | 0.5%       |
| Missing shebang entirely (SC2148)        | 1     | 0.5%       |
| `set -euo pipefail` (full strict mode)   | 31    | 15.3%      |
| `set -e` only (partial, no pipefail)     | 34    | 16.8%      |
| `trap` only (no `set -e`)                | 3     | 1.5%       |
| No error handling whatsoever             | 134   | 66.3%      |
| Trap handlers present                    | 31    | 15.3%      |
| `--help` flag support                    | 8     | 3.96%      |
| `--dry-run` flag support                 | 0     | 0%         |
| Documentation header (Purpose/Usage)     | 19    | 9.4%       |
| Accept parameters (`$1`, `$@`)           | 81    | 40.1%      |
| Use `mktemp` or `/tmp/`                  | 60    | 29.7%      |
| Manage systemd services                  | 81    | 40.1%      |
| Color code definitions                   | 49    | 24.3%      |
| Explicit exit codes                      | 114   | 56.4%      |
| Non-standard exit codes (2+)             | 2     | 1.0%       |
| Source other scripts                     | 38    | 18.8%      |

**ShellCheck analysis (shellcheck 0.11.0):**

| Severity  | Files Affected | Total Findings |
| --------- | -------------- | -------------- |
| error     | 5              | 6              |
| warning   | 84             | 336            |
| info      | --             | 402            |
| style     | --             | 23             |
| **TOTAL** | **--**         | **767**        |

**Top ShellCheck violations by frequency:**

| Rank  | Code       | Count   | Description                                                     | Security Impact                                     |
| ----- | ---------- | ------- | --------------------------------------------------------------- | --------------------------------------------------- |
| **1** | **SC2086** | **220** | **Double-quote to prevent globbing/word splitting**             | **HIGH -- injection vector via unquoted variables** |
| 2     | SC2155     | 149     | Declare and assign separately to avoid masking return values    | MEDIUM -- masked error codes                        |
| 3     | SC2024     | 73      | `sudo` doesn't affect redirects; use `tee`                      | LOW -- incorrect privilege application              |
| 4     | SC2329     | 58      | Unused function (dead code)                                     | LOW -- code bloat                                   |
| 5     | SC2164     | 38      | Use `cd ... \|\| exit` in case `cd` fails                       | MEDIUM -- silent directory errors                   |
| 6     | SC2034     | 31      | Variable appears unused (verify intentional before suppressing) | LOW -- dead code                                    |
| 7     | SC2046     | 22      | Quote this to prevent word splitting                            | MEDIUM -- injection risk                            |
| 8     | SC2206     | 14      | Quote to prevent word splitting/globbing in array assignment    | LOW -- data corruption                              |

> **NOTE:** SC2086 (unquoted variables, 220 instances) is the MOST DANGEROUS shell scripting vulnerability -- it enables word splitting and glob injection. This must be the #1 remediation priority, not SC2155.

**Idempotency violations (system config append patterns):**

| File                                         | Target                             | Pattern                                |
| -------------------------------------------- | ---------------------------------- | -------------------------------------- |
| `scripts/setup-host-complete.sh:312`         | `/etc/sysctl.conf`                 | `cat >>` (duplicate entries on re-run) |
| `scripts/setup-host-complete.sh:331`         | `/etc/security/limits.conf`        | `cat >>` (duplicate entries on re-run) |
| `scripts/install-system-dependencies.sh:289` | `/etc/security/limits.conf`        | `cat >>` (duplicate entries on re-run) |
| `scripts/install-system-dependencies.sh:302` | `/etc/sysctl.conf`                 | `cat >>` (duplicate entries on re-run) |
| `scripts/setup-swap.sh:116`                  | `/etc/sysctl.d/99-swappiness.conf` | `echo >` (overwrite, safe)             |

**vm.swappiness conflict:**

- `scripts/setup-host-complete.sh:324` sets `vm.swappiness = 10`
- `scripts/install-system-dependencies.sh:307` sets `vm.swappiness = 10`
- `scripts/setup-swap.sh:116` sets `vm.swappiness=10`
- Live system runs `vm.swappiness=60` (correct for zram configuration)
- Three scripts disagree with production configuration.

---

## 2. Prerequisites and Entry Criteria

Phase 6.4 MUST NOT begin until the following conditions are verified:

| ID    | Prerequisite                                      | Verification Command                                                                 |
| ----- | ------------------------------------------------- | ------------------------------------------------------------------------------------ |
| PRE-1 | Phase 6.2 (consolidation) is complete             | `test -f plans/codebase-audit-2026-02-07/Final_Phases/Phase_6/Phase-6.2-COMPLETE.md` |
| PRE-2 | All dead scripts removed per Phase 6.2            | `find scripts/ -name "*.sh" -type f \| wc -l` returns 75-80                          |
| PRE-3 | No scripts reference deleted scripts              | `grep -rl "source.*deleted_script" scripts/ --include="*.sh" \| wc -l` returns 0     |
| PRE-4 | shellcheck 0.10.0+ installed                      | `shellcheck --version \| grep -q "version: 0.1"`                                     |
| PRE-5 | Git working tree clean                            | `git diff --quiet HEAD -- scripts/`                                                  |
| PRE-6 | Phase 6.3 (hardcoded paths) complete or in-flight | Document references Phase 6.3 for 62 hardcoded-path scripts                          |

**Execution environment:** Kali Linux 2025.4, aarch64 (RPi 5), kernel 6.12.34+rpt-rpi-2712.

---

## 3. Rollback Strategy

### 3.1 Pre-Execution Snapshot

Before ANY modification in this phase:

```bash
# Create timestamped backup of the entire scripts directory
BACKUP_DIR="/home/kali/Documents/Argos/backups/phase-6.4-$(date +%Y%m%d-%H%M%S)"
mkdir -p "${BACKUP_DIR}"
cp -a /home/kali/Documents/Argos/Argos/scripts/ "${BACKUP_DIR}/scripts/"
echo "Backup created at ${BACKUP_DIR}" | tee "${BACKUP_DIR}/MANIFEST.txt"
find "${BACKUP_DIR}/scripts/" -name "*.sh" -type f | wc -l >> "${BACKUP_DIR}/MANIFEST.txt"
sha256sum "${BACKUP_DIR}"/scripts/*.sh >> "${BACKUP_DIR}/MANIFEST.txt"
```

### 3.2 Per-Task Commits

Each task (6.4.1 through 6.4.12) MUST be committed as a separate, atomic Git commit. Commit message format:

```
refactor(scripts): Phase 6.4.N - <task title>
```

This enables targeted rollback of any single task via `git revert <commit-sha>` without affecting other tasks.

### 3.3 Full Rollback

If the entire phase must be reverted:

```bash
# Identify the commit immediately before Phase 6.4 began
PHASE_START=$(git log --oneline --all | grep "Phase 6.4.1" | tail -1 | awk '{print $1}')
BEFORE_PHASE=$(git rev-parse "${PHASE_START}^")
git revert --no-commit "${BEFORE_PHASE}..HEAD" -- scripts/
git commit -m "revert: rollback Phase 6.4 shell standardization"
```

### 3.4 Rollback Decision Criteria

Immediate rollback if:

- Any service management script fails to start/stop its target service after modification
- `bash -n` syntax check fails on any modified script
- shellcheck `--severity=error` reports new errors not present at baseline
- Any script that previously ran successfully now exits non-zero in its normal execution path

---

## 4. Baseline Evidence

All metrics in this document were captured on 2026-02-08 against commit `f300b8f` on the `main` branch. The following commands reproduce the baseline:

```bash
cd /home/kali/Documents/Argos/Argos

# Total script count
find scripts/ -name "*.sh" -type f | wc -l
# Result: 202

# Shebang distribution
find scripts/ -name "*.sh" -type f -exec head -1 {} \; | sort | uniq -c | sort -rn
# Result: 200 #!/bin/bash, 1 #\!/bin/bash, 1 missing shebang entirely

# Strict mode
grep -rl "set -euo pipefail" scripts/ --include="*.sh" | wc -l
# Result: 31

# No error handling (zero set -e, zero trap, zero || exit)
grep -rL "set -e\|trap\||| exit\||| return" scripts/ --include="*.sh" | wc -l
# Result: 134
# NOTE: 31 full strict mode + 34 partial (set -e only) + 3 trap-only + 134 none = 202

# ShellCheck error-severity files
find scripts/ -name "*.sh" -type f -exec sh -c \
  'count=$(shellcheck --severity=error -f gcc "$1" 2>/dev/null | wc -l); \
   [ "$count" -gt 0 ] && echo "$count $1"' _ {} \; | wc -l
# Result: 5

# ShellCheck full breakdown (all severities)
find scripts/ -name "*.sh" -type f -exec shellcheck -f gcc {} \; 2>/dev/null | \
  grep -oP '(error|warning|info|style)' | sort | uniq -c | sort -rn
# Result: error=6, warning=336, info=402, style=23 (TOTAL=767)
# NOTE: --severity=warning filters to error+warning only (342 combined)
# The 402 info and 23 style findings are additional and require separate remediation
```

---

## Task 6.4.1: Shebang Standardization

### Description

Replace all hardcoded `#!/bin/bash` shebangs with the portable `#!/usr/bin/env bash` form. This is required because:

1. **POSIX portability**: `bash` may reside at `/usr/local/bin/bash` (macOS Homebrew, FreeBSD), `/opt/homebrew/bin/bash` (Apple Silicon), or other non-standard locations. The `/usr/bin/env` lookup uses `$PATH` to find the correct binary.
2. **Container compatibility**: Alpine Linux and minimal Docker images may install bash at non-standard paths.
3. **NASA/JPL Rule 1 (adapted)**: All source files SHALL have a deterministic, unambiguous execution entry point.

Two broken shebangs must also be corrected:

1. `scripts/setup-system-management.sh`: Contains `#\!/bin/bash` (escaped exclamation mark)
2. `scripts/development/start-usrp-service.sh`: Has NO shebang at all (ShellCheck SC2148)

Both scripts will produce `Exec format error` when invoked directly via `./script.sh`.

### Scope

All `.sh` files under `scripts/` and all `.sh` files in project root directories (`hackrf_emitter/`, `tests/`).

### Detection

```bash
# Find all non-compliant shebangs
find scripts/ -name "*.sh" -type f -exec sh -c \
  'head -1 "$1" | grep -qv "^#!/usr/bin/env bash$" && echo "$1"' _ {} \;
```

### Transformation

```bash
# For each non-compliant script:
sed -i '1s|^#!.*/bash.*$|#!/usr/bin/env bash|' "$SCRIPT"
# Also fix the malformed escape:
sed -i '1s|^#\\!/bin/bash$|#!/usr/bin/env bash|' "$SCRIPT"
```

### Before/After

**Before:**

```bash
#!/bin/bash
# Script content...
```

**After:**

```bash
#!/usr/bin/env bash
# Script content...
```

**Malformed before:**

```bash
#\!/bin/bash
```

**After:**

```bash
#!/usr/bin/env bash
```

### Verification

```bash
# MUST return 0 (no non-compliant files)
find scripts/ -name "*.sh" -type f -exec sh -c \
  'head -1 "$1" | grep -qv "^#!/usr/bin/env bash$" && echo "FAIL: $1"' _ {} \; | wc -l
# Expected: 0

# Syntax check all modified scripts
find scripts/ -name "*.sh" -type f -exec bash -n {} \;
# Expected: exit 0, no output
```

### Acceptance Criteria

- [ ] Every `.sh` file in `scripts/` has `#!/usr/bin/env bash` as its first line
- [ ] Every `.sh` file in `hackrf_emitter/` and `tests/` has `#!/usr/bin/env bash` as its first line
- [ ] `bash -n` passes on all modified files
- [ ] The malformed `#\!/bin/bash` shebang (`scripts/setup-system-management.sh`) no longer exists anywhere in the repository
- [ ] The missing-shebang file (`scripts/development/start-usrp-service.sh`) has been given a proper shebang

---

## Task 6.4.2: Strict Mode Enforcement

> **TASK ORDERING DEPENDENCY**: Task 6.4.6 (trap handlers and error auditing) MUST execute BEFORE Task 6.4.2 (strict mode enablement). Reason: Adding `set -euo pipefail` to a script that contains `grep` (returns exit 1 on no match), `diff` (returns exit 1 on differences), or `cd` to a possibly-missing directory will cause immediate script termination. The error audit must first identify and fix these false-positive error exits with explicit `|| true` or conditional logic before strict mode can be safely enabled.
>
> Correct execution order: 6.4.1 (shebangs) -> 6.4.6 (error audit) -> 6.4.2 (strict mode) -> 6.4.3 (headers) -> remaining tasks

### Description

Every script MUST begin with strict mode on line 2 (immediately after the shebang):

```bash
set -euo pipefail
```

This compound setting provides three critical safety nets:

| Flag          | Effect                                                            | CERT Reference                       |
| ------------- | ----------------------------------------------------------------- | ------------------------------------ |
| `-e`          | Exit immediately on any command failure (non-zero exit)           | CERT SH-01: Detect and handle errors |
| `-u`          | Treat unset variables as errors (prevents silent empty expansion) | CERT SH-02: Initialize all variables |
| `-o pipefail` | Pipeline return code is the rightmost non-zero exit               | CERT SH-03: Check return values      |

**Rationale for `set -euo pipefail` over `set -e` alone:** A script containing `curl http://... | grep pattern` with only `set -e` will silently succeed even if `curl` fails, because `grep` determines the pipeline exit code. With `pipefail`, the `curl` failure propagates.

### Scope

All `.sh` files under `scripts/`. Files that already have `set -e` or `set -euo pipefail` will be normalized to the full form.

### Known Incompatibilities

The `-u` flag causes failures when scripts reference `$1` without checking `$#` first, or when testing `${VARIABLE:-}` without the default-value syntax. These cases MUST be fixed as part of this task.

**Pattern 1: Positional parameter access**

Before:

```bash
TARGET=$1
```

After:

```bash
TARGET="${1:-}"
if [[ -z "${TARGET}" ]]; then
    echo "ERROR: Missing required argument: target" >&2
    exit 2
fi
```

**Pattern 2: Optional environment variable**

Before:

```bash
if [ "$VERBOSE" = "true" ]; then
```

After:

```bash
if [[ "${VERBOSE:-false}" == "true" ]]; then
```

**Pattern 3: Array iteration over potentially empty arrays**

Before:

```bash
for item in "${MY_ARRAY[@]}"; do
```

After:

```bash
for item in "${MY_ARRAY[@]+"${MY_ARRAY[@]}"}"; do
```

Or, if bash 4.4+ is guaranteed (it is, on Kali 2025.4):

```bash
shopt -s nounset
for item in "${MY_ARRAY[@]}"; do  # bash 4.4+ handles empty arrays under nounset
```

### Detection

```bash
# Scripts missing strict mode entirely
grep -rL "set -euo pipefail" scripts/ --include="*.sh" | wc -l

# Scripts with partial strict mode (set -e but not set -euo pipefail)
grep -rl "set -e$\|set -e " scripts/ --include="*.sh" | \
  xargs grep -L "set -euo pipefail" 2>/dev/null
```

### Transformation

For scripts that have NO strict mode:

```bash
# Insert set -euo pipefail on line 2
sed -i '1a set -euo pipefail' "$SCRIPT"
```

For scripts that have `set -e` only:

```bash
sed -i 's/^set -e$/set -euo pipefail/' "$SCRIPT"
sed -i 's/^set -e /set -euo pipefail /' "$SCRIPT"
```

### Verification

```bash
# All scripts must have strict mode on line 2
find scripts/ -name "*.sh" -type f -exec sh -c \
  'LINE2=$(sed -n "2p" "$1"); \
   [ "$LINE2" != "set -euo pipefail" ] && echo "FAIL: $1 (line 2: $LINE2)"' _ {} \;
# Expected: no output

# Syntax check
find scripts/ -name "*.sh" -type f -exec bash -n {} \;
# Expected: exit 0
```

### Acceptance Criteria

- [ ] Every `.sh` file has `set -euo pipefail` as line 2
- [ ] No script contains `set -e` without `-uo pipefail`
- [ ] All `$1`/`$2`/`$@` references are guarded with `${N:-}` or `$#` checks
- [ ] All optional environment variables use `${VAR:-default}` syntax
- [ ] `bash -n` passes on all modified files

---

## Task 6.4.3: Header Block Standardization

### Description

Every script MUST contain a standardized header block immediately after `set -euo pipefail`. This block provides context for operators and maintainers who encounter the script in production without access to this planning document.

### Required Header Format

```bash
#!/usr/bin/env bash
set -euo pipefail
# -------------------------------------------------------------------
# Script:        <filename.sh>
# Purpose:       <one-line description of what this script does>
# Usage:         <invocation syntax, e.g., ./script.sh [--flag] <arg>>
# Prerequisites: <required tools, services, hardware, or permissions>
# Exit Codes:    0=success, 1=error, 2=usage, 3=missing dependency
# Author:        Argos Team
# Phase:         6.4.3 standardization (2026-02-08)
# -------------------------------------------------------------------
```

### Minimum Required Fields

| Field         | Required | Description                                                                                   |
| ------------- | -------- | --------------------------------------------------------------------------------------------- |
| Script        | YES      | Filename for grep/search identification                                                       |
| Purpose       | YES      | Single sentence. Begin with a verb (Deploy, Configure, Monitor, Diagnose).                    |
| Usage         | YES      | Exact invocation syntax with argument placeholders in angle brackets.                         |
| Prerequisites | YES      | Tools (`docker`, `shellcheck`), permissions (`root`, `sudo`), hardware (`HackRF`), or `None`. |
| Exit Codes    | YES      | Map of integer to meaning. Minimum: 0, 1, 2 per Task 6.4.10.                                  |
| Author        | NO       | Default to `Argos Team` if unknown.                                                           |
| Phase         | NO       | Audit traceability marker.                                                                    |

### Detection

```bash
# Scripts missing any header block
find scripts/ -name "*.sh" -type f -exec sh -c \
  'grep -q "^# Purpose:" "$1" || echo "MISSING: $1"' _ {} \;
```

### Before/After Example

**Before (`scripts/start-kismet-safe.sh`):**

```bash
#!/bin/bash

# Safe Kismet startup script
# Starts Kismet and tries various methods to add WiFi sources

echo "Starting Kismet safely..."
```

**After:**

```bash
#!/usr/bin/env bash
set -euo pipefail
# -------------------------------------------------------------------
# Script:        start-kismet-safe.sh
# Purpose:       Start Kismet service and configure WiFi adapter sources
# Usage:         sudo ./start-kismet-safe.sh [adapter_name]
# Prerequisites: kismet (systemd service), WiFi adapter, root privileges
# Exit Codes:    0=success, 1=error, 2=usage, 3=missing dependency
# -------------------------------------------------------------------

echo "Starting Kismet safely..."
```

### Verification

```bash
# All scripts must contain the 5 required header fields
for field in "Script:" "Purpose:" "Usage:" "Prerequisites:" "Exit Codes:"; do
    MISSING=$(find scripts/ -name "*.sh" -type f -exec sh -c \
      "grep -qF '# ${field}' \"\$1\" || echo \"\$1\"" _ {} \;)
    if [ -n "${MISSING}" ]; then
        echo "FAIL: Missing '${field}' in: ${MISSING}"
    fi
done
# Expected: no output
```

### Acceptance Criteria

- [ ] Every `.sh` file contains all 5 required header fields
- [ ] Purpose field begins with a verb
- [ ] Usage field includes argument placeholders where the script accepts parameters
- [ ] Prerequisites field lists concrete tool/permission names (not vague descriptions)
- [ ] Header block is positioned between `set -euo pipefail` and the first executable statement

---

## Task 6.4.4: ShellCheck Compliance

### Description

All scripts MUST pass `shellcheck --severity=warning` with zero findings. ShellCheck is a static analysis tool that detects common shell scripting errors, including variable quoting mistakes, unreachable code, incorrect test operators, and POSIX compliance issues.

**Current baseline:** 336 warnings + 6 errors = 342 findings across 84 files at warning severity. An additional 402 info-level and 23 style-level findings (425 total) exist at lower severities, bringing the grand total to 767 ShellCheck findings.

The following table maps the top violations to their remediation patterns:

| SC Code | Count | Root Cause                                         | Fix Pattern                                               |
| ------- | ----- | -------------------------------------------------- | --------------------------------------------------------- |
| SC2086  | 220   | Unquoted variable -- word splitting/glob injection | Quote: `"${VAR}"`, `"$(cmd)"`                             |
| SC2155  | 149   | `local var=$(cmd)` masks return value              | Split: `local var; var=$(cmd)`                            |
| SC2024  | 73    | `sudo cmd \| other` -- sudo scope limited          | `sudo bash -c 'cmd \| other'` or restructure              |
| SC2164  | 38    | `cd /path` without failure check                   | `cd /path \|\| exit 1`                                    |
| SC2034  | 31    | Unused variable                                    | Remove, or add `# shellcheck disable=SC2034` with comment |
| SC2046  | 22    | Unquoted command substitution                      | Quote: `"$(cmd)"`                                         |
| SC2206  | 14    | Unquoted array assignment                          | `mapfile -t arr < <(cmd)`                                 |

### Selective Suppression Policy

Directive `# shellcheck disable=SCNNNN` MAY be used ONLY when:

1. The finding is a verified false positive (document WHY in the suppression comment).
2. The finding is SC2034 (unused variable) where the variable is intentionally exported or sourced by another script.
3. The fix would require a fundamental architectural change outside the scope of this phase.

Every suppression MUST include a justifying comment on the preceding line:

```bash
# shellcheck disable=SC2034 -- ARGOS_VERSION exported for child processes
ARGOS_VERSION="3.0.0"
```

Suppressions without justifying comments are non-compliant.

### SC2155 Remediation Pattern (149 instances)

**Before:**

```bash
local SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
```

**After:**

```bash
local SCRIPT_DIR
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
```

**Rationale:** When `local` and assignment are combined, the exit code of the command substitution is masked by the exit code of `local` (always 0). Under `set -e`, a failing command substitution goes undetected.

### SC2164 Remediation Pattern (38 instances)

**Before:**

```bash
cd /usr/src/gsmevil2
```

**After:**

```bash
cd /usr/src/gsmevil2 || { echo "ERROR: Cannot cd to /usr/src/gsmevil2" >&2; exit 1; }
```

### SC2046 Remediation Pattern (22 instances)

**Before:**

```bash
docker rm $(docker ps -aq)
```

**After:**

```bash
docker rm "$(docker ps -aq)"
```

Or, when the expansion intentionally produces multiple arguments:

```bash
# shellcheck disable=SC2046 -- intentional word splitting for multiple container IDs
docker rm $(docker ps -aq)
```

#### Security-Critical Patterns Not Covered by ShellCheck

ShellCheck's static analysis does not detect the following dangerous patterns that require manual audit:

| Pattern                         | Risk                          | Detection Command                                             | CERT/NASA Reference |
| ------------------------------- | ----------------------------- | ------------------------------------------------------------- | ------------------- |
| `eval "$var"`                   | Arbitrary code execution      | `grep -rn 'eval ' scripts/*.sh`                               | CERT STR02-C        |
| Backtick with unvalidated input | Command injection             | `grep -rn '\`._\$' scripts/_.sh`                              | CERT STR02-C        |
| `rm -rf $UNQUOTED`              | Directory traversal deletion  | `grep -rn 'rm -rf \$' scripts/*.sh` (note: no quotes after $) | NASA/JPL Rule 1     |
| `curl \| sh` or `wget \| sh`    | Supply chain attack           | `grep -rn 'curl.*\|.*sh\|wget.*\|.*sh' scripts/*.sh`          | CERT MSC33-C        |
| `chmod 777`                     | World-writable files          | `grep -rn 'chmod 777' scripts/*.sh`                           | CERT FIO06-C        |
| `sudo` without full path        | PATH hijacking                | `grep -rn 'sudo [^/]' scripts/*.sh`                           | CERT ENV03-C        |
| `while true` without watchdog   | Infinite resource consumption | `grep -rn 'while true\|while :' scripts/*.sh`                 | NASA/JPL Rule 2     |

These patterns must be audited manually before standardization is considered complete.

### Detection

```bash
# Full ShellCheck audit at warning level
find scripts/ -name "*.sh" -type f -exec shellcheck --severity=warning -f gcc {} \; 2>/dev/null
```

### Verification

```bash
# MUST return 0 lines
find scripts/ -name "*.sh" -type f \
  -exec shellcheck --severity=warning -f gcc {} \; 2>/dev/null | wc -l
# Expected: 0

# Count suppressions for audit trail
grep -r "shellcheck disable" scripts/ --include="*.sh" | wc -l
# Document this count in the completion report
```

### Acceptance Criteria

- [ ] `shellcheck --severity=warning` produces zero output across all scripts
- [ ] Every `# shellcheck disable` directive has a justifying comment
- [ ] SC2155 instances are resolved by splitting declaration and assignment (not suppressed)
- [ ] SC2164 instances are resolved by adding `|| exit 1` (not suppressed)
- [ ] Total suppression count is documented in the phase completion report
- [ ] No `# shellcheck disable=SC2086` (variable quoting) -- these MUST be fixed, not suppressed

---

## Task 6.4.5: Variable Quoting and Input Validation

### Description

All variable expansions MUST be double-quoted unless intentional word splitting is required and documented. All script parameters that originate from user input, command-line arguments, or environment variables MUST be validated before use.

This task addresses CERT SH-05 (Validate all input) and OWASP OS Command Injection prevention.

### 5.1: Universal Variable Quoting

Every `$VAR`, `${VAR}`, `$(cmd)`, and `` `cmd` `` MUST be enclosed in double quotes.

**Exceptions (must be individually commented):**

- Inside `[[ ]]` test brackets (where word splitting does not occur)
- Array subscript context `${array[*]}` where IFS-joined output is intended
- Arithmetic context `$(( ))` where quoting is syntactically invalid

**Before:**

```bash
FILE_PATH=$PROJECT_ROOT/config/$CONFIG_NAME
cp $SOURCE $DEST
echo $MESSAGE
```

**After:**

```bash
FILE_PATH="${PROJECT_ROOT}/config/${CONFIG_NAME}"
cp "${SOURCE}" "${DEST}"
echo "${MESSAGE}"
```

### 5.2: Command-Line Argument Validation

All scripts that accept positional parameters (81 scripts reference `$1`, `$@`, or `${1}`) MUST validate arguments before use.

**Required validation pattern:**

```bash
# Validate argument count
if [[ $# -lt 1 ]]; then
    echo "ERROR: Missing required argument: <description>" >&2
    echo "Usage: $(basename "$0") <arg1> [arg2]" >&2
    exit 2
fi

# Validate argument format (example: must be alphanumeric)
if [[ ! "${1}" =~ ^[a-zA-Z0-9_-]+$ ]]; then
    echo "ERROR: Invalid argument format: '${1}'" >&2
    echo "       Argument must contain only alphanumeric characters, hyphens, and underscores." >&2
    exit 2
fi
```

### 5.3: Path Traversal Prevention

Scripts that construct file paths from user input MUST validate against path traversal:

```bash
# Reject path traversal attempts
if [[ "${USER_INPUT}" == *".."* ]]; then
    echo "ERROR: Path traversal detected in argument: '${USER_INPUT}'" >&2
    exit 2
fi

# Resolve to canonical path and verify it is within expected directory
RESOLVED_PATH=$(realpath -m "${BASE_DIR}/${USER_INPUT}")
if [[ "${RESOLVED_PATH}" != "${BASE_DIR}"/* ]]; then
    echo "ERROR: Resolved path escapes base directory: '${RESOLVED_PATH}'" >&2
    exit 2
fi
```

### 5.4: Command Injection Prevention

No script SHALL pass unvalidated user input to `eval`, `bash -c`, `sudo bash -c`, or any construct that interprets strings as commands.

**Known violation (from runtime validation audit):**
`src/routes/api/gsm-evil/control/+server.ts` line 91 passes a frequency parameter directly to a shell command. While this is a TypeScript file (not shell), any shell scripts that accept frequency values must validate them numerically:

```bash
# Validate frequency is a positive number
if [[ ! "${FREQ}" =~ ^[0-9]+(\.[0-9]+)?[MmGgKk]?$ ]]; then
    echo "ERROR: Invalid frequency format: '${FREQ}'" >&2
    exit 2
fi
```

### Detection

```bash
# Find unquoted variable expansions (heuristic -- ShellCheck SC2086 is authoritative)
grep -rn '\$[A-Z_][A-Z_0-9]*[^}"'"'"']' scripts/ --include="*.sh" | \
  grep -v '#' | grep -v '^\s*#' | head -30

# Find eval or bash -c with variable interpolation
grep -rn 'eval\|bash -c.*\$' scripts/ --include="*.sh"

# Find scripts using $1 without $# check
for f in $(grep -rl '\$1\|\${1' scripts/ --include="*.sh"); do
    grep -q '$#\|"${1:-' "$f" || echo "UNGUARDED: $f"
done
```

### Verification

```bash
# ShellCheck SC2086 must produce zero findings
find scripts/ -name "*.sh" -type f \
  -exec shellcheck --include=SC2086 -f gcc {} \; 2>/dev/null | wc -l
# Expected: 0

# No unquoted eval or bash -c with variable interpolation
grep -rn 'eval \$\|bash -c.*\$[^(]' scripts/ --include="*.sh" | wc -l
# Expected: 0

# All scripts with $1 have $# or ${1:- guard
UNGUARDED=0
for f in $(grep -rl '\$1\|\${1' scripts/ --include="*.sh"); do
    grep -q '\$#\|"${1:-\|${1:-' "$f" || { echo "FAIL: $f"; UNGUARDED=$((UNGUARDED+1)); }
done
echo "Unguarded: ${UNGUARDED}"
# Expected: 0
```

### Acceptance Criteria

- [ ] Zero SC2086 findings from shellcheck
- [ ] Zero instances of `eval $VAR` or `bash -c` with unquoted variable interpolation
- [ ] All 81 parameter-accepting scripts validate `$#` before accessing `$1`
- [ ] All path-constructing scripts validate against path traversal
- [ ] All frequency-accepting scripts validate numeric format

---

## Task 6.4.6: Trap and Cleanup Handlers

### Description

Scripts that allocate resources (temporary files, background processes, lock files, mount points, or modified system state) MUST register cleanup handlers via `trap` to ensure resources are released on both normal exit and signal-induced termination.

**Current state:** 31 of 202 scripts have trap handlers. Of the 60 scripts using `mktemp` or `/tmp/`, only 3 register cleanup traps for their temporary files.

### Required Trap Pattern

```bash
#!/usr/bin/env bash
set -euo pipefail

# Temporary file management
TMPDIR_WORK=""
cleanup() {
    local exit_code=$?
    # Remove temporary files
    if [[ -n "${TMPDIR_WORK}" && -d "${TMPDIR_WORK}" ]]; then
        rm -rf "${TMPDIR_WORK}"
    fi
    # Kill background processes started by this script
    # (only if this script starts background processes)
    jobs -p 2>/dev/null | xargs -r kill 2>/dev/null || true
    exit "${exit_code}"
}
trap cleanup EXIT

# Create temp directory AFTER trap registration
TMPDIR_WORK=$(mktemp -d "${TMPDIR:-/tmp}/argos-XXXXXX")
```

### Signal Handling Requirements

| Signal       | Trap Action          | Rationale                                             |
| ------------ | -------------------- | ----------------------------------------------------- |
| EXIT         | Run cleanup function | Covers normal exit and all caught signals             |
| INT (Ctrl-C) | (Caught by EXIT)     | User interrupt                                        |
| TERM         | (Caught by EXIT)     | systemd stop signal                                   |
| HUP          | (Caught by EXIT)     | Terminal hangup                                       |
| PIPE         | Ignore or handle     | Prevent broken pipe from killing long-running scripts |

**Implementation note:** Trapping EXIT is sufficient because bash executes EXIT traps when the shell receives INT, TERM, or HUP (after executing any specific trap for those signals). Therefore, a single `trap cleanup EXIT` handles all cases. Separate INT/TERM traps are only needed if the script must perform signal-specific actions (e.g., printing a different message).

### Categories of Scripts Requiring Traps

**Category A: Temporary file creators (60 scripts)**

```bash
# Detection
find scripts/ -name "*.sh" -type f -exec grep -l "mktemp\|/tmp/" {} \;

# Required: cleanup() removes temp files
```

**Category B: Background process starters (service management scripts)**

```bash
# Detection
grep -rl "& *$\|nohup\|disown" scripts/ --include="*.sh"

# Required: cleanup() kills child processes
```

**Category C: Lock file users**

```bash
# Detection
grep -rl "\.lock\|\.pid\|flock" scripts/ --include="*.sh"

# Required: cleanup() removes lock/pid files
```

**Category D: System state modifiers (install/setup scripts)**

```bash
# Detection
grep -rl "sysctl\|modprobe\|ip link\|iptables" scripts/ --include="*.sh"

# Required: cleanup() logs that partial modification may have occurred
# (full rollback is not always safe; logging enables manual recovery)
```

### Before/After Example

**Before (`scripts/argos-cpu-protector.sh`, 303 lines, uses mktemp):**

```bash
#!/bin/bash

LOG_FILE=$(mktemp /tmp/cpu-protector-XXXXXX.log)
# ... 300 lines of logic ...
rm -f "$LOG_FILE"  # Only reached on success path
```

**After:**

```bash
#!/usr/bin/env bash
set -euo pipefail
# -------------------------------------------------------------------
# Script:        argos-cpu-protector.sh
# Purpose:       Monitor and limit CPU-intensive processes to prevent thermal throttle
# Usage:         sudo ./argos-cpu-protector.sh [--threshold <percent>]
# Prerequisites: root privileges, /proc/stat access
# Exit Codes:    0=success, 1=error, 2=usage, 3=missing dependency
# -------------------------------------------------------------------

LOG_FILE=""
cleanup() {
    local exit_code=$?
    if [[ -n "${LOG_FILE}" && -f "${LOG_FILE}" ]]; then
        rm -f "${LOG_FILE}"
    fi
    exit "${exit_code}"
}
trap cleanup EXIT

LOG_FILE=$(mktemp /tmp/cpu-protector-XXXXXX.log)
# ... 300 lines of logic ...
# No explicit rm needed; cleanup() handles it
```

### Verification

```bash
# All scripts that use mktemp or /tmp/ must have a trap
for f in $(find scripts/ -name "*.sh" -type f -exec grep -l "mktemp\|TMPDIR" {} \;); do
    grep -q "trap " "$f" || echo "MISSING TRAP: $f"
done
# Expected: no output

# All trap handlers must reference EXIT
grep -r "^trap " scripts/ --include="*.sh" | grep -v "EXIT" | grep -v "cleanup EXIT"
# Expected: no output (all traps must include EXIT)
```

### Acceptance Criteria

- [ ] Every script that creates temporary files has a `trap cleanup EXIT` handler
- [ ] Every script that starts background processes has a trap that kills child processes
- [ ] Every `mktemp` call occurs AFTER the trap registration (not before)
- [ ] Cleanup functions preserve the original exit code (`local exit_code=$?` on first line)
- [ ] No script relies on end-of-file `rm` commands for cleanup (dead code if script exits early)

---

## Task 6.4.7: --help and --dry-run Support

### Description

All scripts that perform destructive, stateful, or service-affecting operations MUST support `--help` and `--dry-run` flags. This enables operators to understand script behavior before execution and to preview changes without committing them.

**Current state:** 8 scripts (3.96%) support `--help`. 0 scripts support `--dry-run`.

### Scope

This requirement applies to scripts in the following categories:

| Category           | Criteria                                      | Estimated Count        |
| ------------------ | --------------------------------------------- | ---------------------- |
| Service management | Starts, stops, or restarts systemd services   | ~30 post-consolidation |
| Installation       | Installs packages, modifies system config     | ~15 post-consolidation |
| Deployment         | Deploys containers, images, or configurations | ~10 post-consolidation |

**Excluded:** Diagnostic scripts (read-only), monitoring scripts (read-only), and one-off test scripts.

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

The `--dry-run` flag MUST prevent all side effects while printing every command that WOULD be executed. Implementation pattern:

```bash
# Wrapper function for dry-run-aware execution
run_cmd() {
    if [[ "${DRY_RUN}" == "true" ]]; then
        echo "[DRY-RUN] Would execute: $*"
    else
        "$@"
    fi
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

### Verification

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
```

### Acceptance Criteria

- [ ] All service management, installation, and deployment scripts support `--help`
- [ ] All service management, installation, and deployment scripts support `--dry-run`
- [ ] `--help` prints usage to stdout and exits with code 0
- [ ] `--dry-run` produces no side effects (no file writes, no service changes, no network calls)
- [ ] Unknown flags cause exit code 2 and print usage to stderr
- [ ] Argument parsing uses a `while/case` loop (not ad-hoc `if` chains)

---

## Task 6.4.8: Idempotency Fixes

### Description

All setup, installation, and configuration scripts MUST be idempotent: running them N times MUST produce the same system state as running them once. This is a fundamental requirement for reliable deployment automation (Ansible, Terraform, and manual re-runs after partial failure all depend on idempotency).

**Current violations:**

1. **Config file append duplication:** `cat >> /etc/sysctl.conf` appends duplicate entries on every run.
2. **vm.swappiness conflict:** Three scripts set `vm.swappiness=10`, but the production system requires `vm.swappiness=60` for zram.
3. **Package install without check:** `apt-get install` without `dpkg -s` pre-check wastes time on re-runs.

### 8.1: Config File Append Pattern Fix

**Before (non-idempotent):**

```bash
cat >> /etc/sysctl.conf <<'EOF'
vm.swappiness = 10
vm.min_free_kbytes = 65536
vm.dirty_ratio = 10
EOF
```

**After (idempotent):**

```bash
# Idempotent sysctl configuration using drop-in directory
# /etc/sysctl.d/ is the correct location; /etc/sysctl.conf should not be appended to
SYSCTL_CONF="/etc/sysctl.d/90-argos.conf"

# Write complete file (not append) -- inherently idempotent
cat > "${SYSCTL_CONF}" <<'EOF'
# Argos platform kernel tuning
# Managed by: scripts/setup-host-complete.sh
# Do not edit manually; re-run the script to update.
vm.swappiness = 60
vm.min_free_kbytes = 65536
vm.dirty_ratio = 10
EOF

sysctl --system >/dev/null 2>&1
log_info "Applied sysctl configuration from ${SYSCTL_CONF}"
```

**Key change:** Use `>` (overwrite) into a drop-in file under `/etc/sysctl.d/`, never `>>` (append) into `/etc/sysctl.conf`.

### 8.2: limits.conf Idempotency

**Before (non-idempotent):**

```bash
cat >> /etc/security/limits.conf << 'EOF'
* soft nofile 65535
* hard nofile 65535
EOF
```

**After (idempotent):**

```bash
LIMITS_CONF="/etc/security/limits.d/90-argos.conf"
cat > "${LIMITS_CONF}" <<'EOF'
# Argos platform file descriptor limits
# Managed by: scripts/setup-host-complete.sh
* soft nofile 65535
* hard nofile 65535
EOF
log_info "Applied limits configuration to ${LIMITS_CONF}"
```

### 8.3: vm.swappiness Conflict Resolution

All three scripts MUST be updated to use `vm.swappiness=60` to match the production zram configuration. The value `10` is appropriate for systems with spinning disk swap; the Argos platform uses zram (compressed memory swap) where higher swappiness is correct.

**Files requiring update:**

- `scripts/setup-host-complete.sh:324` -- change `vm.swappiness = 10` to `vm.swappiness = 60`
- `scripts/install-system-dependencies.sh:307` -- change `vm.swappiness = 10` to `vm.swappiness = 60`
- `scripts/setup-swap.sh:116` -- change `vm.swappiness=10` to `vm.swappiness=60`

### 8.4: Package Installation Idempotency

**Before:**

```bash
apt-get install -y package1 package2 package3
```

**After:**

```bash
install_if_missing() {
    local pkg
    for pkg in "$@"; do
        if ! dpkg -s "${pkg}" >/dev/null 2>&1; then
            log_info "Installing ${pkg}..."
            run_cmd apt-get install -y "${pkg}"
        else
            log_info "Package ${pkg} already installed, skipping."
        fi
    done
}

install_if_missing package1 package2 package3
```

### 8.5: Service File Installation Idempotency

**Before:**

```bash
cp argos.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable argos
```

**After:**

```bash
if ! diff -q argos.service /etc/systemd/system/argos.service >/dev/null 2>&1; then
    run_cmd cp argos.service /etc/systemd/system/
    run_cmd systemctl daemon-reload
    log_info "Service file updated and daemon reloaded."
else
    log_info "Service file unchanged, skipping."
fi
run_cmd systemctl enable argos 2>/dev/null || true  # enable is already idempotent
```

### Detection

```bash
# Find all append-to-system-config patterns
grep -rn "cat >>" scripts/ --include="*.sh" | grep -i "sysctl\|limits\|fstab\|crontab\|conf"

# Find all vm.swappiness settings
grep -rn "vm.swappiness" scripts/ --include="*.sh"

# Find non-idempotent apt-get patterns (no dpkg -s guard)
grep -rn "apt-get install\|apt install" scripts/ --include="*.sh" | head -20
```

### Verification

```bash
# No cat >> to system config files
grep -rn "cat >>" scripts/ --include="*.sh" | \
  grep -i "sysctl\|limits\|fstab\|crontab" | wc -l
# Expected: 0

# All vm.swappiness values are 60
grep -rn "vm.swappiness" scripts/ --include="*.sh" | grep -v "=.*60\|= *60" | wc -l
# Expected: 0

# Idempotency smoke test: run setup script twice, diff system state
# (Manual verification step -- document results in completion report)
```

### Acceptance Criteria

- [ ] Zero instances of `cat >>` or `echo >>` targeting system configuration files
- [ ] All sysctl settings use `/etc/sysctl.d/90-argos.conf` (drop-in, overwrite mode)
- [ ] All limits settings use `/etc/security/limits.d/90-argos.conf` (drop-in, overwrite mode)
- [ ] All vm.swappiness references use value 60 (zram-appropriate)
- [ ] Package installation scripts check `dpkg -s` before calling `apt-get install`
- [ ] Running any setup script twice produces identical system state to running it once

---

## Task 6.4.9: Logging Standardization

### Description

All scripts MUST use a consistent, structured logging format. The current codebase uses at least 6 different logging styles:

| Style            | Example                             | Script Count |
| ---------------- | ----------------------------------- | ------------ |
| Plain echo       | `echo "Starting..."`                | ~150         |
| Bracketed tag    | `echo "[PASS] Done"`                | ~15          |
| Color with level | `echo -e "${GREEN}[INFO]${NC} msg"` | ~49          |
| Function-based   | `info "msg"`, `error "msg"`         | ~5           |
| No logging       | (silent operation)                  | ~20          |
| Mixed            | Different styles in same script     | ~30          |

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

The logging functions are defined in `scripts/lib/common.sh` (Task 6.4.11) and sourced by every script. Individual scripts MUST NOT define their own logging functions.

```bash
# In scripts/lib/common.sh:
_log() {
    local level="${1}"
    shift
    local timestamp
    timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    local script_name
    script_name=$(basename "${BASH_SOURCE[1]:-$0}")
    echo "[${timestamp}] [${level}] [${script_name}] $*" >&2
}

log_debug() { [[ "${ARGOS_LOG_LEVEL:-INFO}" == "DEBUG" ]] && _log "DEBUG" "$@" || true; }
log_info()  { _log "INFO" "$@"; }
log_warn()  { _log "WARN" "$@"; }
log_error() { _log "ERROR" "$@"; }
log_fatal() { _log "FATAL" "$@"; exit 1; }
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
# In scripts/lib/common.sh:
if [[ -t 2 ]]; then
    _RED='\033[0;31m'
    _GREEN='\033[0;32m'
    _YELLOW='\033[1;33m'
    _NC='\033[0m'
else
    _RED=''
    _GREEN=''
    _YELLOW=''
    _NC=''
fi

_log() {
    local level="${1}"
    shift
    local timestamp
    timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    local script_name
    script_name=$(basename "${BASH_SOURCE[1]:-$0}")
    local color=""
    case "${level}" in
        ERROR|FATAL) color="${_RED}" ;;
        WARN)        color="${_YELLOW}" ;;
        INFO)        color="${_GREEN}" ;;
        *)           color="" ;;
    esac
    echo -e "${color}[${timestamp}] [${level}] [${script_name}]${_NC} $*" >&2
}
```

### Migration Path

**Step 1:** Replace all `echo "..."` statements that are informational messages (not data output) with `log_info`:

```bash
# Before:
echo "Starting Kismet safely..."

# After:
log_info "Starting Kismet safely..."
```

**Step 2:** Replace all `echo "ERROR: ..."` with `log_error`:

```bash
# Before:
echo "ERROR: Docker is not running" >&2

# After:
log_error "Docker is not running"
```

**Step 3:** Remove all per-script color variable definitions and `info()`/`warn()`/`error()` function definitions. These are now provided by `common.sh`.

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

### Verification

```bash
# No per-script color definitions
grep -rl "RED=.*033" scripts/ --include="*.sh" | grep -v "lib/common.sh" | wc -l
# Expected: 0

# No per-script log function definitions
grep -rn "^info()\|^warn()\|^error()" scripts/ --include="*.sh" | grep -v "lib/common.sh" | wc -l
# Expected: 0

# All scripts source common.sh
find scripts/ -name "*.sh" -type f -not -path "*/lib/*" -exec sh -c \
  'grep -q "source.*lib/common.sh\|\. .*lib/common.sh" "$1" || echo "MISSING: $1"' _ {} \;
# Expected: no output (all scripts source common.sh)
```

### Acceptance Criteria

- [ ] All informational `echo` statements converted to `log_info`/`log_warn`/`log_error`
- [ ] All per-script color definitions removed (centralized in `common.sh`)
- [ ] All per-script logging function definitions removed (centralized in `common.sh`)
- [ ] Log output goes to stderr (stdout reserved for machine-readable data)
- [ ] Color output is disabled when stderr is not a terminal
- [ ] `ARGOS_LOG_LEVEL` environment variable controls verbosity

---

## Task 6.4.10: Exit Code Conventions

### Description

All scripts MUST use a consistent exit code scheme. This enables calling scripts (including systemd, cron, CI pipelines, and parent shell scripts) to programmatically determine the outcome.

### Exit Code Table

| Code | Meaning             | When to Use                                                                        |
| ---- | ------------------- | ---------------------------------------------------------------------------------- |
| 0    | Success             | Script completed all operations successfully                                       |
| 1    | General error       | Unrecoverable runtime error (hardware failure, network timeout, permission denied) |
| 2    | Usage error         | Invalid arguments, missing required flags, malformed input                         |
| 3    | Missing dependency  | Required tool, package, service, or hardware not available                         |
| 4    | Configuration error | Invalid config file, conflicting settings, missing env var                         |
| 5    | Partial success     | Some operations succeeded, others failed (batch scripts only)                      |

**Reserved ranges (do not use):**

- 64-78: BSD sysexits.h (EX_USAGE=64, EX_NOHOST=68, etc.) -- conflict risk
- 126: Command not executable
- 127: Command not found
- 128+N: Killed by signal N (e.g., 130 = SIGINT, 137 = SIGKILL, 143 = SIGTERM)

### Implementation Pattern

```bash
# At the top of every script, after the header block:
readonly EXIT_SUCCESS=0
readonly EXIT_ERROR=1
readonly EXIT_USAGE=2
readonly EXIT_MISSING_DEP=3
readonly EXIT_CONFIG=4
readonly EXIT_PARTIAL=5

# Dependency check example:
require_cmd() {
    local cmd
    for cmd in "$@"; do
        if ! command -v "${cmd}" >/dev/null 2>&1; then
            log_error "Required command not found: ${cmd}"
            exit "${EXIT_MISSING_DEP}"
        fi
    done
}

# Usage:
require_cmd docker shellcheck jq
```

These constants will be defined in `scripts/lib/common.sh` (Task 6.4.11) rather than repeated in every script.

### Before/After Example

**Before:**

```bash
if ! docker info >/dev/null 2>&1; then
    echo "Docker is not running"
    exit 1  # Is this a usage error? Missing dependency? General error?
fi
```

**After:**

```bash
if ! command -v docker >/dev/null 2>&1; then
    log_error "Docker is not installed"
    exit "${EXIT_MISSING_DEP}"  # Code 3: clearly a missing dependency
fi

if ! docker info >/dev/null 2>&1; then
    log_error "Docker daemon is not running"
    exit "${EXIT_ERROR}"  # Code 1: Docker exists but service is down
fi
```

### Detection

```bash
# Find all exit statements and their codes
grep -rn "exit [0-9]" scripts/ --include="*.sh" | \
  awk -F'exit ' '{print $2}' | sort | uniq -c | sort -rn

# Find bare 'exit' without code (inherits last command's exit code -- unreliable)
grep -rn "^[[:space:]]*exit$" scripts/ --include="*.sh"
```

### Verification

```bash
# No bare 'exit' without explicit code
grep -rn "^[[:space:]]*exit$" scripts/ --include="*.sh" | wc -l
# Expected: 0

# No exit codes outside the defined range (0-5)
grep -rn "exit [0-9]" scripts/ --include="*.sh" | \
  grep -vP "exit [0-5]$|exit \"\$|exit \$" | wc -l
# Expected: 0 (all explicit exit codes are 0-5 or variable references)

# All scripts end with explicit exit 0 or use exit in last control flow
# (Manual review -- automated check is infeasible for all control flow patterns)
```

### Acceptance Criteria

- [ ] Exit code constants defined in `scripts/lib/common.sh`
- [ ] No bare `exit` statements (all have explicit codes)
- [ ] No exit codes outside the 0-5 range (excluding signal-derived codes)
- [ ] All dependency checks use `exit 3` (EXIT_MISSING_DEP)
- [ ] All usage/argument errors use `exit 2` (EXIT_USAGE)
- [ ] `--help` always exits with code 0

---

## Task 6.4.11: Shared Library Creation

### Description

Create `scripts/lib/common.sh` as the single shared library sourced by all scripts. This eliminates the 49 separate color definitions, 5+ separate logging function sets, and duplicated utility patterns across the script corpus.

### File: `scripts/lib/common.sh`

```bash
#!/usr/bin/env bash
# -------------------------------------------------------------------
# Script:        lib/common.sh
# Purpose:       Shared library providing logging, validation, and utility
#                functions for all Argos shell scripts
# Usage:         source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"
#                (from scripts/ directory)
#                source "$(dirname "${BASH_SOURCE[0]}")/../lib/common.sh"
#                (from scripts/subdirectory/)
# Prerequisites: bash 4.4+
# Exit Codes:    N/A (library, not standalone)
# -------------------------------------------------------------------

# Guard against double-sourcing
if [[ -n "${_ARGOS_COMMON_LOADED:-}" ]]; then
    return 0
fi
readonly _ARGOS_COMMON_LOADED=1

# ===================================================================
# EXIT CODE CONSTANTS
# ===================================================================
readonly EXIT_SUCCESS=0
readonly EXIT_ERROR=1
readonly EXIT_USAGE=2
readonly EXIT_MISSING_DEP=3
readonly EXIT_CONFIG=4
readonly EXIT_PARTIAL=5

# ===================================================================
# COLOR SUPPORT (terminal-aware)
# ===================================================================
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

# ===================================================================
# LOGGING FUNCTIONS
# ===================================================================
# Log levels: DEBUG=0, INFO=1, WARN=2, ERROR=3, FATAL=4
_log_level_num() {
    case "${1:-INFO}" in
        DEBUG) echo 0 ;; INFO) echo 1 ;; WARN) echo 2 ;;
        ERROR) echo 3 ;; FATAL) echo 4 ;; *) echo 1 ;;
    esac
}

_log() {
    local level="${1}"
    shift
    local min_level
    min_level=$(_log_level_num "${ARGOS_LOG_LEVEL:-INFO}")
    local this_level
    this_level=$(_log_level_num "${level}")
    if [[ "${this_level}" -lt "${min_level}" ]]; then
        return 0
    fi
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

# ===================================================================
# PATH DETECTION
# ===================================================================
# Determine project root reliably regardless of invocation directory
detect_project_root() {
    local dir
    dir=$(cd "$(dirname "${BASH_SOURCE[1]:-$0}")" && pwd)
    while [[ "${dir}" != "/" ]]; do
        if [[ -f "${dir}/package.json" && -d "${dir}/src" ]]; then
            echo "${dir}"
            return 0
        fi
        dir=$(dirname "${dir}")
    done
    log_error "Cannot detect project root (no package.json found)"
    return 1
}

# Resolve the scripts/lib directory for sourcing other libraries
detect_lib_dir() {
    local source_file="${BASH_SOURCE[1]:-$0}"
    local dir
    dir=$(cd "$(dirname "${source_file}")" && pwd)
    # If we are in scripts/lib/, return current dir
    if [[ "$(basename "${dir}")" == "lib" ]]; then
        echo "${dir}"
        return 0
    fi
    # If we are in scripts/ or scripts/subdir/, look for lib/
    while [[ "${dir}" != "/" ]]; do
        if [[ -d "${dir}/lib" && -f "${dir}/lib/common.sh" ]]; then
            echo "${dir}/lib"
            return 0
        fi
        dir=$(dirname "${dir}")
    done
    log_error "Cannot detect lib directory"
    return 1
}

# ===================================================================
# DEPENDENCY CHECKING
# ===================================================================
require_cmd() {
    local cmd
    for cmd in "$@"; do
        if ! command -v "${cmd}" >/dev/null 2>&1; then
            log_error "Required command not found: ${cmd}"
            log_error "Install it with: apt-get install ${cmd} (or equivalent)"
            exit "${EXIT_MISSING_DEP}"
        fi
    done
}

require_root() {
    if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
        log_error "This script must be run as root (use sudo)"
        exit "${EXIT_MISSING_DEP}"
    fi
}

require_file() {
    local f
    for f in "$@"; do
        if [[ ! -f "${f}" ]]; then
            log_error "Required file not found: ${f}"
            exit "${EXIT_CONFIG}"
        fi
    done
}

require_dir() {
    local d
    for d in "$@"; do
        if [[ ! -d "${d}" ]]; then
            log_error "Required directory not found: ${d}"
            exit "${EXIT_CONFIG}"
        fi
    done
}

# ===================================================================
# DRY-RUN SUPPORT
# ===================================================================
# Scripts set DRY_RUN=true when --dry-run is passed
DRY_RUN="${DRY_RUN:-false}"

run_cmd() {
    if [[ "${DRY_RUN}" == "true" ]]; then
        log_info "[DRY-RUN] Would execute: $*"
        return 0
    fi
    "$@"
}

# ===================================================================
# IDEMPOTENT SYSTEM CONFIG
# ===================================================================
# Write a sysctl drop-in file (idempotent: overwrites, not appends)
write_sysctl_conf() {
    local name="${1}"  # e.g., "90-argos"
    local content="${2}"
    local target="/etc/sysctl.d/${name}.conf"
    run_cmd bash -c "cat > '${target}' <<'SYSCTL_EOF'
${content}
SYSCTL_EOF"
    run_cmd sysctl --system
    log_info "Applied sysctl configuration: ${target}"
}

# Write a limits.d drop-in file (idempotent)
write_limits_conf() {
    local name="${1}"
    local content="${2}"
    local target="/etc/security/limits.d/${name}.conf"
    run_cmd bash -c "cat > '${target}' <<'LIMITS_EOF'
${content}
LIMITS_EOF"
    log_info "Applied limits configuration: ${target}"
}

# ===================================================================
# SAFE OPERATIONS
# ===================================================================
# cd with error handling (prevents silent directory change failures)
safe_cd() {
    local target="${1}"
    if [[ ! -d "${target}" ]]; then
        log_error "Directory does not exist: ${target}"
        exit "${EXIT_ERROR}"
    fi
    cd "${target}" || { log_error "Failed to cd to: ${target}"; exit "${EXIT_ERROR}"; }
}

# Create temporary directory with automatic cleanup registration
make_temp_dir() {
    local prefix="${1:-argos}"
    local tmpdir
    tmpdir=$(mktemp -d "${TMPDIR:-/tmp}/${prefix}-XXXXXX")
    # Register cleanup if not already registered
    if [[ -z "${_ARGOS_TEMP_DIRS:-}" ]]; then
        _ARGOS_TEMP_DIRS=()
        _cleanup_temp_dirs() {
            local d
            for d in "${_ARGOS_TEMP_DIRS[@]+"${_ARGOS_TEMP_DIRS[@]}"}"; do
                [[ -d "${d}" ]] && rm -rf "${d}"
            done
        }
        trap _cleanup_temp_dirs EXIT
    fi
    _ARGOS_TEMP_DIRS+=("${tmpdir}")
    echo "${tmpdir}"
}
```

#### Library Decomposition (Single Responsibility Principle)

The shared library should be decomposed into focused modules rather than a single monolithic file:

| Module                   | Responsibility                         | Functions                                        |
| ------------------------ | -------------------------------------- | ------------------------------------------------ |
| `scripts/lib/log.sh`     | Logging and output formatting          | `log_info`, `log_warn`, `log_error`, `log_debug` |
| `scripts/lib/args.sh`    | Argument parsing and --help/--dry-run  | `parse_args`, `show_help`, `require_arg`         |
| `scripts/lib/cleanup.sh` | Trap handlers, temp dir, lock files    | `setup_trap`, `create_temp`, `acquire_lock`      |
| `scripts/lib/paths.sh`   | Path resolution (sources argos-env.sh) | `resolve_path`, `require_dir`, `require_file`    |

Each module should be independently sourceable: `source scripts/lib/log.sh`
A convenience wrapper can source all: `source scripts/lib/common.sh` (which sources each module)

### Source Pattern for Scripts in `scripts/`

```bash
#!/usr/bin/env bash
set -euo pipefail

# Source shared library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh"
```

### Source Pattern for Scripts in `scripts/subdirectory/`

```bash
#!/usr/bin/env bash
set -euo pipefail

# Source shared library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../lib/common.sh"
```

### Verification

```bash
# common.sh exists and is valid bash
bash -n scripts/lib/common.sh
# Expected: exit 0

# common.sh passes shellcheck
shellcheck --severity=warning scripts/lib/common.sh
# Expected: no output

# All scripts source common.sh
MISSING=$(find scripts/ -name "*.sh" -type f -not -path "*/lib/*" -exec sh -c \
  'grep -q "common.sh" "$1" || echo "$1"' _ {} \;)
echo "${MISSING}" | grep -c "."
# Expected: 0

# Double-source guard works
bash -c 'source scripts/lib/common.sh; source scripts/lib/common.sh; echo OK'
# Expected: OK (no errors)

# Logging functions are available after sourcing
bash -c 'source scripts/lib/common.sh; log_info "test message"' 2>&1 | grep -q "INFO"
# Expected: exit 0
```

### Acceptance Criteria

- [ ] `scripts/lib/common.sh` exists and passes `bash -n` and `shellcheck --severity=warning`
- [ ] All scripts (except `common.sh` itself) source `common.sh`
- [ ] Double-sourcing is safe (guard variable prevents re-execution)
- [ ] `log_info`, `log_warn`, `log_error`, `log_fatal` functions are available in all scripts
- [ ] `require_cmd`, `require_root`, `require_file` functions are available
- [ ] `run_cmd` respects `DRY_RUN` environment variable
- [ ] `safe_cd` replaces bare `cd` in all scripts
- [ ] `make_temp_dir` auto-registers cleanup traps
- [ ] Exit code constants are available in all scripts
- [ ] No script defines its own color variables, logging functions, or exit code constants

---

## Task 6.4.12: CI Integration

### Description

Add shell script validation to the existing GitHub Actions CI pipeline (`.github/workflows/ci.yml`). This ensures that all shell standardization rules are enforced on every push and pull request.

### Current CI State

The existing `ci.yml` runs:

1. `npm run lint` (ESLint -- currently fails with 63 errors)
2. `npm run format:check` (Prettier)
3. `npm run typecheck` (TypeScript)
4. `npm test` (Vitest)
5. `npm run build` (SvelteKit -- fails without `.env`)

Shell scripts are not validated in CI. This task adds a dedicated job for shell validation.

### New CI Job

Add the following job to `.github/workflows/ci.yml`:

```yaml
validate-shell:
    name: 'Validate Shell Scripts'
    runs-on: ubuntu-latest
    steps:
        - name: 'Checkout Code'
          uses: actions/checkout@v4

        - name: 'Install ShellCheck'
          run: sudo apt-get update && sudo apt-get install -y shellcheck

        - name: 'Verify ShellCheck Version'
          run: |
              shellcheck --version
              # Require 0.9.0+ for full bash 5.x support
              VERSION=$(shellcheck --version | grep "version:" | awk '{print $2}')
              echo "ShellCheck version: ${VERSION}"

        - name: 'Bash Syntax Check (bash -n)'
          run: |
              ERRORS=0
              while IFS= read -r -d '' script; do
                if ! bash -n "${script}" 2>/dev/null; then
                  echo "SYNTAX ERROR: ${script}"
                  bash -n "${script}"
                  ERRORS=$((ERRORS + 1))
                fi
              done < <(find scripts/ -name "*.sh" -type f -print0)
              echo "Syntax errors found: ${ERRORS}"
              exit "${ERRORS}"

        - name: 'ShellCheck Analysis (severity=warning)'
          run: |
              FINDINGS=0
              while IFS= read -r -d '' script; do
                OUTPUT=$(shellcheck --severity=warning -f gcc "${script}" 2>/dev/null)
                if [[ -n "${OUTPUT}" ]]; then
                  echo "${OUTPUT}"
                  FINDINGS=$((FINDINGS + $(echo "${OUTPUT}" | wc -l)))
                fi
              done < <(find scripts/ -name "*.sh" -type f -print0)
              echo "Total ShellCheck findings: ${FINDINGS}"
              if [[ "${FINDINGS}" -gt 0 ]]; then
                exit 1
              fi

        - name: 'Verify Shebang Standardization'
          run: |
              VIOLATIONS=0
              while IFS= read -r -d '' script; do
                SHEBANG=$(head -1 "${script}")
                if [[ "${SHEBANG}" != "#!/usr/bin/env bash" ]]; then
                  echo "BAD SHEBANG: ${script} (${SHEBANG})"
                  VIOLATIONS=$((VIOLATIONS + 1))
                fi
              done < <(find scripts/ -name "*.sh" -type f -print0)
              echo "Shebang violations: ${VIOLATIONS}"
              exit "${VIOLATIONS}"

        - name: 'Verify Strict Mode'
          run: |
              VIOLATIONS=0
              while IFS= read -r -d '' script; do
                LINE2=$(sed -n '2p' "${script}")
                if [[ "${LINE2}" != "set -euo pipefail" ]]; then
                  echo "MISSING STRICT MODE: ${script} (line 2: ${LINE2})"
                  VIOLATIONS=$((VIOLATIONS + 1))
                fi
              done < <(find scripts/ -name "*.sh" -type f -print0)
              echo "Strict mode violations: ${VIOLATIONS}"
              exit "${VIOLATIONS}"

        - name: 'Verify common.sh Sourcing'
          run: |
              VIOLATIONS=0
              while IFS= read -r -d '' script; do
                # Skip the library itself
                [[ "${script}" == *"lib/common.sh"* ]] && continue
                if ! grep -q "common.sh" "${script}"; then
                  echo "NOT SOURCING common.sh: ${script}"
                  VIOLATIONS=$((VIOLATIONS + 1))
                fi
              done < <(find scripts/ -name "*.sh" -type f -print0)
              echo "Sourcing violations: ${VIOLATIONS}"
              exit "${VIOLATIONS}"
```

### Pre-Commit Hook Addition

Add shell validation to the existing Husky pre-commit hook:

```bash
# In .husky/pre-commit (append to existing content):

# Shell script validation (Phase 6.4.12)
SHELL_STAGED=$(git diff --cached --name-only --diff-filter=ACM | grep '\.sh$' || true)
if [[ -n "${SHELL_STAGED}" ]]; then
    echo "Validating staged shell scripts..."
    for script in ${SHELL_STAGED}; do
        if [[ -f "${script}" ]]; then
            bash -n "${script}" || { echo "Syntax error in ${script}"; exit 1; }
            shellcheck --severity=warning "${script}" || { echo "ShellCheck failed on ${script}"; exit 1; }
        fi
    done
fi
```

### Verification

```bash
# CI YAML is valid
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))" 2>/dev/null
# Expected: exit 0 (no YAML errors)

# Simulate the CI shell validation locally
find scripts/ -name "*.sh" -type f -print0 | \
  xargs -0 -I{} bash -n {} && echo "All syntax OK"
find scripts/ -name "*.sh" -type f -print0 | \
  xargs -0 -I{} shellcheck --severity=warning -f gcc {} 2>/dev/null | wc -l
# Expected: 0
```

### Acceptance Criteria

- [ ] `.github/workflows/ci.yml` contains a `validate-shell` job
- [ ] CI job runs `bash -n` on all `.sh` files
- [ ] CI job runs `shellcheck --severity=warning` on all `.sh` files
- [ ] CI job verifies shebang standardization
- [ ] CI job verifies strict mode on line 2
- [ ] CI job verifies `common.sh` sourcing
- [ ] Pre-commit hook validates staged `.sh` files before commit
- [ ] All 6 CI checks pass on the current codebase after Phase 6.4 completion

---

## 17. Verification Checklist

This checklist is the phase gate. ALL items MUST pass before Phase 6.4 is marked complete.

### Automated Verification Script

Save as `scripts/verify-phase-6.4.sh` and execute:

```bash
#!/usr/bin/env bash
set -euo pipefail

PASS=0
FAIL=0
TOTAL=0

check() {
    TOTAL=$((TOTAL + 1))
    local description="${1}"
    shift
    if eval "$@" >/dev/null 2>&1; then
        echo "[PASS] ${description}"
        PASS=$((PASS + 1))
    else
        echo "[FAIL] ${description}"
        FAIL=$((FAIL + 1))
    fi
}

cd "$(git rev-parse --show-toplevel)"

echo "========================================="
echo "Phase 6.4 Verification"
echo "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "========================================="

# 6.4.1: Shebang
check "All shebangs are #!/usr/bin/env bash" \
    '[ "$(find scripts/ -name "*.sh" -type f -exec sh -c "head -1 \"\$1\" | grep -qv \"^#!/usr/bin/env bash$\" && echo 1" _ {} \; | wc -l)" -eq 0 ]'

# 6.4.2: Strict mode
check "All scripts have set -euo pipefail on line 2" \
    '[ "$(find scripts/ -name "*.sh" -type f -exec sh -c "LINE2=\$(sed -n 2p \"\$1\"); [ \"\$LINE2\" != \"set -euo pipefail\" ] && echo 1" _ {} \; | wc -l)" -eq 0 ]'

# 6.4.3: Header blocks
for field in "Purpose:" "Usage:" "Prerequisites:" "Exit Codes:"; do
    check "All scripts have header field: ${field}" \
        "[ \"\$(find scripts/ -name '*.sh' -type f -exec sh -c 'grep -qF \"# ${field}\" \"\$1\" || echo 1' _ {} \; | wc -l)\" -eq 0 ]"
done

# 6.4.4: ShellCheck
check "Zero shellcheck warnings" \
    '[ "$(find scripts/ -name "*.sh" -type f -exec shellcheck --severity=warning -f gcc {} \; 2>/dev/null | wc -l)" -eq 0 ]'

# 6.4.5: No bare eval with variables
check "No eval with variable expansion" \
    '[ "$(grep -rn "eval \\\$" scripts/ --include="*.sh" 2>/dev/null | wc -l)" -eq 0 ]'

# 6.4.6: Trap handlers for temp file users
check "All mktemp users have trap handlers" \
    '[ "$(for f in $(find scripts/ -name "*.sh" -type f -exec grep -l "mktemp" {} \;); do grep -q "trap " "$f" || echo 1; done | wc -l)" -eq 0 ]'

# 6.4.8: No cat >> to system configs
check "No cat >> to system config files" \
    '[ "$(grep -rn "cat >>" scripts/ --include="*.sh" | grep -i "sysctl\|limits\|fstab" | wc -l)" -eq 0 ]'

# 6.4.8: vm.swappiness consistency
check "All vm.swappiness values are 60" \
    '[ "$(grep -rn "vm.swappiness" scripts/ --include="*.sh" | grep -v "60\|proc/sys" | wc -l)" -eq 0 ]'

# 6.4.10: No bare exit
check "No bare exit statements without code" \
    '[ "$(grep -rn "^[[:space:]]*exit$" scripts/ --include="*.sh" | wc -l)" -eq 0 ]'

# 6.4.11: common.sh exists
check "scripts/lib/common.sh exists" \
    '[ -f scripts/lib/common.sh ]'

# 6.4.11: common.sh passes shellcheck
check "common.sh passes shellcheck" \
    'shellcheck --severity=warning scripts/lib/common.sh'

# 6.4.11: All scripts source common.sh
check "All scripts source common.sh" \
    '[ "$(find scripts/ -name "*.sh" -type f -not -path "*/lib/*" -exec sh -c "grep -q common.sh \"\$1\" || echo 1" _ {} \; | wc -l)" -eq 0 ]'

# 6.4.12: CI job exists
check "CI workflow contains validate-shell job" \
    'grep -q "validate-shell" .github/workflows/ci.yml'

# Syntax check all scripts
check "All scripts pass bash -n" \
    'find scripts/ -name "*.sh" -type f -exec bash -n {} \;'

echo ""
echo "========================================="
echo "Results: ${PASS} passed, ${FAIL} failed, ${TOTAL} total"
echo "========================================="

if [[ "${FAIL}" -gt 0 ]]; then
    echo "PHASE 6.4: NOT COMPLETE"
    exit 1
else
    echo "PHASE 6.4: COMPLETE"
    exit 0
fi
```

### Manual Verification Items

These cannot be fully automated and require human review:

| ID   | Check                                     | Method                                                                         |
| ---- | ----------------------------------------- | ------------------------------------------------------------------------------ |
| MV-1 | `--help` output is accurate and complete  | Run `script.sh --help` for each service script; verify against actual behavior |
| MV-2 | `--dry-run` produces zero side effects    | Run with `--dry-run`, verify no files changed, no services restarted           |
| MV-3 | Idempotency: running setup twice is safe  | Run setup script, capture state; run again, diff state                         |
| MV-4 | Log output is parseable by standard tools | Pipe log output through `awk -F'[][]' '{print $4}'` to extract levels          |
| MV-5 | Exit codes match documentation            | Trigger each exit path, verify code matches header comment                     |
| MV-6 | All shellcheck suppressions are justified | `grep -B1 "shellcheck disable" scripts/` and review justification comments     |

---

## 18. Traceability Matrix

This matrix maps every task to the deficiency it remediates, the standard it satisfies, and the verification that confirms compliance.

| Task   | Deficiency                                                                               | Standard                             | Files Affected                 | Verification Command                                                              |
| ------ | ---------------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------ | --------------------------------------------------------------------------------- |
| 6.4.1  | 200 hardcoded `#!/bin/bash` + 1 malformed + 1 missing shebang                            | NASA/JPL Rule 1 (adapted)            | All ~75-80 scripts             | `find scripts/ -name "*.sh" -exec head -1 {} \; \| sort -u`                       |
| 6.4.2  | 134 scripts with no error handling (plus 34 partial, 3 trap-only)                        | CERT SH-01, SH-02, SH-03             | All ~75-80 scripts             | `grep -c "set -euo pipefail" <(find scripts/ -name "*.sh" -exec sed -n 2p {} \;)` |
| 6.4.3  | 183 scripts with no documentation header                                                 | NASA/JPL Rule 3 (adapted)            | All ~75-80 scripts             | `grep -rl "# Purpose:" scripts/ --include="*.sh" \| wc -l`                        |
| 6.4.4  | 767 total shellcheck findings (6 error, 336 warning, 402 info, 23 style) across 84 files | CERT SH (all)                        | 84 files (pre-consolidation)   | `shellcheck --severity=warning scripts/*.sh 2>/dev/null \| wc -l`                 |
| 6.4.5  | Unquoted variables, no input validation                                                  | CERT SH-05, OWASP Cmd Injection      | 81 parameter-accepting scripts | `shellcheck --include=SC2086 scripts/*.sh \| wc -l`                               |
| 6.4.6  | 57 mktemp users without cleanup traps                                                    | CERT MEM-01 (adapted)                | 60 temp-file scripts           | See Task 6.4.6 verification                                                       |
| 6.4.7  | 0 scripts with --dry-run support                                                         | Operational safety                   | ~30 service management scripts | `grep -rl "\-\-dry-run" scripts/ --include="*.sh" \| wc -l`                       |
| 6.4.8  | 4 non-idempotent config append patterns                                                  | Ansible/Terraform best practice      | 3 setup/install scripts        | `grep -rn "cat >>" scripts/ \| grep sysctl \| wc -l`                              |
| 6.4.9  | 6+ inconsistent logging formats                                                          | NASA/JPL Rule 2 (adapted)            | All ~75-80 scripts             | `grep -rl "RED=.*033" scripts/ --include="*.sh" \| wc -l`                         |
| 6.4.10 | 2 scripts use non-standard exit codes                                                    | POSIX exit code convention           | All ~75-80 scripts             | `grep -rn "exit [6-9]\|exit [1-9][0-9]" scripts/ --include="*.sh" \| wc -l`       |
| 6.4.11 | 49 duplicate color definitions, 5+ log function sets                                     | DRY principle                        | New: `scripts/lib/common.sh`   | `bash -n scripts/lib/common.sh && shellcheck scripts/lib/common.sh`               |
| 6.4.12 | Shell scripts not validated in CI                                                        | Continuous integration best practice | `.github/workflows/ci.yml`     | `grep -q "validate-shell" .github/workflows/ci.yml`                               |

---

## Appendix A: Task Execution Order and Dependencies

```
6.4.11 (common.sh library)  <-- MUST be first: all other tasks depend on it
  |
  v
6.4.1 (shebangs)            <-- Fix entry points first (prerequisite for shellcheck clean run)
  |
  v
6.4.6 (traps/error audit)   <-- MUST come BEFORE 6.4.2: audit false-positive error exits
  |                              (grep returning 1, diff returning 1, cd to missing dirs)
  |                              and add || true / conditional guards BEFORE strict mode
  v
6.4.2 (strict mode)         <-- NOW safe to enable: false-positive exits already guarded
  |
  v
6.4.3 (headers)
  |
  v
6.4.4 (shellcheck) <-- Depends on 6.4.1/6.4.2 (shebang and strict mode affect SC findings)
  |
  v
6.4.5 (quoting/validation) <-- Depends on 6.4.4 (SC2086 is part of shellcheck compliance)
  |
  v
6.4.7 (help/dry) ---\
6.4.8 (idempotency) -+-- Can execute in parallel
  |
  v
6.4.9 (logging) <-- Depends on 6.4.11 (uses common.sh log functions)
  |
  v
6.4.10 (exit codes) <-- Depends on 6.4.11 (uses common.sh constants)
  |
  v
6.4.12 (CI) <-- MUST be last: validates all preceding tasks
```

> **WARNING**: The original ordering placed 6.4.2 (strict mode) and 6.4.6 (traps/error audit) as parallel. This is INCORRECT and will cause cascading breakage. `set -euo pipefail` added to scripts containing `grep` (exit 1 on no match), `diff` (exit 1 on differences), or `cd` to potentially-missing directories will cause immediate termination. Task 6.4.6 must audit and guard these patterns FIRST.

**Critical path:** 6.4.11 -> 6.4.1 -> 6.4.6 -> 6.4.2 -> 6.4.3 -> 6.4.4 -> 6.4.5 -> 6.4.9 -> 6.4.10 -> 6.4.12

**Estimated effort:** 16-24 engineer-hours for an operator familiar with the codebase.

---

## Appendix B: Risk Assessment

| Risk                                                            | Probability | Impact | Mitigation                                                                                    |
| --------------------------------------------------------------- | ----------- | ------ | --------------------------------------------------------------------------------------------- |
| `set -euo pipefail` breaks scripts that rely on command failure | HIGH        | MEDIUM | Test each script after adding strict mode; use `\|\| true` for intentionally-failing commands |
| `-u` flag breaks scripts with optional positional params        | HIGH        | LOW    | Convert all `$1` to `${1:-}` with validation (Task 6.4.2)                                     |
| `common.sh` sourcing path breaks in Docker containers           | MEDIUM      | HIGH   | Use `${BASH_SOURCE[0]}` relative path detection, not hardcoded paths                          |
| ShellCheck suppressions mask real bugs                          | LOW         | MEDIUM | Require justifying comments; cap total suppressions; review in phase gate                     |
| CI validation blocks legitimate PRs                             | MEDIUM      | LOW    | CI is advisory (branch protection not yet enforced per CI audit)                              |
| Logging to stderr breaks scripts that capture stderr            | LOW         | LOW    | Audit all `2>&1` redirections before converting echo to log functions                         |

---

## Appendix C: Glossary

| Term              | Definition                                                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Idempotent        | An operation that produces the same result regardless of how many times it is executed                                         |
| Shebang           | The `#!` line at the top of a script that specifies the interpreter                                                            |
| Strict mode       | `set -euo pipefail` -- causes bash to exit on errors, unset variables, and pipeline failures                                   |
| ShellCheck        | Static analysis tool for shell scripts (version 0.11.0 installed on target)                                                    |
| Drop-in directory | A `.d/` directory where configuration fragments are placed (e.g., `/etc/sysctl.d/`) to avoid modifying monolithic config files |
| SC2155            | ShellCheck code: declare and assign separately to avoid masking return values                                                  |
| SC2164            | ShellCheck code: use `cd ... \|\| exit` in case cd fails                                                                       |
| SC2086            | ShellCheck code: double-quote to prevent globbing and word splitting                                                           |

---

---

## Appendix D: Audit Corrections Applied (Revision 1.1)

The following corrections were applied based on the Phase 6 audit review:

| #   | Section                             | Original Value                          | Corrected Value                                                             | Reason                                                                         |
| --- | ----------------------------------- | --------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 1   | Executive Summary, ShellCheck table | 342 warnings, 2 severity rows           | 336 warnings + 402 info + 23 style = 767 total, 5 severity rows             | Original omitted 425 findings at info/style level                              |
| 2   | Executive Summary, Top violations   | SC2155 ranked #1 (149 instances)        | SC2086 ranked #1 (220 instances)                                            | SC2086 is the most dangerous (injection vector); SC2155 is a correctness issue |
| 3   | Executive Summary + Baseline        | SC2024 count = 65                       | SC2024 count = 73                                                           | Verified recount                                                               |
| 4   | Executive Summary + Baseline        | No error handling = 131 (64.9%)         | No error handling = 134 (66.3%), added partial (34) and trap-only (3) tiers | Original only had two-tier breakdown                                           |
| 5   | Executive Summary + Task 6.4.7      | --help support = 9 (4.5%)               | --help support = 8 (3.96%)                                                  | Verified recount                                                               |
| 6   | Executive Summary + Task 6.4.1      | 1 malformed shebang                     | 2 broken shebangs (1 malformed + 1 missing)                                 | `start-usrp-service.sh` has no shebang (SC2148)                                |
| 7   | Task 6.4.2 + Appendix A             | 6.4.2 (strict mode) parallel with 6.4.1 | 6.4.6 MUST execute BEFORE 6.4.2                                             | Strict mode causes cascading failures in scripts with grep/diff/cd             |
| 8   | Task 6.4.4                          | No mention of ShellCheck blind spots    | Added "Security-Critical Patterns Not Covered by ShellCheck" table          | eval, curl\|sh, chmod 777, rm -rf $UNQUOTED not detectable by static analysis  |
| 9   | Task 6.4.11                         | Single monolithic common.sh             | Added library decomposition into log.sh, args.sh, cleanup.sh, paths.sh      | Single Responsibility Principle                                                |

```
END OF DOCUMENT
Phase:     6.4
Status:    FINAL (CORRECTED)
Revision:  1.1
Date:      2026-02-08
```
