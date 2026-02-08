# Phase 4.0.1: Pre-Execution Type Safety Snapshot

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: NASA/JPL Rule 2 (all code states must be traceable), NIST SP 800-53 CM-3 (Configuration Change Control)
**Review Panel**: US Cyber Command Engineering Review Board

**Task ID**: 4.0.1
**Risk Level**: ZERO
**Produces Git Commit**: No (tag only)
**Dependencies**: Phase 0 complete, Phase 1 complete, Phase 3 complete
**Blocks**: All Phase 4 tasks (4.1.0 through 4.5.7)
**Standards**: NASA/JPL Rule 2 (all code states must be traceable)

---

## Purpose

Establish a known-good rollback point and capture baseline type safety metrics before any Phase 4 modifications begin. This tag enables single-command full rollback if any task introduces regressions. The baseline metrics provide a quantitative before/after comparison for the Phase 4 audit trail.

Phase 4 modifies approximately 250 files to delete dead code, deduplicate types, eliminate `any` annotations, type all catch blocks, add Zod validation schemas, and enable strict compiler/linter options. A single incorrect deletion, import path change, or type annotation could break the build or introduce a runtime regression in security-critical SIGINT processing code. The pre-execution snapshot ensures traceability per NASA/JPL Rule 2.

---

## Pre-Conditions

- [ ] Phase 0 (Code Organization / Dead Code Removal) is complete
- [ ] Phase 1 (Zero-Risk Cleanup) is complete
- [ ] Phase 3 (Code Quality) is complete (or all Phase 3 plan files committed)
- [ ] Working tree is in a known state (only expected changes present)
- [ ] Current branch is confirmed (should be `dev_branch`)
- [ ] All pending Phase 1, Phase 2, and Phase 3 plan documents are committed or stashed

---

## Execution Steps

### Step 1: Verify Prior Phase Completion

```bash
git log --oneline -15
```

**Expected output**: Recent commits show Phase 1 or Phase 3 cleanup work. No uncommitted Phase 0/1/3 changes remaining.

**HALT condition**: If Phase 0, Phase 1, or Phase 3 tasks are incomplete or have uncommitted changes, complete those phases before proceeding.

### Step 2: Verify Working Tree State

```bash
git status --short
```

**Expected output**: Clean working tree or only known untracked audit plan files.

**HALT condition**: If unexpected modified files appear, investigate before proceeding. Do NOT create the tag with unresolved modifications to source files.

### Step 3: Verify Current Branch

```bash
git branch --show-current
```

**Expected output**: `dev_branch`

**HALT condition**: If on `main` or an unexpected branch, switch to the correct working branch before proceeding.

### Step 4: Create Pre-Execution Tag

```bash
git tag -a phase4-pre-execution -m "Phase 4: Pre-execution type safety snapshot (2026-02-08)"
```

This creates an annotated tag (not lightweight) so the tag message, tagger, and date are preserved in git history.

### Step 5: Verify Tag Creation

```bash
git tag -l "phase4-*"
```

**Expected output**: `phase4-pre-execution` listed.

### Step 6: Verify Tag Points to Current HEAD

```bash
# Dereference annotated tag to underlying commit hash
git rev-parse phase4-pre-execution^{}
git rev-parse HEAD
```

**Expected output**: Both commands return identical commit hashes. NOTE: `git rev-parse phase4-pre-execution` without `^{}` returns the tag object hash, not the commit hash -- always use `^{}` for comparison.

### Step 7: Record Baseline Type Safety Metrics

Run each command and record the actual output in the Baseline Metrics Record table (Section 15). These values form the quantitative baseline against which Phase 4 completion will be measured.

---

## 7. Dead Code Baseline

### 7a. Total source file count

```bash
find src/ -name '*.ts' -o -name '*.svelte' | grep -v node_modules | grep -v .svelte-kit | wc -l
```

**Expected**: ~560 files (approximate; exact value recorded at execution time)

### 7b. Dead files identified by audit

**Count**: 104 files totaling 24,088 lines (per dead-code-audit-2026-02-08.md)

**Correction**: 11 files (4,236 lines) are confirmed FALSE POSITIVES (alive via transitive import chains). Actual dead file count: ~93 files. Phase 4.1 addresses ~36 of these.

### 7c. Test route directories (security risk)

