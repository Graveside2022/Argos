# Phase 3: Code Quality, Constants, Linting, and Defensive Coding -- Master Index

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: NASA/JPL Rules 5, 14, 20, 31; CERT ERR00-C, INT09-C; MISRA Rules 3.1, 7.1, 21.8; BARR-C Rules 1.7, 8.1, 8.4, 8.7
**Review Panel**: US Cyber Command Engineering Review Board

---

## 1. Phase Overview

### Purpose

Phase 3 eliminates all unstructured console output, centralizes magic numbers into named constants, enforces ESLint discipline, and establishes runtime assertions and input validation. This phase transforms the codebase from an ad-hoc debugging state into an auditable, standards-compliant foundation suitable for DoD deployment review.

### Scope

| Dimension                           | Value                                                     |
| ----------------------------------- | --------------------------------------------------------- |
| Total sub-task files                | 33                                                        |
| Estimated files to modify           | ~170+                                                     |
| console.\* statements to migrate    | ~690 (717 active - excluded/deleted)                      |
| Magic numbers to centralize         | ~393 (corrected 2026-02-08)                               |
| Catch blocks to normalize           | 478 unused-variable + 68 promise-chain + 35 parameterless |
| Commented-out code blocks to remove | 48 (~173 lines)                                           |
| TODO markers to resolve             | 15                                                        |
| eslint-disable comments to audit    | 18                                                        |
| API routes needing Zod validation   | 10 (highest-risk)                                         |
| parseInt/parseFloat needing guards  | 96                                                        |
| Unsafe error casts to fix           | ~40                                                       |

### Risk Level

**LOW-MEDIUM overall.** Phase 3.1 and 3.2 are mechanical replacements with no behavior changes. Phase 3.3 is configuration and comment-level work. Phase 3.4 introduces assertions and validation that may reject previously-accepted invalid input -- this is the intended outcome for a SIGINT system, but represents the highest risk within this phase.

### Prerequisites

| Prerequisite                | Status   | Rationale                                                                          |
| --------------------------- | -------- | ---------------------------------------------------------------------------------- |
| Phase 0 (Code Organization) | REQUIRED | File structure must be stable before mass modifications                            |
| Phase 1 (Zero-Risk Cleanup) | REQUIRED | Dead code must be removed before console.\* migration to avoid migrating dead code |

### Blocks

| Blocked Phase                        | Reason                                                                      |
| ------------------------------------ | --------------------------------------------------------------------------- |
| Phase 4 (Type Safety)                | Type-safe error handling depends on structured logger and assertion utility |
| Phase 5 (Architecture Decomposition) | Function complexity thresholds depend on ESLint enforcement                 |

### Standards Traceability

| Standard         | Rule                                     | Phase 3 Sub-Tasks Addressing It          |
| ---------------- | ---------------------------------------- | ---------------------------------------- |
| NASA/JPL Rule 5  | Use runtime assertions                   | 3.4.0, 3.4.1                             |
| NASA/JPL Rule 14 | Check return values                      | 3.1.0 (Defect 4), 3.4.4, 3.4.5           |
| NASA/JPL Rule 20 | Named constants for all literals         | 3.2.0 through 3.2.7                      |
| NASA/JPL Rule 31 | No dead code                             | 3.1.1, 3.3.3, 3.3.4                      |
| CERT ERR00-C     | Consistent error handling                | 3.1.0 through 3.1.8, 3.3.1, 3.3.2, 3.4.5 |
| CERT INT09-C     | Define numeric constants                 | 3.2.0 through 3.2.7, 3.4.4               |
| MISRA Rule 3.1   | No commented-out code                    | 3.1.1, 3.3.3                             |
| MISRA Rule 7.1   | Octal/hex constants defined              | 3.2.0                                    |
| MISRA Rule 21.8  | No undefined behavior from invalid input | 3.4.3, 3.4.4                             |
| BARR-C Rule 1.7  | Resolve all warnings                     | 3.3.0, 3.3.5, 3.3.6                      |
| BARR-C Rule 8.1  | No magic numbers                         | 3.2.0 through 3.2.7                      |
| BARR-C Rule 8.4  | Validate all external input              | 3.4.3, 3.4.4, 3.4.5                      |
| BARR-C Rule 8.7  | No side effects in debug code            | 3.1.0 (Defect 2), 3.1.3 through 3.1.7    |

---

## 2. Execution Order -- Dependency Graph

