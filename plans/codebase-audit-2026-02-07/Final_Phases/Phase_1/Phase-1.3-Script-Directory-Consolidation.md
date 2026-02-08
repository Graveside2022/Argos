# Phase 1.3: Script Directory Consolidation

**Task ID**: 1.3
**Risk Level**: ZERO
**Produces Git Commit**: Yes
**Dependencies**: Task 1.0 (pre-execution snapshot)
**Standards**: NASA/JPL Rule 1 (restrict to simple constructs), DRY principle (eliminate duplication)
**Audit Findings Resolved**: NF-4
**Commit Message**: `cleanup(phase1.3): consolidate scripts/development/ into scripts/dev/`

---

## Purpose

Eliminate the duplicate `scripts/development/` directory by merging its contents into `scripts/dev/`. The two directories contain 4 byte-identical files and 2 unique files. After merge, update all references in `package.json` and `build-tools/package.json` to point to the canonical `scripts/dev/` path.

## Pre-Conditions

- [ ] Task 1.0 (pre-execution snapshot) is complete
- [ ] `phase1-pre-execution` git tag exists
- [ ] Both directories exist: `scripts/dev/` and `scripts/development/`
- [ ] No running processes depend on scripts in these directories

---

## Subtask 1.3.1: Verify Current State

### Verify Both Directories Exist

```bash
ls -d scripts/dev scripts/development
```

**Expected**: Both directories listed.

### Verify File Contents Match

4 files are byte-identical across both directories (verified via MD5):

| File                    | scripts/dev/ size | scripts/development/ size | Status                |
| ----------------------- | ----------------- | ------------------------- | --------------------- |
| `start-all-services.sh` | 7,733 bytes       | 7,733 bytes               | Identical (MD5 match) |
| `start-fusion-dev.sh`   | 924 bytes         | 924 bytes                 | Identical (MD5 match) |
| `analyze-950-simple.sh` | 2,111 bytes       | 2,111 bytes               | Identical (MD5 match) |
| `auto-start-hackrf.sh`  | 1,452 bytes       | 1,452 bytes               | Identical (MD5 match) |

**Re-verify before execution**:

```bash
for f in start-all-services.sh start-fusion-dev.sh analyze-950-simple.sh auto-start-hackrf.sh; do
    md5sum "scripts/dev/$f" "scripts/development/$f"
done
```

**Expected**: MD5 hashes match for all 4 pairs.

**HALT condition**: If any MD5 hash pair does NOT match, the files have diverged since verification. Do NOT proceed. Investigate which version is correct before merging.

### Verify Unique Files in scripts/development/

2 files exist only in `scripts/development/` and must be moved (not lost):

| File                    | Size      | Exists in scripts/dev/? |
| ----------------------- | --------- | ----------------------- |
| `auto-start-kismet.sh`  | 763 bytes | No                      |
| `start-usrp-service.sh` | 332 bytes | No                      |

```bash
test -f scripts/development/auto-start-kismet.sh && echo "EXISTS" || echo "MISSING"
test -f scripts/development/start-usrp-service.sh && echo "EXISTS" || echo "MISSING"
test -f scripts/dev/auto-start-kismet.sh && echo "CONFLICT" || echo "SAFE"
test -f scripts/dev/start-usrp-service.sh && echo "CONFLICT" || echo "SAFE"
```

**Expected**: EXISTS, EXISTS, SAFE, SAFE

**HALT condition**: If either unique file already exists in `scripts/dev/` (CONFLICT), investigate before overwriting.

---

## Subtask 1.3.2: Execute Directory Merge

### Step 1: Move Unique Files

```bash
mv scripts/development/auto-start-kismet.sh scripts/dev/
mv scripts/development/start-usrp-service.sh scripts/dev/
```

### Step 2: Delete Redundant Directory

All remaining files in `scripts/development/` are duplicates of files in `scripts/dev/`. Safe to remove.

```bash
rm -rf scripts/development/
```

### Step 3: Verify Merge

