# Phase 6.4.03: Header Block Standardization

**Document ID**: ARGOS-AUDIT-P6.4.03
**Parent Document**: Phase-6.4-SHELL-SCRIPT-STANDARDIZATION-AND-QUALITY.md
**Original Task ID**: 6.4.3
**Version**: 1.0
**Date**: 2026-02-08
**Author**: Claude Opus 4.6 (Lead Audit Agent)
**Classification**: UNCLASSIFIED // FOR OFFICIAL USE ONLY
**Risk Level**: LOW (documentation-only, no behavioral change)
**Review Standard**: CERT Secure Coding (SH), MISRA (adapted), NASA/JPL Rule Set (adapted)
**Target Corpus**: ~75-80 active scripts surviving Phase 6.2 consolidation

---

## 1. Objective

Ensure every script contains a standardized header block immediately after `set -euo pipefail`. This block provides context for operators and maintainers who encounter the script in production without access to this planning document.

**Current state:** Only 19 of 202 scripts (9.4%) have any documentation header (Purpose/Usage).

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

- Task 6.4.1 (Shebang Standardization) MUST be complete.
- Task 6.4.2 (Strict Mode Enforcement) MUST be complete.
- Headers are inserted between `set -euo pipefail` and the first executable statement.

---

## 3. Dependencies

| Dependency | Direction  | Task   | Reason                                                       |
| ---------- | ---------- | ------ | ------------------------------------------------------------ |
| AFTER      | Upstream   | 6.4.11 | common.sh library must exist first                           |
| AFTER      | Upstream   | 6.4.1  | Shebang must be on line 1 before header is positioned        |
| AFTER      | Upstream   | 6.4.2  | Strict mode must be on line 2 before header is positioned    |
| BEFORE     | Downstream | 6.4.4  | Headers may affect ShellCheck analysis (comments are benign) |

---

## 4. Rollback Strategy

### Per-Task Commit

This task MUST be committed as a separate, atomic Git commit:

```
refactor(scripts): Phase 6.4.3 - header block standardization
```

This enables targeted rollback via `git revert <commit-sha>` without affecting other tasks.

### Rollback Decision Criteria

Immediate rollback if:

- `bash -n` syntax check fails on any modified script (header block has unclosed comment)
- shellcheck `--severity=error` reports new errors not present at baseline

---

## 5. Baseline Metrics

| Metric                               | Count | Percentage |
| ------------------------------------ | ----- | ---------- |
| Documentation header (Purpose/Usage) | 19    | 9.4%       |

**183 scripts lack any documentation header.**

---

## 6. Task Details

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

---

## 7. Verification Commands

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

---

## 8. Acceptance Criteria

- [ ] Every `.sh` file contains all 5 required header fields
- [ ] Purpose field begins with a verb
- [ ] Usage field includes argument placeholders where the script accepts parameters
- [ ] Prerequisites field lists concrete tool/permission names (not vague descriptions)
- [ ] Header block is positioned between `set -euo pipefail` and the first executable statement

---

## 9. Traceability

| Task  | Deficiency                               | Standard                  | Files Affected     | Verification Command                                       |
| ----- | ---------------------------------------- | ------------------------- | ------------------ | ---------------------------------------------------------- |
| 6.4.3 | 183 scripts with no documentation header | NASA/JPL Rule 3 (adapted) | All ~75-80 scripts | `grep -rl "# Purpose:" scripts/ --include="*.sh" \| wc -l` |

---

## 10. Execution Order Notes

**Position in critical path:** 5th (after 6.4.11, 6.4.1, 6.4.6, 6.4.2)

```
... --> 6.4.2 (strict mode) --> 6.4.3 (headers) --> 6.4.4 (shellcheck) --> ...
```

This is a documentation-only task with zero behavioral risk. It can be executed quickly once the structural tasks (shebang, strict mode) are complete.

---

```
END OF TASK DOCUMENT
Task:     6.4.3 - Header Block Standardization
Status:   FINAL
Version:  1.0
Date:     2026-02-08
```