```
                           START
                             |
                             v
                     [ 3.0.1 Pre-Execution ]
                     [ Code Quality Snapshot ]
                             |
              +--------------+--------------+
              |                             |
              v                             |
      [ 3.1.0 Logger ]                     |
      [ Infra Defect ]                     |
      [ Repair (6 bugs) ]                  |
              |                             |
              v                             |
      [ 3.1.1 Delete 35 ]                  |
      [ Commented-Out ]                    |
      [ Console Lines ]                    |
              |                             |
              v                             |
      [ 3.1.2 Complete ]                   |
      [ 5 Partial ]                        |
      [ Migrations ]                       |
              |                             |
     +--------+--------+                   |
     |        |        |                   |
     v        v        v                   |
  [3.1.3] [3.1.4] [3.1.5]                 |
  Batch 1  Batch 2  Batch 3               |
  Server   API      Services              |
  34 files 75 files 23 files              |
     |        |        |                   |
     +--------+--------+                   |
              |                            |
     +--------+--------+                   |
     |                 |                   |
     v                 v                   |
  [3.1.6]          [3.1.7]                |
  Batch 4+5        Batch 6+7              |
  Stores+Comp      Pages+Remaining        |
  18 files         16 files               |
     |                 |                   |
     +--------+--------+                   |
              |                            |
              v                            |
      [ 3.1.8 ESLint ]                    |
      [ no-console ]                      |
      [ warn -> error ]                   |
              |                            |
              +----------------------------+
              |
              v
      [ 3.2.0 Constants ]
      [ Infrastructure ]
      [ Extension ]
              |
              v
      [ 3.2.1 Port Numbers ]-----(98 occurrences)
              |
              v
      [ 3.2.2 Timeouts ]---------(104 occurrences)
              |
              v
      [ 3.2.3 RF Frequencies ]---(80+ occurrences)
              |
              v
      [ 3.2.4 Database Config ]-(~25 occurrences)
              |
              v
      [ 3.2.5 Buffer/Retention ]-(27 occurrences)
              |
              v
      [ 3.2.6 File Paths ]-------(25 occurrences)
              |
              v
      [ 3.2.7 IP Addresses ]-----(67 occurrences)
              |
              v
      [ 3.3.0 Lint-Staged ]
      [ Verification ]
              |
     +--------+--------+
     |                 |
     v                 v
  [3.3.1]          [3.3.2]          <-- PARALLEL
  Catch Block      Promise Chain
  Hygiene          Silent-Swallow
  (478 vars)       Fix (68 inst.)
     |                 |
     +--------+--------+
              |
              v
      [ 3.3.3 Commented-Out ]
      [ Code Removal ]
      [ (48 blocks) ]
              |
              v
      [ 3.3.4 TODO/FIXME ]
      [ Resolution (15) ]
              |
              v
      [ 3.3.5 eslint-disable ]
      [ Audit (18 comments) ]
              |
              v
      [ 3.3.6 ESLint Rule ]
      [ Additions + String ]
      [ Concat Fix (~52) ]
              |
              v
      [ 3.3.7 WORKAROUND ]
      [ Documentation (1) ]
              |
              v
      +--------------+
      |              |
      v              |
  [ 3.4.0 Assert ]  |
  [ Utility ]       |
  [ Creation ]      |
      |              |
      v              |
  [ 3.4.1 Critical ]|    <-- 3.4.1 also depends on 3.2.0
  [ Function ]      |        (uses named constants for bounds)
  [ Assertions ]    |
      |              |
      v              |
  [ 3.4.2 Logging ] |
  [ Level Policy ]  |
  [ PII Handling ]  |
      |              |
      v              |
  [ 3.4.3 Zod ]     |
  [ Schema for ]    |
  [ 10 Routes ]     |
      |              |
      v              |
  [ 3.4.4 parseInt ] |
  [ NaN Guards ]     |
  [ (96 calls) ]     |
      |              |
      v              |
  [ 3.4.5 Unsafe ]  |
  [ Error Cast ]    |
  [ Fix (~40) ]     |
      |              |
      +--------------+
              |
              v
      PHASE 3 COMPLETE
```

### Dependency Summary (Textual)

| Task         | Depends On                | Rationale                                                                      |
| ------------ | ------------------------- | ------------------------------------------------------------------------------ |
| 3.0.1        | Phase 0, Phase 1 complete | Stable codebase for snapshot                                                   |
| 3.1.0        | 3.0.1                     | Must fix logger before migration                                               |
| 3.1.1        | 3.1.0                     | Delete dead console lines before live migration                                |
| 3.1.2        | 3.1.1                     | Fix incomplete migrations before batch work                                    |
| 3.1.3-3.1.5  | 3.1.2                     | Batch migration depends on clean baseline; batches may run in parallel         |
| 3.1.6-3.1.7  | 3.1.3-3.1.5               | Second wave batches after server/API/services complete                         |
| 3.1.8        | 3.1.7                     | All migrations must be complete before escalating to error                     |
| 3.2.0        | 3.1.8                     | Constants infrastructure after logger migration                                |
| 3.2.1-3.2.7  | 3.2.0                     | Each replacement batch depends on constants being defined; strictly sequential |
| 3.3.0        | 3.2.7                     | ESLint work begins after constants are centralized                             |
| 3.3.1, 3.3.2 | 3.3.0                     | Catch hygiene may run in parallel after lint-staged verified                   |
| 3.3.3        | 3.3.1, 3.3.2              | Commented code removal after error hygiene                                     |
| 3.3.4-3.3.7  | 3.3.3                     | Sequential: TODO, eslint-disable, rules, workaround doc                        |
| 3.4.0        | 3.1.0                     | Assert utility uses structured logger                                          |
| 3.4.1        | 3.4.0, 3.2.0              | Assertions use named constants for range bounds                                |
| 3.4.2-3.4.5  | 3.4.1                     | Sequential defensive coding tasks                                              |

---

## 3. Complete File Inventory

### Phase 3.0 -- Pre-Execution

| #   | File Name                                            | Scope                             | Est. Files Touched | Risk Level | Dependencies       |
| --- | ---------------------------------------------------- | --------------------------------- | ------------------ | ---------- | ------------------ |
| 1   | `Phase-3.0.1-Pre-Execution-Code-Quality-Snapshot.md` | Baseline metrics capture, git tag | 0                  | ZERO       | Phase 0+1 complete |