```bash
ls -d src/routes/test* src/routes/api/test* 2>/dev/null | wc -l
```

**Expected**: 8 directories

### 7d. Dead barrel files with zero external consumers

```bash
for f in src/lib/services/kismet/index.ts src/lib/services/websocket/index.ts src/lib/services/api/index.ts src/lib/services/index.ts; do
  count=$(grep -rn "from.*$(echo $f | sed 's|src/lib/|\$lib/|' | sed 's|/index.ts||')" src/ --include="*.ts" --include="*.svelte" | grep -v "^${f}:" | wc -l)
  echo "$f: ${count} external consumers"
done
```

**Expected**: All return 0 external consumers.

---

## 8. Type Duplication Baseline

### 8a. Duplicate type name count

**Count**: 37 duplicate names, 89 total definitions, 45 to remove (per TYPE_DUPLICATE_AUDIT.md)

### 8b. Worst offenders

| Type Name        | Copy Count | Source                                                                                      |
| ---------------- | ---------- | ------------------------------------------------------------------------------------------- |
| KismetDevice     | 5          | types/kismet.ts, types/signals.ts, api/kismet.ts, kismet.service.ts, server/kismet/types.ts |
| SpectrumData     | 4          | stores/hackrf.ts, api/hackrf.ts, server/hackrf/types.ts, gnuradio/spectrum_analyzer.ts      |
| SystemInfo       | 3          | system.d.ts, systemStore.ts, api/system.ts                                                  |
| ServiceStatus    | 3          | system.d.ts, stores/connection.ts, api/system.ts                                            |
| NetworkPacket    | 3          | packetAnalysisStore.ts, kismet/types.ts, wireshark.ts                                       |
| NetworkInterface | 3          | system.d.ts, api/system.ts, networkInterfaces.ts                                            |
| KismetStatus     | 3          | types/kismet.ts, api/kismet.ts, server/kismet/types.ts                                      |
| CoralPrediction  | 3          | CoralAccelerator.v2.ts, CoralAccelerator.ts, localization/types.ts                          |

### 8c. Semantic conflicts (same name, different entity)

**Count**: 5 (ToolDefinition, DeviceInfo, ScanResult, Device, HardwareStatus)

### 8d. HackRF/USRP identical copies

```bash
# Check if sweep-manager shared types file exists
test -f src/lib/services/sweep-manager/types.ts && echo EXISTS || echo MISSING
```

**Expected**: MISSING

### 8e. Canonical type barrel

```bash
test -f src/lib/types/index.ts && echo EXISTS || echo MISSING
```

**Expected**: MISSING

---

## 9. `any` Type Baseline

### 9a. Total `any` occurrences

```bash
grep -rn ': any\|as any' --include='*.ts' --include='*.svelte' --exclude-dir=node_modules --exclude-dir=.svelte-kit --exclude='*.d.ts' src/ tests/ | wc -l
```

**Expected**: 214

### 9b. `any` in declaration files

```bash
grep -c ': any\|as any' src/types/leaflet.d.ts
```

**Expected**: 19

### 9c. Unique files containing `any`

```bash
grep -rln ': any\|as any' --include='*.ts' --include='*.svelte' --exclude-dir=node_modules --exclude-dir=.svelte-kit --exclude='*.d.ts' src/ tests/ | wc -l
```

**Expected**: 70

### 9d. `as any` casts specifically

```bash
grep -rn 'as any' --include='*.ts' --include='*.svelte' --exclude-dir=node_modules --exclude-dir=.svelte-kit --exclude='*.d.ts' src/ tests/ | wc -l
```

**Expected**: 30

### 9e. eslint-disable for no-explicit-any

```bash
grep -rn 'eslint-disable.*no-explicit-any' --include='*.ts' --include='*.svelte' --exclude-dir=node_modules --exclude-dir=.svelte-kit src/ | wc -l
```

**Expected**: 8

### 9f. ESLint no-explicit-any rule state

```bash
grep 'no-explicit-any' config/eslint.config.js
```

**Expected**: `'warn'`

---

## 10. Catch Block Baseline

### 10a. Total catch blocks with parameters

```bash
grep -rn 'catch\s*(\s*\w\+' --include='*.ts' --include='*.svelte' src/ | wc -l
```

**Expected**: 676

### 10b. Already typed `: unknown`