```bash
# Old directory is gone
test -d scripts/development/ && echo "FAIL: directory still exists" || echo "PASS: directory removed"

# All 6 files exist in scripts/dev/
for f in start-all-services.sh start-fusion-dev.sh analyze-950-simple.sh auto-start-hackrf.sh auto-start-kismet.sh start-usrp-service.sh; do
    test -f "scripts/dev/$f" && echo "PASS: $f" || echo "FAIL: $f missing"
done
```

**Expected**: All PASS.

---

## Subtask 1.3.3: Update Package.json References

### Root `package.json`

Two npm scripts reference `scripts/development/`:

| npm Script        | Current Path                                  | New Path                              |
| ----------------- | --------------------------------------------- | ------------------------------------- |
| `dev:auto-kismet` | `./scripts/development/auto-start-kismet.sh`  | `./scripts/dev/auto-start-kismet.sh`  |
| `dev:full`        | `./scripts/development/start-all-services.sh` | `./scripts/dev/start-all-services.sh` |

### `build-tools/package.json` (NF-4)

Two npm scripts also reference `scripts/development/`:

| npm Script        | Current Path (line)                                     | New Path                              |
| ----------------- | ------------------------------------------------------- | ------------------------------------- |
| `dev:auto-kismet` | `./scripts/development/auto-start-kismet.sh` (line 10)  | `./scripts/dev/auto-start-kismet.sh`  |
| `dev:full`        | `./scripts/development/start-all-services.sh` (line 12) | `./scripts/dev/start-all-services.sh` |

### Execution

Edit both `package.json` files to replace `scripts/development/` with `scripts/dev/` in the affected script entries.

### Post-Edit Verification

```bash
# No references to deleted directory in ANY package.json
grep "scripts/development" package.json
# Expected: 0 results

grep "scripts/development" build-tools/package.json
# Expected: 0 results

# Broader search -- no references anywhere in tracked files
grep -rn "scripts/development" . --include="*.json" --include="*.md" --include="*.sh" --include="*.ts" --include="*.js"
# Expected: 0 results (or only results in audit/plan files which are documentation)
```

---

## Subtask 1.3.4: Final Verification

```bash
# 1. Old directory is gone
test -d scripts/development/ && echo "FAIL" || echo "PASS"
# Expected: PASS

# 2. All 6 files exist in scripts/dev/
for f in start-all-services.sh start-fusion-dev.sh analyze-950-simple.sh auto-start-hackrf.sh auto-start-kismet.sh start-usrp-service.sh; do
    test -f "scripts/dev/$f" && echo "PASS: $f" || echo "FAIL: $f"
done
# Expected: all PASS

# 3. No references to deleted directory in package.json files
grep "scripts/development" package.json && echo "FAIL" || echo "PASS"
grep "scripts/development" build-tools/package.json && echo "FAIL" || echo "PASS"
# Expected: all PASS

# 4. Scripts are executable
test -x scripts/dev/auto-start-kismet.sh && echo "PASS: executable" || echo "WARN: not executable"
test -x scripts/dev/start-usrp-service.sh && echo "PASS: executable" || echo "WARN: not executable"
# If WARN: chmod +x scripts/dev/auto-start-kismet.sh scripts/dev/start-usrp-service.sh

# 5. Build passes (no broken script references)
npm run build
# Expected: exit 0
```

---

## Rollback Procedure

```bash
git reset --soft HEAD~1
```

All changes in this task are git-tracked files. No `npm install` required. Git tracks directory changes via file paths.

## Risk Assessment

| Risk                            | Level | Mitigation                                          |
| ------------------------------- | ----- | --------------------------------------------------- |
| Data loss from unique files     | ZERO  | Unique files moved before directory deletion        |
| Duplicate files diverged        | ZERO  | MD5 verified identical; re-verify before execution  |
| Broken npm scripts              | ZERO  | Package.json references updated; build verification |
| build-tools/package.json missed | ZERO  | NF-4 audit finding explicitly addresses this        |

## Completion Criteria

- [ ] `scripts/development/` directory no longer exists
- [ ] All 6 scripts present in `scripts/dev/`
- [ ] Zero references to `scripts/development/` in any package.json
- [ ] `npm run build` exits 0
- [ ] Git commit created with correct message format