### Phase 3.1 -- Logger Infrastructure and Migration (9 files)

| #   | File Name                                               | Scope                                                                                                  | Est. Files Touched | Risk Level | Dependencies |
| --- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------ | ---------- | ------------ |
| 2   | `Phase-3.1.0-Logger-Infrastructure-Defect-Repair.md`    | Fix 6 logger.ts defects (HMR leak, level routing, counter, configureLogging, dispose, buffer ordering) | 2                  | LOW        | 3.0.1        |
| 3   | `Phase-3.1.1-Commented-Console-Statement-Deletion.md`   | Delete 35 commented-out console.\* lines across 7 files                                                | 7                  | ZERO       | 3.1.0        |
| 4   | `Phase-3.1.2-Incomplete-Logger-Migration-Completion.md` | Complete 5 partially-migrated files (22 statements)                                                    | 5                  | LOW        | 3.1.1        |
| 5   | `Phase-3.1.3-Batch-Migration-Server-Core.md`            | Batch 1: src/lib/server/ (34 files, ~192 statements)                                                   | 34                 | LOW        | 3.1.2        |
| 6   | `Phase-3.1.4-Batch-Migration-API-Routes.md`             | Batch 2: src/routes/api/ (75 files, ~225 statements)                                                   | 75                 | LOW        | 3.1.2        |
| 7   | `Phase-3.1.5-Batch-Migration-Services.md`               | Batch 3: src/lib/services/ (23 files, ~124 statements)                                                 | 23                 | LOW        | 3.1.2        |
| 8   | `Phase-3.1.6-Batch-Migration-Stores-Components.md`      | Batch 4+5: stores (4 files, 10 stmts) + components (14 files, 46 stmts)                                | 18                 | LOW        | 3.1.3-3.1.5  |
| 9   | `Phase-3.1.7-Batch-Migration-Pages-Remaining.md`        | Batch 6+7: pages (15 files, 107 stmts) + remaining (1 file, 1 stmt)                                    | 16                 | LOW        | 3.1.3-3.1.5  |
| 10  | `Phase-3.1.8-ESLint-No-Console-Escalation.md`           | Escalate no-console from warn to error, zero exemptions                                                | 1                  | LOW        | 3.1.7        |

### Phase 3.2 -- Constants Centralization (8 files)

| #   | File Name                                               | Scope                                                                                                                | Est. Files Touched | Risk Level | Dependencies |
| --- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------ | ---------- | ------------ |
| 11  | `Phase-3.2.0-Constants-Infrastructure-Extension.md`     | Extend limits.ts with RF_BANDS, SERVICE_URLS, BUFFER_LIMITS, RETENTION, DB_CONFIG, SECURITY_THRESHOLDS, RETRY_LIMITS | 1                  | LOW        | 3.1.8        |
| 12  | `Phase-3.2.1-Hardcoded-Port-Number-Replacement.md`      | Replace 98 hardcoded port literals across 27+ files (corrected 2026-02-08; was 73)                                   | 27                 | LOW-MEDIUM | 3.2.0        |
| 13  | `Phase-3.2.2-Hardcoded-Timeout-Interval-Replacement.md` | Replace 104 timeout/interval literals (69 setTimeout, 23 setInterval, 12 AbortSignal) (corrected 2026-02-08; was 91) | 40                 | LOW-MEDIUM | 3.2.1        |
| 14  | `Phase-3.2.3-Hardcoded-RF-Frequency-Replacement.md`     | Replace 80+ RF frequency literals across 23 files                                                                    | 23                 | LOW-MEDIUM | 3.2.2        |
| 15  | `Phase-3.2.4-Hardcoded-Database-Config-Replacement.md`  | Replace ~25 database config values across 3 files                                                                    | 3                  | LOW        | 3.2.3        |
| 16  | `Phase-3.2.5-Hardcoded-Buffer-Retention-Replacement.md` | Replace 27 buffer/capacity/retention limits across 10+ files                                                         | 10                 | LOW        | 3.2.4        |
| 17  | `Phase-3.2.6-Hardcoded-File-Path-Centralization.md`     | Centralize 25 hardcoded /home/ paths across 15 files (corrected 2026-02-08; was 18 across 12)                        | 15                 | LOW-MEDIUM | 3.2.5        |
| 18  | `Phase-3.2.7-Hardcoded-IP-Address-Centralization.md`    | Centralize 67 IP/localhost references (corrected 2026-02-08; was 53)                                                 | 20                 | LOW        | 3.2.6        |

### Phase 3.3 -- ESLint Enforcement and Error Hygiene (8 files)