```bash
grep -rn 'catch\s*(\s*\w\+\s*:\s*unknown' --include='*.ts' --include='*.svelte' src/ | wc -l
```

**Expected**: 273

### 10c. Parameterless `catch {}`

```bash
grep -rn 'catch\s*{' --include='*.ts' --include='*.svelte' src/ | wc -l
```

**Expected**: 35

### 10d. Typed `: any` catch

```bash
grep -rn 'catch\s*(\s*\w\+\s*:\s*any' --include='*.ts' --include='*.svelte' src/ | wc -l
```

**Expected**: 1

### 10e. Untyped (implicit `any`) catch blocks

Calculation: 676 (total with params) - 273 (already `: unknown`) - 1 (explicit `: any`) = **402 untyped**

### 10f. JSON.parse call sites

```bash
grep -rn 'JSON\.parse' --include='*.ts' --include='*.svelte' --exclude-dir=node_modules --exclude-dir=.svelte-kit src/ | wc -l
```

**Expected**: 49

### 10g. JSON.parse with Zod validation

```bash
grep -rn 'safeParse' --include='*.ts' --include='*.svelte' --exclude-dir=node_modules --exclude-dir=.svelte-kit src/ | wc -l
```

**Expected**: 0

### 10h. Zod schema directory

```bash
test -d src/lib/schemas && echo EXISTS || echo MISSING
```

**Expected**: MISSING

### 10i. errors.ts exported function count

```bash
grep -c 'export function' src/lib/types/errors.ts
```

**Expected**: 10

---

## 11. TypeScript and ESLint Error Baseline

### 11a. svelte-check error count

```bash
npx svelte-check --tsconfig ./tsconfig.json 2>&1 | tail -1
```

**Expected**: `svelte-check found 110 errors and 236 warnings in 74 files`

### 11b. ESLint error count

```bash
npx eslint --config config/eslint.config.js src/ 2>&1 | tail -1
```

**Expected**: `633 problems (36 errors, 597 warnings)`

### 11c. ESLint error breakdown

| Rule                                         | Count | Severity |
| -------------------------------------------- | ----- | -------- |
| `@typescript-eslint/no-explicit-any`         | 285   | warn     |
| `no-console`                                 | 275   | warn     |
| `@typescript-eslint/no-non-null-assertion`   | 37    | warn     |
| `@typescript-eslint/no-unused-vars`          | 26    | error    |
| `no-undef`                                   | 6     | error    |
| `@typescript-eslint/no-unsafe-function-type` | 2     | warn     |
| `no-useless-escape`                          | 1     | error    |
| `no-async-promise-executor`                  | 1     | error    |

---

## 12. Compiler Configuration Baseline

### 12a. TypeScript strict mode

```bash
grep '"strict"' tsconfig.json
```

**Expected**: `"strict": true`

### 12b. Compiler strictness options NOT yet enabled

```bash
for opt in noImplicitReturns noFallthroughCasesInSwitch noUncheckedIndexedAccess noImplicitOverride; do
  grep "$opt" tsconfig.json > /dev/null 2>&1 && echo "$opt: FOUND" || echo "$opt: NOT SET"
done
```

**Expected**: All 4 return `NOT SET`

### 12c. ESLint type-checked linting status

```bash
grep "project:" config/eslint.config.js
```

**Expected**: `project: false`

### 12d. knip installation status

```bash
npm ls knip 2>&1 | grep knip || echo "NOT INSTALLED"
```

**Expected**: `NOT INSTALLED`

---

## 13. Build Health Baseline

### 13a. TypeScript compilation

```bash
npm run typecheck 2>&1 | tail -5
```

**Expected**: Exit 0

### 13b. Production build

```bash
npm run build 2>&1 | tail -5
```

**Expected**: Exit 0

### 13c. Unit tests

```bash
npm run test:unit 2>&1 | tail -10
```

**Expected**: Exit 0

### 13d. Lint check

```bash
npm run lint 2>&1 | tail -5
```

**Expected**: Exit 0 (warnings acceptable for warn-level rules)

---

## 14. Supplementary Baselines

### 14a. Total TypeScript/Svelte line count

```bash
find src/ -name '*.ts' -o -name '*.svelte' | grep -v node_modules | grep -v .svelte-kit | xargs wc -l | tail -1
```

