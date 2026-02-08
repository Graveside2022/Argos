# Phase 1.6: Core Dump and Runtime Artifact Cleanup

**Task ID**: 1.6
**Risk Level**: ZERO
**Produces Git Commit**: No (disk-only operation)
**Dependencies**: Task 1.0 (pre-execution snapshot)
**Standards**: CERT MEM06-C (do not store sensitive data in reusable resources), CERT MSC18-C (be careful while handling sensitive data)
**Audit Findings Resolved**: MO-1, NF-5
**Estimated Savings**: ~100.3 MB (92.9 MB core dumps + 7.4 MB Kismet capture)

---

## Purpose

Delete 34 core dump files and 1 Kismet capture file from the project root. These are runtime artifacts, not source code. They waste ~100 MB of disk space and pose a security risk: core dumps may contain cleartext copies of API keys, session tokens, encryption keys, and RF signal data. In a tactical environment, core dumps on a captured device represent a data exfiltration vector.

**CRITICAL (NF-5)**: All files in this task are gitignored (`core.*` at line 398, `*.kismet` at line 376). Deleting them produces ZERO staged git changes. This task does NOT produce a git commit. Attempting `git commit` after this task would fail with "nothing to commit." This is correct and expected behavior.

## Pre-Conditions

- [ ] Task 1.0 (pre-execution snapshot) is complete
- [ ] `phase1-pre-execution` git tag exists
- [ ] No active debugging sessions that require core dumps
- [ ] No active Kismet capture sessions

---

## Subtask 1.6.1: Pre-Deletion Assessment

### Verify Core Dumps Exist

```bash
ls core.* 2>/dev/null | wc -l
```

**Expected**: 34 files (count may vary if new crashes have occurred since verification on 2026-02-07).

### Verify Core Dump Size

```bash
du -sh core.* 2>/dev/null
```

**Expected**: ~92.9 MB total.

### Verify Core Dumps Are Gitignored

```bash
git check-ignore core.1234 2>/dev/null
# Expected: core.1234 (confirmed ignored by .gitignore)

grep "^core\.\*" .gitignore
# Expected: core.* found at line 398
```

### Verify Kismet Capture Exists

```bash
ls *.kismet 2>/dev/null
```

**Expected**: `Kismet-20260207-20-39-41-1.kismet` (7,786,496 bytes / 7.4 MB).

### Verify Kismet Captures Are Gitignored

```bash
git check-ignore "test.kismet" 2>/dev/null
# Expected: test.kismet (confirmed ignored by .gitignore)

grep "^\*\.kismet" .gitignore
# Expected: *.kismet found at line 376
```

---

## Subtask 1.6.2: Security Risk Assessment

### Core Dumps

Per CERT MEM06-C, core dumps may contain cleartext copies of sensitive data present in process memory at the time of the crash:

| Data Type                    | Risk     | Impact if Exfiltrated       |
| ---------------------------- | -------- | --------------------------- |
| API keys (Anthropic, Kismet) | HIGH     | Unauthorized API access     |
| Session tokens               | HIGH     | Session hijacking           |
| Encryption keys              | CRITICAL | Decrypt intercepted traffic |
| RF signal data               | MEDIUM   | Intelligence disclosure     |
| GPS coordinates              | MEDIUM   | Position disclosure         |

**In tactical environments, core dumps on a captured device are a data exfiltration vector.** Immediate deletion is required per CERT MEM06-C.

### Kismet Capture

Kismet capture files contain intercepted WiFi traffic data. While not as sensitive as core dumps (the data is already available over the air), the captured data may include:

- Device MAC addresses and SSIDs
- Probe request patterns
- GPS coordinates of access points

**Decision**: If the capture contains valuable intelligence, back it up to a separate data directory BEFORE executing this task. Otherwise, delete.

---

## Subtask 1.6.3: Execute Deletion

### Delete Core Dumps

```bash
rm core.*
```

**NOTE**: This uses a glob pattern which is appropriate here because ALL core dump files should be deleted. This is an exception to the general principle of explicit file-by-file deletion because core dumps are non-deterministic runtime artifacts with no development value.

### Delete Kismet Capture

```bash
rm Kismet-20260207-20-39-41-1.kismet
```

**NOTE**: Additional `*.kismet` files may exist if new captures have started since the last verification. Check with:

```bash
ls *.kismet 2>/dev/null
```

If additional files exist, delete them as well (or back them up first if they contain wanted intelligence).

---

## Subtask 1.6.4: Final Verification

```bash
# 1. No core dumps remain
ls core.* 2>/dev/null | wc -l
# Expected: 0

# 2. No Kismet captures remain
ls *.kismet 2>/dev/null | wc -l
# Expected: 0

# 3. Disk space recovered
# (Informational -- no exact check, but ~100 MB should be freed)

# 4. Confirm ZERO git changes (these files are gitignored)
git status --short 2>/dev/null | grep -E "core\.|\.kismet" | wc -l
# Expected: 0 (no git-trackable changes)

# 5. Do NOT attempt git commit
# This task produces no staged changes. Running git commit would fail
# with "nothing to commit." This is correct behavior per NF-5.
```

---

## Rollback Procedure

**N/A -- Non-reversible.**

Core dumps are runtime artifacts generated by kernel crashes. They cannot be regenerated from source control and have no development value. Loss is acceptable.

Kismet capture files are runtime data. If the capture was needed, it should have been backed up before deletion.

## Risk Assessment

| Risk                                 | Level | Mitigation                                                             |
| ------------------------------------ | ----- | ---------------------------------------------------------------------- |
| Losing valuable debug data           | ZERO  | Core dumps are not analyzed; no open bug investigations depend on them |
| Losing valuable capture data         | LOW   | User should back up captures before deletion if needed                 |
| Accidentally deleting non-core files | ZERO  | `core.*` glob only matches files starting with "core."                 |
| Producing unexpected git changes     | ZERO  | All files are gitignored (NF-5 verified)                               |

## Completion Criteria

- [ ] Zero core dump files in project root (`ls core.* 2>/dev/null | wc -l` = 0)
- [ ] Zero Kismet capture files in project root (`ls *.kismet 2>/dev/null | wc -l` = 0)
- [ ] ~100 MB disk space recovered
- [ ] Zero git status changes from this task
- [ ] No git commit attempted (disk-only operation)