| #   | File Name                                                   | Scope                                                                                                                          | Est. Files Touched | Risk Level | Dependencies |
| --- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------ | ---------- | ------------ |
| 19  | `Phase-3.3.0-Lint-Staged-Verification.md`                   | Verify pre-commit hook functionality (no code change)                                                                          | 0                  | ZERO       | 3.2.7        |
| 20  | `Phase-3.3.1-Error-Variable-Catch-Block-Hygiene.md`         | Normalize 478 unused catch variables + 35 parameterless catch blocks                                                           | ~60                | LOW        | 3.3.0        |
| 21  | `Phase-3.3.2-Promise-Chain-Silent-Swallowing-Fix.md`        | Fix 68 `.catch(() => {})` instances across 23 files                                                                            | 23                 | LOW-MEDIUM | 3.3.0        |
| 22  | `Phase-3.3.3-Commented-Out-Code-Removal.md`                 | Remove 48 commented-out code blocks (~173 lines) across 30 files                                                               | 30                 | ZERO       | 3.3.1, 3.3.2 |
| 23  | `Phase-3.3.4-TODO-FIXME-Resolution.md`                      | Resolve 15 TODO markers (implement 3, file 9 issues, delete 2 conditional, document 1)                                         | 11                 | LOW        | 3.3.3        |
| 24  | `Phase-3.3.5-ESLint-Disable-Audit.md`                       | Audit 18 eslint-disable comments (eliminate 12, keep 4 legitimate, investigate 2)                                              | 8                  | LOW        | 3.3.4        |
| 25  | `Phase-3.3.6-ESLint-Rule-Additions-String-Concatenation.md` | Add no-magic-numbers, prefer-template, complexity, max-depth, naming-convention rules; fix ~52 string concatenation violations | 52                 | LOW        | 3.3.5        |
| 26  | `Phase-3.3.7-WORKAROUND-Comment-Documentation.md`           | Document 1 architectural workaround with rationale                                                                             | 1                  | ZERO       | 3.3.6        |

### Phase 3.4 -- Defensive Coding Foundations (6 files)

| #   | File Name                                                | Scope                                                                                | Est. Files Touched | Risk Level | Dependencies |
| --- | -------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------ | ---------- | ------------ |
| 27  | `Phase-3.4.0-Runtime-Assertion-Utility-Creation.md`      | Create assert.ts with assert, assertDefined, assertRange, assertFiniteNumber         | 1 (new)            | LOW        | 3.1.0        |
| 28  | `Phase-3.4.1-Critical-Function-Assertion-Integration.md` | Add assertions to geo, sweep, signal processing functions                            | 8                  | LOW-MEDIUM | 3.4.0, 3.2.0 |
| 29  | `Phase-3.4.2-Logging-Level-Policy-PII-Handling.md`       | Create LOGGING-POLICY.md for DoD compliance (PII, IMSI, MAC, GPS rules)              | 1 (new)            | ZERO       | 3.4.1        |
| 30  | `Phase-3.4.3-Zod-Schema-Validation-High-Risk-Routes.md`  | Add Zod validation to 10 highest-risk API routes (hardware control + sensitive data) | 10                 | LOW-MEDIUM | 3.4.2        |
| 31  | `Phase-3.4.4-ParseInt-ParseFloat-NaN-Guard-Addition.md`  | Guard 96 unguarded parseInt/parseFloat calls across 46 files; enforce radix 10       | 46                 | LOW        | 3.4.3        |
| 32  | `Phase-3.4.5-Unsafe-Error-Cast-Pattern-Fix.md`           | Fix ~40 `(error as Error).message` casts with instanceof checks                      | 40                 | LOW        | 3.4.4        |

### Verification (Existing)

| #   | File Name                         | Scope                          | Purpose                                                                                         |
| --- | --------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------- |
| 33  | `PHASE-3.2-VERIFICATION-AUDIT.md` | Constants centralization audit | Adversarial verification of Phase 3.2 metrics; corrections integrated into file inventory above |

---

## 4. Aggregate Metrics

| Metric                   | Phase 3.1 | Phase 3.2  | Phase 3.3  | Phase 3.4  | Total                          |
| ------------------------ | --------- | ---------- | ---------- | ---------- | ------------------------------ |
| Sub-task files           | 9         | 8          | 8          | 6          | 31 + 1 pre-exec + 1 audit = 33 |
| Estimated files modified | 172       | ~90        | ~85        | ~60        | ~170+ (overlap across phases)  |
| Git commits produced     | 10        | 8          | 9          | 6          | 33                             |
| Risk level (highest)     | LOW       | LOW-MEDIUM | LOW-MEDIUM | LOW-MEDIUM | LOW-MEDIUM                     |

### Quantified Work Items