**Expected**: ~124,000 lines (approximate; exact value recorded at execution time)

### 14b. Zod installation status

```bash
npm ls zod 2>&1 | grep zod
```

**Expected**: zod@3.25.76 (installed but nearly unused)

### 14c. Zod import count in API routes

```bash
grep -rl "z\.\|zod" src/routes/api/ --include="*.ts" | wc -l
```

**Expected**: 0-1

### 14d. @types/leaflet installation

```bash
npm ls @types/leaflet 2>&1 | grep leaflet
```

**Expected**: @types/leaflet@1.9.20

### 14e. Custom leaflet.d.ts existence

```bash
wc -l src/types/leaflet.d.ts 2>/dev/null || echo "NOT FOUND"
```

**Expected**: 166 lines

### 14f. Stash state

```bash
git stash list > /tmp/phase4-stash-snapshot.txt
```

Records any stashed changes so they are not lost during Phase 4 operations.

---

## 15. Baseline Metrics Record

Record actual values at execution time. These MUST be filled in by the executing agent before any Phase 4 modifications begin. Values marked "Expected" are from audit data (2026-02-08) and may differ if Phases 0-3 have modified the codebase since the audit date.

### Dead Code Metrics

| Metric                               | Expected | Actual | Delta | Notes |
| ------------------------------------ | -------- | ------ | ----- | ----- |
| Total source files (_.ts + _.svelte) | ~560     | --     | --    |       |
| Test route directories               | 8        | --     | --    |       |
| Dead barrel files (0 consumers)      | 4        | --     | --    |       |

### Type Duplication Metrics

| Metric                           | Expected | Actual | Delta | Notes |
| -------------------------------- | -------- | ------ | ----- | ----- |
| Duplicate type names             | 37       | --     | --    |       |
| Total duplicate definitions      | 89       | --     | --    |       |
| Semantic conflicts               | 5        | --     | --    |       |
| Sweep-manager shared types exist | No       | --     | --    |       |
| Canonical type barrel exists     | No       | --     | --    |       |

### `any` Type Metrics

| Metric                           | Expected | Actual | Delta | Notes |
| -------------------------------- | -------- | ------ | ----- | ----- |
| Total `any` occurrences (active) | 214      | --     | --    |       |
| `any` in leaflet.d.ts            | 19       | --     | --    |       |
| Unique files with `any`          | 70       | --     | --    |       |
| `as any` casts                   | 30       | --     | --    |       |
| eslint-disable no-explicit-any   | 8        | --     | --    |       |
| ESLint rule state                | warn     | --     | --    |       |

### Catch Block Metrics

| Metric                    | Expected | Actual | Delta | Notes |
| ------------------------- | -------- | ------ | ----- | ----- |
| Catch blocks with params  | 676      | --     | --    |       |
| Already typed `: unknown` | 273      | --     | --    |       |
| Parameterless `catch {}`  | 35       | --     | --    |       |
| Explicit `: any` catch    | 1        | --     | --    |       |
| Untyped (implicit)        | 402      | --     | --    |       |
| JSON.parse call sites     | 49       | --     | --    |       |
| JSON.parse with Zod       | 0        | --     | --    |       |
| errors.ts exports         | 10       | --     | --    |       |

### TypeScript and ESLint Error Metrics

| Metric                   | Expected | Actual | Delta | Notes |
| ------------------------ | -------- | ------ | ----- | ----- |
| svelte-check errors      | 110      | --     | --    |       |
| svelte-check warnings    | 236      | --     | --    |       |
| ESLint errors            | 36       | --     | --    |       |
| ESLint warnings          | 597      | --     | --    |       |
| no-explicit-any warnings | 285      | --     | --    |       |
| no-console warnings      | 275      | --     | --    |       |

### Compiler Configuration Metrics

| Metric                        | Expected | Actual | Delta | Notes |
| ----------------------------- | -------- | ------ | ----- | ----- |
| strict mode                   | true     | --     | --    |       |
| noImplicitReturns             | NOT SET  | --     | --    |       |
| noFallthroughCasesInSwitch    | NOT SET  | --     | --    |       |
| noUncheckedIndexedAccess      | NOT SET  | --     | --    |       |
| noImplicitOverride            | NOT SET  | --     | --    |       |
| ESLint project (type-checked) | false    | --     | --    |       |
| knip installed                | No       | --     | --    |       |