| Category                                   | Count                                                                                                                  | Source Phase |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | ------------ |
| console.\* statements to migrate           | ~690                                                                                                                   | 3.1          |
| Commented-out console.\* to delete         | 35                                                                                                                     | 3.1          |
| Logger defects to fix                      | 6                                                                                                                      | 3.1          |
| Dead config file to delete (logging.ts)    | 1                                                                                                                      | 3.1          |
| Hardcoded port literals to replace         | 98 (corrected)                                                                                                         | 3.2          |
| Hardcoded timeout/interval literals        | 104 (corrected)                                                                                                        | 3.2          |
| Hardcoded RF frequency literals            | 80+                                                                                                                    | 3.2          |
| Hardcoded database config values           | ~25                                                                                                                    | 3.2          |
| Hardcoded buffer/capacity/retention limits | 27                                                                                                                     | 3.2          |
| Hardcoded file paths (/home/)              | 25 (corrected)                                                                                                         | 3.2          |
| Hardcoded IP/localhost references          | 67 (corrected)                                                                                                         | 3.2          |
| New constant groups to define              | 7 (RF_BANDS, SERVICE_URLS, BUFFER_LIMITS, RETRY_LIMITS, RETENTION, DB_CONFIG, SECURITY_THRESHOLDS)                     | 3.2          |
| New PATHS module to create                 | 1 (paths.ts)                                                                                                           | 3.2          |
| Unused catch variables to normalize        | 478                                                                                                                    | 3.3          |
| Parameterless catch blocks                 | 35                                                                                                                     | 3.3          |
| Silent `.catch(() => {})` to fix           | 68                                                                                                                     | 3.3          |
| Commented-out code blocks to remove        | 48 (~173 lines)                                                                                                        | 3.3          |
| TODO markers to resolve                    | 15                                                                                                                     | 3.3          |
| eslint-disable comments to audit           | 18 (eliminate 12, keep 4-5 legitimate)                                                                                 | 3.3          |
| String concatenation violations to fix     | ~52                                                                                                                    | 3.3          |
| New ESLint rules to add                    | 7 (no-magic-numbers, prefer-template, complexity, max-depth, no-unreachable, no-constant-condition, naming-convention) | 3.3          |
| WORKAROUND comments to document            | 1                                                                                                                      | 3.3          |
| Runtime assertion utility to create        | 1 (assert.ts)                                                                                                          | 3.4          |
| Critical functions to add assertions       | 8+ (geo, sweep, signal)                                                                                                | 3.4          |
| Logging policy document to create          | 1 (LOGGING-POLICY.md)                                                                                                  | 3.4          |
| API routes to add Zod validation           | 10                                                                                                                     | 3.4          |
| Unguarded parseInt/parseFloat to fix       | 96 of 126                                                                                                              | 3.4          |
| Unsafe (error as Error).message to fix     | ~40                                                                                                                    | 3.4          |

---

## 5. Standards Compliance Mapping

### NASA/JPL Power of Ten Rules

| Rule    | Description                                                                                         | Addressed By                                                                                                                 |
| ------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Rule 5  | Use a minimum of two runtime assertions per function                                                | 3.4.0 (create assert utility), 3.4.1 (integrate into critical functions)                                                     |
| Rule 14 | Check the return value of all non-void functions, or cast to void to indicate intentional disregard | 3.1.0 (fix configureLogging dead call), 3.4.4 (parseInt/parseFloat NaN guards), 3.4.5 (error cast safety)                    |
| Rule 20 | All compiler and analyzer warnings shall be resolved; use named constants for all numeric literals  | 3.2.0-3.2.7 (named constants), 3.3.6 (no-magic-numbers rule)                                                                 |
| Rule 31 | No dead code (unreachable code, unused variables, commented-out code)                               | 3.1.1 (commented console.\* deletion), 3.3.3 (commented code removal), 3.3.4 (TODO resolution), 3.3.5 (eslint-disable audit) |

### CERT C Secure Coding Standard

| Rule    | Description                                                              | Addressed By                                                                                                            |
| ------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| ERR00-C | Adopt and implement a consistent and comprehensive error-handling policy | 3.1.0-3.1.8 (structured logger), 3.3.1 (catch variable hygiene), 3.3.2 (promise chain handling), 3.4.5 (error cast fix) |
| INT09-C | Ensure enumeration constants map to unique values; use named constants   | 3.2.0 (constants infrastructure), 3.4.4 (radix 10 enforcement)                                                          |

### MISRA C:2012

| Rule      | Description                                                                                                                 | Addressed By                                                        |
| --------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Rule 3.1  | No commented-out code shall remain                                                                                          | 3.1.1 (commented console.\*), 3.3.3 (all commented-out code blocks) |
| Rule 7.1  | Octal and hexadecimal constants shall be defined                                                                            | 3.2.0 (RF_BANDS, DB_CONFIG with named hex/decimal constants)        |
| Rule 21.8 | The library functions abort, exit, getenv, and system shall not be used (adapted: no undefined behavior from invalid input) | 3.4.3 (Zod validation), 3.4.4 (NaN guards)                          |

### BARR-C:2018

| Rule     | Description                                                                            | Addressed By                                                                                 |
| -------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Rule 1.7 | All compiler and static analyzer warnings shall be resolved                            | 3.3.0 (lint-staged verification), 3.3.5 (eslint-disable audit), 3.3.6 (new ESLint rules)     |
| Rule 8.1 | No magic numbers: numeric constants other than 0 and 1 shall be given meaningful names | 3.2.0-3.2.7 (centralization), 3.3.6 (no-magic-numbers ESLint rule)                           |
| Rule 8.4 | All external input shall be validated before use                                       | 3.4.3 (Zod schemas), 3.4.4 (parseInt guards), 3.4.1 (range assertions)                       |
| Rule 8.7 | No side effects in debug/diagnostic code                                               | 3.1.0 (fix level routing), 3.1.3-3.1.7 (eliminate unstructured console.\* with side effects) |

---

## 6. Phase 3 Exit Criteria

Phase 3 is complete when ALL of the following verification checks pass with zero failures. Every check includes its verification command and expected output.

### Phase 3.1 Exit Criteria (Logger Migration Complete)

| #   | Check                                | Command                                                                                                                                      | Expected                                 |
| --- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| 1   | Logger uses globalThis singleton     | `grep -n "globalThis" src/lib/utils/logger.ts \| wc -l`                                                                                      | >= 2                                     |
| 2   | Logger routes INFO to console.log    | `grep -n "console\.log" src/lib/utils/logger.ts \| wc -l`                                                                                    | 1                                        |
| 3   | Logger routes DEBUG to console.debug | `grep -n "console\.debug" src/lib/utils/logger.ts \| wc -l`                                                                                  | 1                                        |
| 4   | No console.\* in server code         | `grep -rn "console\.\(log\|warn\|error\|info\|debug\|trace\)" src/lib/server/ --include="*.ts" \| grep -v logger.ts \| wc -l`                | 0                                        |
| 5   | No console.\* in API routes          | `grep -rn "console\.\(log\|warn\|error\|info\|debug\|trace\)" src/routes/api/ --include="*.ts" \| wc -l`                                     | 0                                        |
| 6   | No console.\* in services            | `grep -rn "console\.\(log\|warn\|error\|info\|debug\|trace\)" src/lib/services/ --include="*.ts" \| wc -l`                                   | 0                                        |
| 7   | No console.\* in stores              | `grep -rn "console\.\(log\|warn\|error\|info\|debug\|trace\)" src/lib/stores/ --include="*.ts" \| wc -l`                                     | 0                                        |
| 8   | No console.\* in components          | `grep -rn "console\.\(log\|warn\|error\|info\|debug\|trace\)" src/lib/components/ --include="*.ts" --include="*.svelte" \| wc -l`            | 0                                        |
| 9   | No console.\* in pages               | `grep -rn "console\.\(log\|warn\|error\|info\|debug\|trace\)" src/routes/ --include="*.svelte" --include="*.ts" \| grep -v "/api/" \| wc -l` | 0                                        |
| 10  | No commented-out console.\*          | `grep -rn --include="*.ts" --include="*.svelte" -E '^\s*//' src/ \| grep -E 'console\.(log\|warn\|error\|info\|debug\|trace)' \| wc -l`      | 0                                        |
| 11  | ESLint no-console is error           | `grep "no-console" config/eslint.config.js`                                                                                                  | `'no-console': ['error', { allow: [] }]` |
| 12  | logging.ts deleted                   | `test -f src/lib/config/logging.ts && echo EXISTS \|\| echo DELETED`                                                                         | DELETED                                  |
| 13  | TypeScript compiles                  | `npm run typecheck`                                                                                                                          | Exit 0                                   |
| 14  | Build succeeds                       | `npm run build`                                                                                                                              | Exit 0                                   |
| 15  | Lint passes (no-console)             | `npm run lint 2>&1 \| grep "no-console" \| wc -l`                                                                                            | 0                                        |

### Phase 3.2 Exit Criteria (Constants Centralized)

| #   | Check                             | Command                                                                                                                                                              | Expected              |
| --- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| 16  | No hardcoded port literals        | `grep -Prn '\b(2501\|8092\|3002\|8073\|11434\|8081\|8080\|4729\|2947\|8088\|8002\|3001)\b' src/ --include="*.ts" --include="*.svelte" \| grep -v limits.ts \| wc -l` | 0                     |
| 17  | No raw timeout in setTimeout      | `grep -Prn '(setTimeout\|setInterval)\([^,]+,\s*\d{4,}\)' src/ --include="*.ts" --include="*.svelte" \| grep -v limits.ts \| wc -l`                                  | 0                     |
| 18  | No raw AbortSignal timeouts       | `grep -Prn 'AbortSignal\.timeout\(\d+\)' src/ --include="*.ts" \| grep -v limits.ts \| wc -l`                                                                        | 0                     |
| 19  | No hardcoded RF frequencies       | `grep -Prn '\b(2400\|2500\|5150\|5850\|2485)\b' src/lib/server/ --include="*.ts" \| grep -v limits.ts \| wc -l`                                                      | 0                     |
| 20  | No /home/pi or /home/ubuntu paths | `grep -Prn '/home/(pi\|ubuntu)/' src/ --include="*.ts" --include="*.svelte" \| wc -l`                                                                                | 0                     |
| 21  | limits.ts has 13+ constant groups | `grep -c "as const" src/lib/constants/limits.ts`                                                                                                                     | >= 13                 |
| 22  | paths.ts exists and uses env vars | `grep -c "env\." src/lib/constants/paths.ts`                                                                                                                         | >= 8                  |
| 23  | No duplicate retention configs    | `grep -c "604800000" src/ -r --include="*.ts"`                                                                                                                       | 1 (only in limits.ts) |
| 24  | TypeScript compiles               | `npm run typecheck`                                                                                                                                                  | Exit 0                |
| 25  | Build succeeds                    | `npm run build`                                                                                                                                                      | Exit 0                |

### Phase 3.3 Exit Criteria (ESLint and Error Hygiene)