### Build Health

| Metric              | Expected | Actual | Notes               |
| ------------------- | -------- | ------ | ------------------- |
| typecheck exit code | 0        | --     | `npm run typecheck` |
| build exit code     | 0        | --     | `npm run build`     |
| test:unit exit code | 0        | --     | `npm run test:unit` |
| lint exit code      | 0        | --     | `npm run lint`      |

### Supplementary

| Metric                     | Expected | Actual | Notes |
| -------------------------- | -------- | ------ | ----- |
| Total TS/Svelte line count | ~124,000 | --     |       |
| Zod version                | 3.25.76  | --     |       |
| Zod usage in API routes    | 0-1      | --     |       |
| @types/leaflet version     | 1.9.20   | --     |       |
| Custom leaflet.d.ts lines  | 166      | --     |       |

---

## 16. Verification Checklist

| #   | Check                             | Command                                                         | Expected                           | Pass/Fail |
| --- | --------------------------------- | --------------------------------------------------------------- | ---------------------------------- | --------- |
| 1   | Tag exists                        | `git tag -l "phase4-*"`                                         | `phase4-pre-execution` listed      |           |
| 2   | Tag points to HEAD                | `git rev-parse phase4-pre-execution^{}` == `git rev-parse HEAD` | Identical hashes                   |           |
| 3   | Tag is annotated                  | `git cat-file -t phase4-pre-execution`                          | `tag` (not `commit`)               |           |
| 4   | Dead code metrics recorded        | Baseline Metrics table populated                                | All "Actual" cells filled          |           |
| 5   | Type duplication metrics recorded | Baseline Metrics table populated                                | All "Actual" cells filled          |           |
| 6   | `any` type metrics recorded       | Baseline Metrics table populated                                | All "Actual" cells filled          |           |
| 7   | Catch block metrics recorded      | Baseline Metrics table populated                                | All "Actual" cells filled          |           |
| 8   | TS/ESLint error metrics recorded  | Baseline Metrics table populated                                | All "Actual" cells filled          |           |
| 9   | Compiler config metrics recorded  | Baseline Metrics table populated                                | All "Actual" cells filled          |           |
| 10  | Build health recorded             | Baseline Metrics table populated                                | All exit codes = 0                 |           |
| 11  | Supplementary metrics recorded    | Baseline Metrics table populated                                | All "Actual" cells filled          |           |
| 12  | Stash snapshot saved              | `test -f /tmp/phase4-stash-snapshot.txt && echo EXISTS`         | EXISTS                             |           |
| 13  | Working tree clean                | `git status --short`                                            | Empty or only untracked plan files |           |

---

## 17. Rollback Procedure

### Remove this tag (if created in error)

```bash
git tag -d phase4-pre-execution
```

### Full Phase 4 Rollback (using this tag)

At any point during Phase 4 execution, if a catastrophic regression is discovered:

```bash
git reset --hard phase4-pre-execution && npm install
```

This destroys all Phase 4 commits and restores `node_modules` to the pre-execution state. Deleted files (dead code, leaflet.d.ts, test routes), new files (sweep-manager/types.ts, types/index.ts, schemas/), and configuration changes (tsconfig.json, eslint.config.js) are all restored to their pre-Phase-4 state by this command.

**WARNING**: This rollback also destroys any Phase 4.5 compiler strictness options that were enabled. After rollback, the codebase returns to the permissive compiler/linter state. Re-enabling strictness requires re-running all Phase 4.1-4.4 work first.

---

## 18. Completion Criteria

- [ ] Annotated tag `phase4-pre-execution` exists
- [ ] Tag points to current HEAD (verified with `^{}` dereference)
- [ ] Tag message includes date stamp
- [ ] All baseline metrics recorded in Section 15 (all "Actual" cells filled, no blanks)
- [ ] Stash snapshot saved to `/tmp/phase4-stash-snapshot.txt`
- [ ] Clean working tree confirmed
- [ ] All 13 verification checklist items pass

---

## 19. Execution Tracking

| Task  | Status  | Started | Completed | Verified By | Notes |
| ----- | ------- | ------- | --------- | ----------- | ----- |
| 4.0.1 | PENDING | --      | --        | --          | --    |

---

**Document End**