| #   | Check                        | Command                                                                                                                       | Expected                                          |
| --- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| 26  | lint-staged config found     | `npx lint-staged --debug 2>&1 \| grep -i "config"`                                                                            | "Configuration found"                             |
| 27  | No unnamed unused catch vars | `npm run lint 2>&1 \| grep "no-unused-vars" \| grep -i "catch" \| wc -l`                                                      | 0                                                 |
| 28  | No silent .catch(() => {})   | `grep -rn '\.catch\s*(\s*(\(\s*\)\|\(\s*_\w*\s*\))\s*=>\s*{\s*})' src/ --include="*.ts" --include="*.svelte" \| wc -l`        | 0                                                 |
| 29  | No commented-out code blocks | Manual review (heuristic grep-based scan)                                                                                     | 0 blocks of 3+ consecutive commented code lines   |
| 30  | No unresolved TODO/FIXME     | `grep -rn "TODO\|FIXME" src/ --include="*.ts" --include="*.svelte" \| grep -v "HACKRF\|HackRF" \| grep -v "issue #" \| wc -l` | 0                                                 |
| 31  | eslint-disable count reduced | `grep -rn "eslint-disable" src/ --include="*.ts" --include="*.svelte" \| wc -l`                                               | 4-5 (legitimate only)                             |
| 32  | no-magic-numbers rule active | `grep "no-magic-numbers" config/eslint.config.js \| wc -l`                                                                    | 1                                                 |
| 33  | prefer-template rule active  | `grep "prefer-template" config/eslint.config.js \| wc -l`                                                                     | 1                                                 |
| 34  | complexity rule active       | `grep "complexity" config/eslint.config.js \| wc -l`                                                                          | 1                                                 |
| 35  | max-depth rule active        | `grep "max-depth" config/eslint.config.js \| wc -l`                                                                           | 1                                                 |
| 36  | No string concat violations  | `npm run lint 2>&1 \| grep "prefer-template" \| wc -l`                                                                        | 0                                                 |
| 37  | TypeScript compiles          | `npm run typecheck`                                                                                                           | Exit 0                                            |
| 38  | Lint passes (no errors)      | `npm run lint`                                                                                                                | Exit 0 (warnings acceptable for warn-level rules) |

### Phase 3.4 Exit Criteria (Defensive Coding)

| #   | Check                                 | Command                                                                                             | Expected |
| --- | ------------------------------------- | --------------------------------------------------------------------------------------------------- | -------- |
| 39  | assert.ts exists                      | `test -f src/lib/utils/assert.ts && echo EXISTS`                                                    | EXISTS   |
| 40  | 4 exported assertion functions        | `grep -c "export function assert" src/lib/utils/assert.ts`                                          | 4        |
| 41  | Assertions in geo.ts                  | `grep -c "assert" src/lib/server/db/geo.ts`                                                         | >= 6     |
| 42  | Assertions in sweepManager            | `grep -c "assert" src/lib/server/hackrf/sweepManager.ts`                                            | >= 3     |
| 43  | Logging policy exists                 | `test -f docs/LOGGING-POLICY.md && echo EXISTS`                                                     | EXISTS   |
| 44  | PII rules documented                  | `grep -c "NEVER" docs/LOGGING-POLICY.md`                                                            | >= 2     |
| 45  | Zod schemas in API routes             | `grep -rl "z\.\|zod" src/routes/api/ --include="*.ts" \| wc -l`                                     | >= 10    |
| 46  | No unguarded parseInt (missing radix) | `grep -Prn 'parseInt\([^,)]+\)' src/ --include="*.ts" \| grep -v ', 10' \| grep -v ', 16' \| wc -l` | 0        |
| 47  | No unsafe error casts                 | `grep -rn "(error as Error)" src/ --include="*.ts" \| wc -l`                                        | 0        |
| 48  | TypeScript compiles                   | `npm run typecheck`                                                                                 | Exit 0   |
| 49  | Build succeeds                        | `npm run build`                                                                                     | Exit 0   |
| 50  | Unit tests pass                       | `npm run test:unit`                                                                                 | Exit 0   |

### Global Exit Criteria

| #   | Check               | Command                                                   | Expected            |
| --- | ------------------- | --------------------------------------------------------- | ------------------- |
| 51  | Full build pipeline | `npm run typecheck && npm run build && npm run test:unit` | Exit 0              |
| 52  | Full lint pipeline  | `npm run lint`                                            | Exit 0, zero errors |

---

## 7. Rollback Strategy

| Scope                   | Command                                                | Notes                        |
| ----------------------- | ------------------------------------------------------ | ---------------------------- |
| Single task             | `git reset --soft HEAD~1`                              | Preserves staging area       |
| Full Phase 3.1 rollback | `git reset --hard phase3-pre-execution && npm install` | Destroys all 3.1 commits     |
| Full Phase 3.2 rollback | `git reset --hard <last-3.1-commit> && npm install`    | Preserves 3.1, destroys 3.2+ |
| Full Phase 3 rollback   | `git reset --hard phase3-pre-execution && npm install` | Destroys all Phase 3 commits |

---

## 8. Execution Tracking

| Task  | Description                                                | Status  | Started | Completed | Verified By | Notes |
| ----- | ---------------------------------------------------------- | ------- | ------- | --------- | ----------- | ----- |
| 3.0.1 | Pre-Execution Code Quality Snapshot                        | PENDING | --      | --        | --          | --    |
| 3.1.0 | Logger Infrastructure Defect Repair (6 bugs)               | PENDING | --      | --        | --          | --    |
| 3.1.1 | Commented Console Statement Deletion (35 lines)            | PENDING | --      | --        | --          | --    |
| 3.1.2 | Incomplete Logger Migration Completion (5 files, 22 stmts) | PENDING | --      | --        | --          | --    |
| 3.1.3 | Batch Migration: Server Core (34 files, ~192 stmts)        | PENDING | --      | --        | --          | --    |
| 3.1.4 | Batch Migration: API Routes (75 files, ~225 stmts)         | PENDING | --      | --        | --          | --    |
| 3.1.5 | Batch Migration: Services (23 files, ~124 stmts)           | PENDING | --      | --        | --          | --    |
| 3.1.6 | Batch Migration: Stores + Components (18 files, ~56 stmts) | PENDING | --      | --        | --          | --    |
| 3.1.7 | Batch Migration: Pages + Remaining (16 files, ~108 stmts)  | PENDING | --      | --        | --          | --    |
| 3.1.8 | ESLint No-Console Escalation (warn -> error)               | PENDING | --      | --        | --          | --    |
| 3.2.0 | Constants Infrastructure Extension                         | PENDING | --      | --        | --          | --    |
| 3.2.1 | Hardcoded Port Number Replacement (98 occurrences)         | PENDING | --      | --        | --          | --    |
| 3.2.2 | Hardcoded Timeout/Interval Replacement (104 occurrences)   | PENDING | --      | --        | --          | --    |
| 3.2.3 | Hardcoded RF Frequency Replacement (80+ occurrences)       | PENDING | --      | --        | --          | --    |
| 3.2.4 | Hardcoded Database Config Replacement (~25 values)         | PENDING | --      | --        | --          | --    |
| 3.2.5 | Hardcoded Buffer/Retention Replacement (27 limits)         | PENDING | --      | --        | --          | --    |
| 3.2.6 | Hardcoded File Path Centralization (25 paths)              | PENDING | --      | --        | --          | --    |
| 3.2.7 | Hardcoded IP Address Centralization (67 references)        | PENDING | --      | --        | --          | --    |
| 3.3.0 | Lint-Staged Verification                                   | PENDING | --      | --        | --          | --    |
| 3.3.1 | Error Variable Catch Block Hygiene (478 + 35 blocks)       | PENDING | --      | --        | --          | --    |
| 3.3.2 | Promise Chain Silent Swallowing Fix (68 instances)         | PENDING | --      | --        | --          | --    |
| 3.3.3 | Commented-Out Code Removal (48 blocks, ~173 lines)         | PENDING | --      | --        | --          | --    |
| 3.3.4 | TODO/FIXME Resolution (15 markers)                         | PENDING | --      | --        | --          | --    |
| 3.3.5 | ESLint-Disable Audit (18 comments)                         | PENDING | --      | --        | --          | --    |
| 3.3.6 | ESLint Rule Additions + String Concatenation (~52 fixes)   | PENDING | --      | --        | --          | --    |
| 3.3.7 | WORKAROUND Comment Documentation (1 comment)               | PENDING | --      | --        | --          | --    |
| 3.4.0 | Runtime Assertion Utility Creation (assert.ts)             | PENDING | --      | --        | --          | --    |
| 3.4.1 | Critical Function Assertion Integration                    | PENDING | --      | --        | --          | --    |
| 3.4.2 | Logging Level Policy / PII Handling (LOGGING-POLICY.md)    | PENDING | --      | --        | --          | --    |
| 3.4.3 | Zod Schema Validation: 10 High-Risk Routes                 | PENDING | --      | --        | --          | --    |
| 3.4.4 | ParseInt/ParseFloat NaN Guard Addition (96 calls)          | PENDING | --      | --        | --          | --    |
| 3.4.5 | Unsafe Error Cast Pattern Fix (~40 casts)                  | PENDING | --      | --        | --          | --    |

---

## 9. Commit Message Format

```
<type>(phase3.X.Y): <description>

Phase 3.X Task Y: <full task name>
Verified: <verification command and result>

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

Types: `fix` (logger defects, error handling), `refactor` (console migration, constant replacement, catch hygiene), `feat` (assert utility, Zod schemas), `build` (ESLint config), `docs` (logging policy, workaround).

---

## 10. Verification Audit Corrections Applied

The following metrics in this master index reflect corrected values from the adversarial verification audit (`PHASE-3.2-VERIFICATION-AUDIT.md`, 2026-02-08). All corrected values supersede the original plan estimates.

| Metric                                     | Original Plan Value  | Corrected Value                         | Source                                             |
| ------------------------------------------ | -------------------- | --------------------------------------- | -------------------------------------------------- |
| Hardcoded port occurrences                 | 73                   | **98**                                  | Verification audit: +25 (34% undercount)           |
| setTimeout/setInterval literals            | 79                   | **92** (69 setTimeout + 23 setInterval) | Verification audit: +13                            |
| Total timeout literals (incl. AbortSignal) | 91                   | **104**                                 | Verification audit: +13                            |
| Hardcoded /home/ paths                     | 18                   | **25**                                  | Verification audit: +7 (39% undercount)            |
| Hardcoded IP/localhost                     | 53                   | **67**                                  | Verification audit: +14 (26% undercount)           |
| Retention duplicates                       | 12                   | **14**                                  | Verification audit: +2                             |
| limits.ts constant groups                  | 7                    | **6**                                   | Verification audit: PORTS listed twice in original |
| console.\* total                           | 753                  | **752**                                 | Phase 3.1 corrected count (2026-02-08)             |
| Commented-out code blocks                  | 19 blocks / 68 lines | **48 blocks / ~173 lines**              | Phase 3.3 corrected (2026-02-08 re-verification)   |
| TODO markers                               | 9 files              | **11 files** (15 markers)               | Phase 3.3 corrected (2026-02-08)                   |

---

**Document End**
