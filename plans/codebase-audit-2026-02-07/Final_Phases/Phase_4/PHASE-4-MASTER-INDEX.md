# Phase 4: Type Safety, Dead Code Elimination, and Compiler Strictness -- Master Index

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: NASA/JPL Rules 2, 5, 14, 20, 31; CERT ERR00-C, INT09-C, MSC12-C, DCL00-C; MISRA Rules 2.2, 3.1, 8.13, 17.7; BARR-C Rules 1.7, 3.2, 8.4, 8.7
**Review Panel**: US Cyber Command Engineering Review Board

---

## 1. Phase Overview

### Purpose

Phase 4 eliminates all type safety deficiencies, dead code, duplicate type definitions, untyped error handling, and permissive compiler/linter configuration. This phase transforms the codebase from a weakly-typed prototype state into a formally auditable, defense-grade TypeScript system where every value has a known type, every error is explicitly handled, and every dead artifact is removed. Upon completion, the type system becomes the primary correctness enforcement mechanism, verified by both the compiler and the linter at CI time.

### Scope

| Dimension                                 | Value                                                                                                 |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Total sub-task files                      | 44                                                                                                    |
| Estimated files to modify                 | ~250+                                                                                                 |
| Dead files to delete                      | ~36 files + 8 directories (~7,360 lines)                                                              |
| Duplicate type definitions to consolidate | 89 definitions across 37 names (45 removed)                                                           |
| `any` type occurrences to eliminate       | 214 (185 in active code + 19 in leaflet.d.ts + 10 auto-removed by dead code deletion)                 |
| Untyped catch blocks to annotate          | 402 (+ 1 explicit `: any`)                                                                            |
| JSON.parse sites to add Zod validation    | 49                                                                                                    |
| TypeScript errors to fix (svelte-check)   | 110                                                                                                   |
| ESLint errors to fix                      | 36                                                                                                    |
| Compiler strictness options to enable     | 3-4 (noFallthroughCasesInSwitch, noImplicitReturns, noImplicitOverride, noUncheckedIndexedAccess TBD) |
| ESLint rules to escalate warn -> error    | 4                                                                                                     |
| Type-checked lint rules to enable         | 10                                                                                                    |

### Risk Level

**MEDIUM overall.** Phase 4.1 (dead code deletion) is the highest-risk sub-phase because incorrect deletion breaks the application. Phase 4.2 (type deduplication) carries medium risk from import path changes. Phase 4.3 (any elimination) may reveal latent bugs where `any` masked type mismatches. Phase 4.4 (catch block annotation) is purely mechanical with zero behavioral change. Phase 4.5 (compiler strictness) may surface new errors when previously-disabled checks are activated.

### Prerequisites

| Prerequisite                 | Status      | Rationale                                                                                            |
| ---------------------------- | ----------- | ---------------------------------------------------------------------------------------------------- |
| Phase 0 (Code Organization)  | REQUIRED    | File structure must be stable before mass modifications                                              |
| Phase 1 (Zero-Risk Cleanup)  | REQUIRED    | Dead static files must be removed before dead code analysis                                          |
| Phase 2 (Security Hardening) | RECOMMENDED | Security fixes may add new types; completing Phase 2 first avoids rework                             |
| Phase 3 (Code Quality)       | REQUIRED    | Logger infrastructure, constants, and assertion utilities from Phase 3 are consumed by Phase 4 tasks |

### Blocks

| Blocked Phase                        | Reason                                                                                |
| ------------------------------------ | ------------------------------------------------------------------------------------- |
| Phase 5 (Architecture Decomposition) | Function extraction and module decomposition depend on a stable, fully-typed codebase |
| Phase 6 (Performance)                | Performance profiling requires dead code removed and type-safe interfaces             |

---

## 2. Standards Traceability

| Standard         | Rule                                                        | Phase 4 Sub-Tasks Addressing It                                                 |
| ---------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------- |
| NASA/JPL Rule 2  | All code states must be traceable                           | 4.0.1 (pre-execution snapshot), 4.5.7 (CI integration)                          |
| NASA/JPL Rule 5  | Use runtime assertions                                      | 4.4.7, 4.4.8 (Zod validation schemas for JSON.parse)                            |
| NASA/JPL Rule 14 | Check return values                                         | 4.4.2 (getErrorMessage), 4.5.3 (noImplicitReturns)                              |
| NASA/JPL Rule 20 | Named constants for all literals; resolve all warnings      | 4.5.2 (ESLint escalation), 4.5.6 (type-checked linting)                         |
| NASA/JPL Rule 31 | No dead code                                                | 4.1.0 through 4.1.6 (dead file deletion), 4.5.1 (knip dead export detection)    |
| CERT ERR00-C     | Consistent error handling policy                            | 4.4.0 through 4.4.6 (catch block typing), 4.4.1 (getErrorMessage utility)       |
| CERT INT09-C     | Define numeric constants; use named types                   | 4.2.0 through 4.2.7 (type deduplication)                                        |
| CERT MSC12-C     | Detect and remove dead code                                 | 4.1.0 through 4.1.6, 4.5.1 (knip)                                               |
| CERT DCL00-C     | Const-qualify immutable declarations                        | 4.5.2 (prefer-as-const ESLint rule)                                             |
| MISRA Rule 2.2   | No dead code (unreachable, unused)                          | 4.1.0 through 4.1.6                                                             |
| MISRA Rule 3.1   | No commented-out code                                       | 4.1.5 (remove example/test files containing dead code)                          |
| MISRA Rule 8.13  | Pointer parameters should be const if not modified          | 4.5.4 (noImplicitOverride)                                                      |
| MISRA Rule 17.7  | Return value of functions shall not be discarded            | 4.5.3 (noImplicitReturns), 4.5.6 (no-floating-promises)                         |
| BARR-C Rule 1.7  | All compiler and static analyzer warnings shall be resolved | 4.5.0 (fix existing errors), 4.5.2 (ESLint escalation)                          |
| BARR-C Rule 3.2  | Variables shall be given the narrowest possible type        | 4.3.0 through 4.3.9 (any elimination), 4.2.0 through 4.2.7 (type deduplication) |
| BARR-C Rule 8.4  | All external input shall be validated                       | 4.4.7, 4.4.8 (Zod schemas for JSON.parse)                                       |
| BARR-C Rule 8.7  | No side effects in debug/diagnostic code                    | 4.1.4 (remove test route directories)                                           |

---

## 3. Execution Order -- Dependency Graph

```
                           START
                             |
                             v
                     [ 4.0.1 Pre-Execution ]
                     [ Type Safety Snapshot ]
                             |
              +--------------+--------------+
              |                             |
              v                             |
      [ 4.1.0 Pre-Deletion ]               |
      [ Verification Gate ]                 |
              |                             |
     +--------+--------+                   |
     |    |    |    |   |                   |
     v    v    v    v   v                   |
  [4.1.1][4.1.2][4.1.3][4.1.4][4.1.5]     |
  Batch1  Batch2  Grid  Test   Example     |
  8 dead  12 dead Type  Routes Files       |
  files   files   Migr  8 dirs 5 files     |
     |    |    |    |   |                   |
     +----+----+----+---+                   |
              |                             |
              v                             |
      [ 4.1.6 Barrel ]                     |
      [ Cleanup + Empty ]                  |
      [ Directories ]                      |
              |                             |
              v                             |
      [ 4.2.0 Audit ]                      |
      [ Divergent Fields ]                 |
      [ (read-only) ]                      |
              |                             |
              v                             |
      [ 4.2.1 Sweep-Manager ]             |
      [ Shared Types ]                     |
              |                             |
              v                             |
      [ 4.2.2 Canonical ]                 |
      [ Type Barrel ]                      |
              |                             |
              v                             |
      [ 4.2.3 Semantic ]                  |
      [ Conflict Renames ]                 |
              |                             |
     +--------+--------+--------+          |
     |        |        |        |          |
     v        v        v        v          |
  [4.2.4]  [4.2.5]  [4.2.6]  [4.2.7]     |
  5-copy   4-copy   3-copy   2-copy       |
  Kismet   Spectrm  Types    Types        |
  Device   Data     Batch    Batch        |
     |        |        |        |          |
     +--------+--------+--------+          |
              |                            |
              v                            |
      [ 4.3.0 Delete ]                    |
      [ leaflet.d.ts ]                    |
              |                            |
     +--------+--------+--------+          |
     |        |        |        |          |
     v        v        v        v          |
  [4.3.1]  [4.3.2]  [4.3.3]  [4.3.4]     |
  High-Val MCP Dyn  Wigle    Store        |  <-- PARALLEL
  Targets  Server   Pattern  Types        |
     |        |        |        |          |
     +--------+--------+--------+          |
              |                            |
     +--------+--------+                   |
     |        |        |                   |
     v        v        v                   |
  [4.3.5]  [4.3.6]  [4.3.7]              |
  As-Any   RTL-433  Kismet                |
  Casts    Global   Server                |
     |        |        |                   |
     +--------+--------+                   |
              |                            |
              v                            |
      [ 4.3.8 Remove ]                    |
      [ eslint-disable ]                  |
      [ Directives ]                      |
              |                            |
              v                            |
      [ 4.3.9 Fix Remaining ]             |
      [ Active Any ]                      |
              |                            |
              +----------------------------+
              |
              v
      [ 4.4.0 Fix Explicit ]
      [ Any Catch Block ]
              |
              v
      [ 4.4.1 Extend ]
      [ errors.ts Utilities ]
              |
     +--------+--------+
     |        |        |
     v        v        v
  [4.4.2]  [4.4.3]  [4.4.4]     <-- SEQUENTIAL BATCHES
  Server   Service  API Route
  143 catch 95 catch 80 catch
     |        |        |
     +--------+--------+
              |
     +--------+--------+
     |                 |
     v                 v
  [4.4.5]           [4.4.6]
  Page Comp          Batch 5-8
  38 catch           46 catch
     |                 |
     +--------+--------+
              |
     +--------+--------+
     |                 |
     v                 v
  [4.4.7]           [4.4.8]     <-- PARALLEL
  Zod Security       Zod App
  Critical (T1)      Low Risk (T2+T3)
     |                 |
     +--------+--------+
              |
              v
      [ 4.5.0 Fix Existing ]
      [ TS + ESLint Errors ]
      [ (GATE) ]
              |
              v
      [ 4.5.1 Install knip ]
      [ Dead Export Analysis ]
              |
              v
      [ 4.5.2 ESLint ]
      [ Strictness Escalation ]
              |
     +--------+--------+
     |                 |
     v                 v
  [4.5.3]           [4.5.4]     <-- PARALLEL
  noFallthrough     noImplicit
  noImplicitRet     Override
     |                 |
     +--------+--------+
              |
              v
      [ 4.5.5 Evaluate ]
      [ noUncheckedIdx ]
      [ (decision gate) ]
              |
              v
      [ 4.5.6 Enable ]
      [ Type-Checked ]
      [ Linting ]
              |
              v
      [ 4.5.7 CI Pipeline ]
      [ Integration ]
              |
              v
      PHASE 4 COMPLETE
```

### Dependency Summary (Textual)

| Task                  | Depends On                         | Rationale                                                                      |
| --------------------- | ---------------------------------- | ------------------------------------------------------------------------------ |
| 4.0.1                 | Phase 0, Phase 1, Phase 3 complete | Stable codebase for snapshot                                                   |
| 4.1.0                 | 4.0.1                              | Pre-deletion verification requires snapshot baseline                           |
| 4.1.1-4.1.5           | 4.1.0                              | All deletions blocked by verification gate; 4.1.1-4.1.5 may run in parallel    |
| 4.1.3 (GridProcessor) | 4.1.0                              | Type migration before deletion                                                 |
| 4.1.6                 | 4.1.1, 4.1.2, 4.1.4, 4.1.5         | Barrel cleanup after all deletions complete                                    |
| 4.2.0                 | 4.1.6                              | Dead code must be removed before type audit to avoid deduplicating dead types  |
| 4.2.1                 | 4.2.0                              | Shared types file requires field divergence audit                              |
| 4.2.2                 | 4.2.1                              | Barrel re-exports shared types created in 4.2.1                                |
| 4.2.3                 | 4.2.2                              | Semantic renames after barrel exists                                           |
| 4.2.4-4.2.7           | 4.2.3                              | Batch duplicate replacement after renames; strictly sequential                 |
| 4.3.0                 | 4.2.7                              | leaflet.d.ts deletion after type dedup ensures no conflict                     |
| 4.3.1-4.3.4           | 4.3.0                              | High-value targets after leaflet types clean; may run in parallel              |
| 4.3.5-4.3.7           | 4.3.1-4.3.4                        | Remaining casts after high-value targets fixed                                 |
| 4.3.7 (Kismet server) | 4.2.7                              | Requires canonical KismetDevice type from Phase 4.2                            |
| 4.3.8                 | 4.3.5-4.3.7                        | eslint-disable removal after all `any` eliminated                              |
| 4.3.9                 | 4.3.8                              | Remaining active `any` after all targeted tasks                                |
| 4.4.0                 | 4.0.1                              | Independent of other sub-phases; can run after snapshot                        |
| 4.4.1                 | 4.4.0                              | Utility extension after explicit-any fix                                       |
| 4.4.2-4.4.4           | 4.4.1                              | Server, service, API batches depend on getErrorMessage()                       |
| 4.4.5-4.4.6           | 4.4.2-4.4.4                        | UI/store/other batches after server-side complete                              |
| 4.4.7, 4.4.8          | 4.4.1                              | Zod schemas independent of catch block batches; may run in parallel            |
| 4.5.0                 | 4.1.6, 4.2.7, 4.3.9, 4.4.6         | Gate: all prior sub-phases must complete before fixing baseline errors         |
| 4.5.1                 | 4.5.0                              | knip installation after green baseline                                         |
| 4.5.2                 | 4.5.1                              | ESLint escalation after knip baseline captured                                 |
| 4.5.3, 4.5.4          | 4.5.2                              | Compiler options after ESLint escalation; may run in parallel                  |
| 4.5.5                 | 4.5.3, 4.5.4                       | Evaluation after both compiler options enabled                                 |
| 4.5.6                 | 4.5.5, 4.3.9                       | Type-checked linting requires all `any` eliminated and compiler options stable |
| 4.5.7                 | 4.5.6                              | CI integration is the final step                                               |

---

## 4. Complete File Inventory

### Phase 4.0 -- Pre-Execution

| #   | File Name                                           | Scope                             | Est. Files Touched | Risk Level | Dependencies         |
| --- | --------------------------------------------------- | --------------------------------- | ------------------ | ---------- | -------------------- |
| 1   | `Phase-4.0.1-Pre-Execution-Type-Safety-Snapshot.md` | Baseline metrics capture, git tag | 0                  | ZERO       | Phase 0+1+3 complete |

### Phase 4.1 -- Dead Code Elimination (7 files)

| #   | File Name                                             | Scope                                                                                                     | Est. Files Touched     | Risk Level | Dependencies               |
| --- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------- | ---------- | -------------------------- |
| 2   | `Phase-4.1.0-Pre-Deletion-Verification-Gate.md`       | Verify every deletion target has zero active imports; safety gate for all deletions                       | 0                      | ZERO       | 4.0.1                      |
| 3   | `Phase-4.1.1-Delete-Confirmed-Dead-Files-Batch-1.md`  | Delete 8 original-plan dead files (2,724 lines)                                                           | 8 deleted              | MEDIUM     | 4.1.0                      |
| 4   | `Phase-4.1.2-Delete-Additional-Dead-Files-Batch-2.md` | Delete 12 newly-discovered dead files + 1 directory (2,790 lines)                                         | 12 deleted + 1 dir     | MEDIUM     | 4.1.0                      |
| 5   | `Phase-4.1.3-GridProcessor-Type-Migration.md`         | Migrate 4 interfaces from gridProcessor.ts to heatmapService.ts, then delete gridProcessor.ts (267 lines) | 2 modified + 1 deleted | LOW-MEDIUM | 4.1.0                      |
| 6   | `Phase-4.1.4-Remove-Test-Route-Directories.md`        | Delete 8 publicly-routable test/debug route directories (~821 lines); security-relevant                   | 8 dirs deleted         | MEDIUM     | 4.1.0                      |
| 7   | `Phase-4.1.5-Remove-Example-Test-Files.md`            | Delete 5 example/test utility files (708 lines)                                                           | 5 deleted              | LOW        | 4.1.0                      |
| 8   | `Phase-4.1.6-Barrel-Cleanup-Empty-Directories.md`     | Edit 2 barrel files, delete 4 dead barrels + 1 dead API file + empty directories (~222 lines)             | 2 modified + 5 deleted | LOW        | 4.1.1, 4.1.2, 4.1.4, 4.1.5 |

### Phase 4.2 -- Type Deduplication (8 files)

| #   | File Name                                                      | Scope                                                                                                                                                       | Est. Files Touched     | Risk Level | Dependencies |
| --- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ---------- | ------------ |
| 9   | `Phase-4.2.0-Audit-Divergent-Fields.md`                        | Read-only: document field divergence for all 37 duplicate type names                                                                                        | 0                      | ZERO       | 4.1.6        |
| 10  | `Phase-4.2.1-Create-Sweep-Manager-Shared-Types.md`             | Extract 5 identical HackRF/USRP types into shared file; update 4 imports                                                                                    | 5 (1 new + 4 modified) | LOW        | 4.2.0        |
| 11  | `Phase-4.2.2-Create-Canonical-Type-Barrel.md`                  | Create src/lib/types/index.ts re-exporting all canonical shared types                                                                                       | 1 (new)                | LOW        | 4.2.1        |
| 12  | `Phase-4.2.3-Resolve-Semantic-Conflicts.md`                    | Rename 9 semantically-conflicting type names (HardwareStatus, DeviceInfo, ScanResult, SystemInfo, SystemHealth, NetworkInterface, KismetSystemStatus, etc.) | ~15                    | MEDIUM     | 4.2.2        |
| 13  | `Phase-4.2.4-Replace-Duplicates-Batch-1-5Copy-KismetDevice.md` | Deduplicate KismetDevice from 5 copies to 1; merge superset fields                                                                                          | ~6                     | MEDIUM     | 4.2.3        |
| 14  | `Phase-4.2.5-Replace-Duplicates-Batch-2-4Copy-SpectrumData.md` | Deduplicate SpectrumData from 4 copies to 1 + 2 renamed variants                                                                                            | ~5                     | MEDIUM     | 4.2.4        |
| 15  | `Phase-4.2.6-Replace-Duplicates-Batch-3-3Copy-Types.md`        | Deduplicate 3-copy types: ServiceStatus, KismetStatus, CoralPrediction, NetworkPacket                                                                       | ~8                     | LOW-MEDIUM | 4.2.5        |
| 16  | `Phase-4.2.7-Replace-Duplicates-Batch-4-2Copy-Types.md`        | Deduplicate 16 two-copy types: localization group, signals, sweep, kismet, GPS, etc.                                                                        | ~20                    | LOW-MEDIUM | 4.2.6        |

### Phase 4.3 -- Any Type Elimination (10 files)

| #   | File Name                                         | Scope                                                                                          | Est. Files Touched | Risk Level | Dependencies |
| --- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------ | ---------- | ------------ |
| 17  | `Phase-4.3.0-Delete-Custom-Leaflet-DTS.md`        | Delete src/types/leaflet.d.ts (166 lines, 19 `any`); @types/leaflet provides coverage          | 1 deleted          | LOW        | 4.2.7        |
| 18  | `Phase-4.3.1-Fix-High-Value-Targets.md`           | Fix top 5 files by `any` count: data-stream (11), tower-location (6), gsmEvilStore (6)         | 3                  | MEDIUM     | 4.3.0        |
| 19  | `Phase-4.3.2-Fix-MCP-Dynamic-Server.md`           | Replace 6 `(d: any)` callbacks with KismetDeviceRaw interface                                  | 1                  | LOW        | 4.3.0        |
| 20  | `Phase-4.3.3-Fix-Wigletotak-Pattern.md`           | Fix 29 `any` across 5 Svelte components using static type imports for dynamic modules          | 5                  | MEDIUM     | 4.3.0        |
| 21  | `Phase-4.3.4-Fix-Store-Any-Types.md`              | Fix 3 `any` in rtl433Store, hackrfStore, kismetStore with Leaflet/RTL-433 types                | 3                  | LOW        | 4.3.0        |
| 22  | `Phase-4.3.5-Fix-Remaining-As-Any-Casts.md`       | Fix ~15 `as any` casts across ~10 files (kismetProxy, usrp-api, base.ts, mapUtils, etc.)       | ~10                | MEDIUM     | 4.3.1-4.3.4  |
| 23  | `Phase-4.3.6-Fix-RTL433-Global-Casts.md`          | Fix 7 `any` in RTL-433 control: globalThis type declaration + ChildProcess typing              | 2 (+ app.d.ts)     | LOW        | 4.3.0        |
| 24  | `Phase-4.3.7-Fix-Kismet-Server-Cluster.md`        | Fix 55 `any` across 5 alive Kismet server files (security_analyzer, device_intelligence, etc.) | 5                  | MEDIUM     | 4.2.7        |
| 25  | `Phase-4.3.8-Remove-ESLint-Disable-Directives.md` | Remove 4-8 `eslint-disable no-explicit-any` directives + escalate rule to error                | 4-8 + config       | LOW        | 4.3.5-4.3.7  |
| 26  | `Phase-4.3.9-Fix-Remaining-Active-Any.md`         | Fix ~34 remaining `any` across ~25 files (server, service, route, component, test)             | ~25                | MEDIUM     | 4.3.8        |

### Phase 4.4 -- Catch Block Migration and Runtime Validation (9 files)

| #   | File Name                                                    | Scope                                                                                                | Est. Files Touched | Risk Level | Dependencies |
| --- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- | ------------------ | ---------- | ------------ |
| 27  | `Phase-4.4.0-Fix-Explicit-Any-Catch-Block.md`                | Fix 1 explicit `: any` catch block in gsm-evil/scan/+server.ts                                       | 1                  | ZERO       | 4.0.1        |
| 28  | `Phase-4.4.1-Extend-Errors-TS-Utilities.md`                  | Add getErrorMessage(), isBaseError(), getErrorStack(), isExecError() to errors.ts                    | 1                  | LOW        | 4.4.0        |
| 29  | `Phase-4.4.2-Batch-1-Server-Side-Catches.md`                 | Annotate 143 untyped catch blocks across 47 files in src/lib/server/                                 | 47                 | LOW        | 4.4.1        |
| 30  | `Phase-4.4.3-Batch-2-Service-Layer-Catches.md`               | Annotate 95 untyped catch blocks across 25 files in src/lib/services/                                | 25                 | LOW        | 4.4.1        |
| 31  | `Phase-4.4.4-Batch-3-API-Route-Catches.md`                   | Annotate 80 untyped catch blocks across 51 files in src/routes/api/                                  | 51                 | LOW        | 4.4.1        |
| 32  | `Phase-4.4.5-Batch-4-Page-Component-Catches.md`              | Annotate 38 untyped catch blocks across 13 Svelte page files                                         | 13                 | LOW        | 4.4.2-4.4.4  |
| 33  | `Phase-4.4.6-Batch-5-8-UI-Stores-Database-Other-Catches.md`  | Annotate 46 untyped catch blocks: UI components (27), stores (13), database (3), other (3)           | 31                 | LOW        | 4.4.2-4.4.4  |
| 34  | `Phase-4.4.7-Zod-Schemas-JSON-Parse-Security-Critical.md`    | Add Zod schemas for 15 Tier 1 security-critical JSON.parse sites (WebSocket, Kismet SSE, shell exec) | 15 + schema files  | LOW-MEDIUM | 4.4.1        |
| 35  | `Phase-4.4.8-Zod-Schemas-JSON-Parse-Application-Low-Risk.md` | Add Zod schemas for 34 Tier 2+3 JSON.parse sites (SSE streams, localStorage, config files)           | 34 + schema files  | LOW        | 4.4.1        |

### Phase 4.5 -- ESLint and Compiler Strictness (8 files)

| #   | File Name                                               | Scope                                                                                     | Est. Files Touched        | Risk Level | Dependencies               |
| --- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------- | ---------- | -------------------------- |
| 36  | `Phase-4.5.0-Fix-Existing-TS-ESLint-Errors.md`          | Fix 110 TypeScript errors + 36 ESLint errors to establish green baseline (GATE)           | ~60                       | MEDIUM     | 4.1.6, 4.2.7, 4.3.9, 4.4.6 |
| 37  | `Phase-4.5.1-Install-Knip-Dead-Export-Analysis.md`      | Install knip dev dependency, create config, capture baseline dead export count            | 2 (config + package.json) | LOW        | 4.5.0                      |
| 38  | `Phase-4.5.2-ESLint-Strictness-Escalation.md`           | Escalate 4 ESLint rules from warn to error; add 4 new strict rules                        | 1 (config)                | LOW        | 4.5.1                      |
| 39  | `Phase-4.5.3-Enable-NoFallthrough-NoImplicitReturns.md` | Enable noFallthroughCasesInSwitch + noImplicitReturns in tsconfig.json; fix violations    | ~10                       | LOW-MEDIUM | 4.5.2                      |
| 40  | `Phase-4.5.4-Enable-NoImplicitOverride.md`              | Enable noImplicitOverride in tsconfig.json; add override keyword to class methods         | ~5                        | LOW        | 4.5.2                      |
| 41  | `Phase-4.5.5-Evaluate-NoUncheckedIndexedAccess.md`      | Trial run of noUncheckedIndexedAccess; decision gate (enable if <20 errors, defer if >50) | TBD                       | MEDIUM     | 4.5.3, 4.5.4               |
| 42  | `Phase-4.5.6-Enable-Type-Checked-Linting.md`            | Set project: true in ESLint config; enable 10 type-aware rules in 3 graduated tiers       | ~30                       | MEDIUM     | 4.5.5, 4.3.9               |
| 43  | `Phase-4.5.7-CI-Pipeline-Integration.md`                | Add ci:typecheck, ci:lint, ci:knip, ci:all scripts to package.json; enforce 0-error gates | 1 (package.json)          | LOW        | 4.5.6                      |

---

## 5. Aggregate Metrics

| Metric                   | Phase 4.1                 | Phase 4.2 | Phase 4.3 | Phase 4.4  | Phase 4.5 | Total                          |
| ------------------------ | ------------------------- | --------- | --------- | ---------- | --------- | ------------------------------ |
| Sub-task files           | 7                         | 8         | 10        | 9          | 8         | 42 + 1 pre-exec + 1 index = 44 |
| Estimated files modified | ~36 deleted + ~5 modified | ~35       | ~70       | ~167       | ~60       | ~250+ (significant overlap)    |
| Git commits produced     | 6                         | 7         | ~10       | 9          | 6-7       | ~38-39                         |
| Risk level (highest)     | MEDIUM                    | MEDIUM    | MEDIUM    | LOW-MEDIUM | MEDIUM    | MEDIUM                         |

### Quantified Work Items

| Category                                    | Count                                                        | Source Phase |
| ------------------------------------------- | ------------------------------------------------------------ | ------------ |
| Dead files to delete (Batch 1)              | 8 + 1 deferred                                               | 4.1          |
| Dead files to delete (Batch 2)              | 12 + 1 directory                                             | 4.1          |
| Test route directories to delete            | 8                                                            | 4.1          |
| Example/test files to delete                | 5                                                            | 4.1          |
| Dead barrel files to delete                 | 4 + 1 dead API file                                          | 4.1          |
| Total dead lines removed                    | ~7,360                                                       | 4.1          |
| Duplicate type names                        | 37 (89 total definitions)                                    | 4.2          |
| Type definitions to remove                  | 45                                                           | 4.2          |
| Semantic conflicts to rename                | 9                                                            | 4.2          |
| Sweep-manager shared types to extract       | 5                                                            | 4.2          |
| Files requiring import updates (type dedup) | ~31                                                          | 4.2          |
| `any` in active code                        | 185                                                          | 4.3          |
| `any` in leaflet.d.ts (deleted)             | 19                                                           | 4.3          |
| `any` auto-removed by dead code deletion    | 10                                                           | 4.3          |
| `as any` casts                              | 30                                                           | 4.3          |
| eslint-disable for no-explicit-any          | 8                                                            | 4.3          |
| Kismet server cluster `any` (alive files)   | 55                                                           | 4.3          |
| Untyped catch blocks to annotate            | 402                                                          | 4.4          |
| Explicit `: any` catch block                | 1                                                            | 4.4          |
| Parameterless catch blocks (out of scope)   | 35                                                           | 4.4          |
| New error utility functions                 | 4 (getErrorMessage, isBaseError, getErrorStack, isExecError) | 4.4          |
| JSON.parse sites (Tier 1 security-critical) | 15                                                           | 4.4          |
| JSON.parse sites (Tier 2 application)       | 19                                                           | 4.4          |
| JSON.parse sites (Tier 3 low-risk)          | 9                                                            | 4.4          |
| JSON.parse sites (duplicate schemas)        | 6                                                            | 4.4          |
| Zod schema files to create                  | ~10                                                          | 4.4          |
| TypeScript errors to fix (svelte-check)     | 110                                                          | 4.5          |
| ESLint errors to fix                        | 36                                                           | 4.5          |
| ESLint rules to escalate to error           | 4                                                            | 4.5          |
| New ESLint rules to add                     | 4                                                            | 4.5          |
| Compiler strictness options to enable       | 3 (+ 1 TBD evaluation)                                       | 4.5          |
| Type-checked lint rules to enable           | 10 (3 tiers)                                                 | 4.5          |
| CI pipeline scripts to add                  | 4                                                            | 4.5          |

---

## 6. Phase 4 Exit Criteria

Phase 4 is complete when ALL of the following verification checks pass with zero failures. Every check includes its verification command and expected output.

### Phase 4.1 Exit Criteria (Dead Code Eliminated)

| #   | Check                                       | Command                                                            | Expected          |
| --- | ------------------------------------------- | ------------------------------------------------------------------ | ----------------- |
| 1   | No broken imports referencing deleted files | `npm run typecheck`                                                | Exit 0            |
| 2   | Build succeeds after deletions              | `npm run build`                                                    | Exit 0            |
| 3   | No empty directories in src/                | `find src/ -type d -empty \| wc -l`                                | 0                 |
| 4   | Test routes removed                         | `ls -d src/routes/test* src/routes/api/test* 2>/dev/null \| wc -l` | 0                 |
| 5   | Debug routes retained                       | `test -d src/routes/api/debug && echo PASS`                        | PASS              |
| 6   | Deleted file count                          | `git diff --stat HEAD --diff-filter=D -- src/ \| tail -1`          | ~35 files deleted |

### Phase 4.2 Exit Criteria (Types Deduplicated)

| #   | Check                             | Command                                                                      | Expected |
| --- | --------------------------------- | ---------------------------------------------------------------------------- | -------- |
| 7   | KismetDevice has 1 definition     | `grep -rn "^export.*interface KismetDevice " --include="*.ts" src/ \| wc -l` | 1        |
| 8   | SpectrumData has 1 definition     | `grep -rn "^export.*interface SpectrumData " --include="*.ts" src/ \| wc -l` | 1        |
| 9   | Sweep-manager shared types exist  | `test -f src/lib/services/sweep-manager/types.ts && echo EXISTS`             | EXISTS   |
| 10  | Canonical type barrel exists      | `test -f src/lib/types/index.ts && echo EXISTS`                              | EXISTS   |
| 11  | Semantic conflict renames applied | `grep -rn "HardwareConnectionState" --include="*.ts" src/ \| wc -l`          | >= 1     |
| 12  | TypeScript compiles               | `npm run typecheck`                                                          | Exit 0   |

### Phase 4.3 Exit Criteria (Any Types Eliminated)

| #   | Check                                   | Command                                                                                                                                                       | Expected  |
| --- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| 13  | Zero `any` in active source             | `grep -rn ': any\|as any' --include='*.ts' --include='*.svelte' --exclude-dir=node_modules --exclude-dir=.svelte-kit --exclude='*.d.ts' src/ tests/ \| wc -l` | 0         |
| 14  | Zero eslint-disable for no-explicit-any | `grep -rn 'eslint-disable.*no-explicit-any' --include='*.ts' --include='*.svelte' src/ \| wc -l`                                                              | 0         |
| 15  | leaflet.d.ts deleted                    | `test -f src/types/leaflet.d.ts && echo EXISTS \|\| echo DELETED`                                                                                             | DELETED   |
| 16  | ESLint no-explicit-any is error         | `grep "no-explicit-any" config/eslint.config.js`                                                                                                              | `'error'` |
| 17  | TypeScript compiles                     | `npm run typecheck`                                                                                                                                           | Exit 0    |

### Phase 4.4 Exit Criteria (Catch Blocks Typed, Zod Schemas Added)

| #   | Check                                    | Command                                                                                                                        | Expected    |
| --- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| 18  | Zero untyped catch blocks                | `grep -rn 'catch\s*(\s*[a-zA-Z_][a-zA-Z0-9_]*\s*)' --include='*.ts' --include='*.svelte' src/ \| grep -v ': unknown' \| wc -l` | 0           |
| 19  | Zero `: any` catch blocks                | `grep -rn 'catch\s*(\s*\\w\+\s*:\s*any' --include='*.ts' --include='*.svelte' src/ \| wc -l`                                   | 0           |
| 20  | getErrorMessage() exported               | `grep 'export function getErrorMessage' src/lib/types/errors.ts`                                                               | Match found |
| 21  | Zod schema directory exists              | `ls src/lib/schemas/*.ts \| wc -l`                                                                                             | >= 10       |
| 22  | No unvalidated JSON.parse with `as` cast | `grep -rn 'JSON\\.parse.*) as ' --include='*.ts' --include='*.svelte' src/ \| grep -v safeParse \| wc -l`                      | 0           |
| 23  | TypeScript compiles                      | `npm run typecheck`                                                                                                            | Exit 0      |

### Phase 4.5 Exit Criteria (Compiler and Linter Strict)

| #   | Check                              | Command                                                            | Expected           |
| --- | ---------------------------------- | ------------------------------------------------------------------ | ------------------ |
| 24  | svelte-check 0 errors              | `npx svelte-check --tsconfig ./tsconfig.json 2>&1 \| tail -1`      | 0 errors           |
| 25  | ESLint 0 errors                    | `npx eslint --config config/eslint.config.js src/ 2>&1 \| tail -1` | 0 errors           |
| 26  | knip installed                     | `npm ls knip \| grep knip`                                         | Version listed     |
| 27  | noFallthroughCasesInSwitch enabled | `grep "noFallthroughCasesInSwitch" tsconfig.json`                  | `true`             |
| 28  | noImplicitReturns enabled          | `grep "noImplicitReturns" tsconfig.json`                           | `true`             |
| 29  | noImplicitOverride enabled         | `grep "noImplicitOverride" tsconfig.json`                          | `true`             |
| 30  | Type-checked linting active        | `grep "project:" config/eslint.config.js \| grep -v false`         | Project path found |
| 31  | CI scripts exist                   | `grep "ci:all" package.json`                                       | Match found        |
| 32  | Full build pipeline                | `npm run typecheck && npm run build && npm run test:unit`          | Exit 0             |

### Global Exit Criteria

| #   | Check               | Command                                                   | Expected            |
| --- | ------------------- | --------------------------------------------------------- | ------------------- |
| 33  | Full build pipeline | `npm run typecheck && npm run build && npm run test:unit` | Exit 0              |
| 34  | Full lint pipeline  | `npm run lint`                                            | Exit 0, zero errors |

---

## 7. Rollback Strategy

| Scope                   | Command                                                | Notes                            |
| ----------------------- | ------------------------------------------------------ | -------------------------------- |
| Single task             | `git reset --soft HEAD~1`                              | Preserves staging area           |
| Full Phase 4.1 rollback | `git reset --hard phase4-pre-execution && npm install` | Destroys all 4.1 commits         |
| Full Phase 4.2 rollback | `git reset --hard <last-4.1-commit> && npm install`    | Preserves 4.1, destroys 4.2+     |
| Full Phase 4.3 rollback | `git reset --hard <last-4.2-commit> && npm install`    | Preserves 4.1+4.2, destroys 4.3+ |
| Full Phase 4.4 rollback | `git reset --hard <last-4.3-commit> && npm install`    | Preserves 4.1-4.3, destroys 4.4+ |
| Full Phase 4.5 rollback | `git reset --hard <last-4.4-commit> && npm install`    | Preserves 4.1-4.4, destroys 4.5  |
| Full Phase 4 rollback   | `git reset --hard phase4-pre-execution && npm install` | Destroys all Phase 4 commits     |

### Per-File Rollback

If a specific file causes regressions:

```bash
git checkout HEAD~1 -- path/to/file.ts
npm run typecheck
```

### Zod Schema Rollback

If Zod schemas reject valid runtime data:

1. Replace `safeParse` with `JSON.parse` + `as Type` cast (prior state)
2. Fix the schema to accept the valid shape
3. Re-apply the validated version
4. Note: `safeParse` never throws -- data loss is impossible

---

## 8. Execution Tracking

| Task  | Description                                                       | Status  | Started | Completed | Verified By | Notes |
| ----- | ----------------------------------------------------------------- | ------- | ------- | --------- | ----------- | ----- |
| 4.0.1 | Pre-Execution Type Safety Snapshot                                | PENDING | --      | --        | --          | --    |
| 4.1.0 | Pre-Deletion Verification Gate                                    | PENDING | --      | --        | --          | --    |
| 4.1.1 | Delete Confirmed Dead Files Batch 1 (8 files, 2,724 lines)        | PENDING | --      | --        | --          | --    |
| 4.1.2 | Delete Additional Dead Files Batch 2 (12 files, 2,790 lines)      | PENDING | --      | --        | --          | --    |
| 4.1.3 | GridProcessor Type Migration (4 interfaces, 1 file deleted)       | PENDING | --      | --        | --          | --    |
| 4.1.4 | Remove Test Route Directories (8 dirs, ~821 lines)                | PENDING | --      | --        | --          | --    |
| 4.1.5 | Remove Example/Test Files (5 files, 708 lines)                    | PENDING | --      | --        | --          | --    |
| 4.1.6 | Barrel Cleanup and Empty Directories (~222 lines)                 | PENDING | --      | --        | --          | --    |
| 4.2.0 | Audit Divergent Fields (read-only)                                | PENDING | --      | --        | --          | --    |
| 4.2.1 | Create Sweep-Manager Shared Types (5 types)                       | PENDING | --      | --        | --          | --    |
| 4.2.2 | Create Canonical Type Barrel (src/lib/types/index.ts)             | PENDING | --      | --        | --          | --    |
| 4.2.3 | Resolve Semantic Conflicts (9 renames)                            | PENDING | --      | --        | --          | --    |
| 4.2.4 | Replace Duplicates Batch 1: 5-Copy KismetDevice                   | PENDING | --      | --        | --          | --    |
| 4.2.5 | Replace Duplicates Batch 2: 4-Copy SpectrumData                   | PENDING | --      | --        | --          | --    |
| 4.2.6 | Replace Duplicates Batch 3: 3-Copy Types                          | PENDING | --      | --        | --          | --    |
| 4.2.7 | Replace Duplicates Batch 4: 2-Copy Types (16 types)               | PENDING | --      | --        | --          | --    |
| 4.3.0 | Delete Custom leaflet.d.ts (19 `any` removed)                     | PENDING | --      | --        | --          | --    |
| 4.3.1 | Fix High-Value Targets (17 `any` across 3 files)                  | PENDING | --      | --        | --          | --    |
| 4.3.2 | Fix MCP Dynamic Server (6 `any`)                                  | PENDING | --      | --        | --          | --    |
| 4.3.3 | Fix Wigletotak Pattern (29 `any` across 5 files)                  | PENDING | --      | --        | --          | --    |
| 4.3.4 | Fix Store Any Types (3 `any` across 3 stores)                     | PENDING | --      | --        | --          | --    |
| 4.3.5 | Fix Remaining As-Any Casts (~15 across ~10 files)                 | PENDING | --      | --        | --          | --    |
| 4.3.6 | Fix RTL-433 Global Casts (7 `any`)                                | PENDING | --      | --        | --          | --    |
| 4.3.7 | Fix Kismet Server Cluster (55 `any` across 5 files)               | PENDING | --      | --        | --          | --    |
| 4.3.8 | Remove ESLint Disable Directives (4-8 directives)                 | PENDING | --      | --        | --          | --    |
| 4.3.9 | Fix Remaining Active Any (~34 across ~25 files)                   | PENDING | --      | --        | --          | --    |
| 4.4.0 | Fix Explicit Any Catch Block (1 occurrence)                       | PENDING | --      | --        | --          | --    |
| 4.4.1 | Extend errors.ts Utilities (4 new functions)                      | PENDING | --      | --        | --          | --    |
| 4.4.2 | Batch 1: Server-Side Catches (143 across 47 files)                | PENDING | --      | --        | --          | --    |
| 4.4.3 | Batch 2: Service Layer Catches (95 across 25 files)               | PENDING | --      | --        | --          | --    |
| 4.4.4 | Batch 3: API Route Catches (80 across 51 files)                   | PENDING | --      | --        | --          | --    |
| 4.4.5 | Batch 4: Page Component Catches (38 across 13 files)              | PENDING | --      | --        | --          | --    |
| 4.4.6 | Batch 5-8: UI/Stores/Database/Other Catches (46 across 31 files)  | PENDING | --      | --        | --          | --    |
| 4.4.7 | Zod Schemas: Security-Critical JSON.parse (Tier 1, 15 sites)      | PENDING | --      | --        | --          | --    |
| 4.4.8 | Zod Schemas: Application/Low-Risk JSON.parse (Tier 2+3, 34 sites) | PENDING | --      | --        | --          | --    |
| 4.5.0 | Fix Existing TypeScript + ESLint Errors (GATE)                    | PENDING | --      | --        | --          | --    |
| 4.5.1 | Install knip + Dead Export Analysis                               | PENDING | --      | --        | --          | --    |
| 4.5.2 | ESLint Strictness Escalation (4 rules)                            | PENDING | --      | --        | --          | --    |
| 4.5.3 | Enable noFallthroughCasesInSwitch + noImplicitReturns             | PENDING | --      | --        | --          | --    |
| 4.5.4 | Enable noImplicitOverride                                         | PENDING | --      | --        | --          | --    |
| 4.5.5 | Evaluate noUncheckedIndexedAccess (decision gate)                 | PENDING | --      | --        | --          | --    |
| 4.5.6 | Enable Type-Checked Linting (10 rules, 3 tiers)                   | PENDING | --      | --        | --          | --    |
| 4.5.7 | CI Pipeline Integration (4 scripts)                               | PENDING | --      | --        | --          | --    |

---

## 9. Commit Message Format

```
<type>(phase4.X.Y): <description>

Phase 4.X Task Y: <full task name>
Verified: <verification command and result>

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

Types: `refactor` (dead code deletion, type deduplication, `any` elimination, catch block annotation), `feat` (error utilities, Zod schemas, knip installation, type-checked linting), `fix` (TypeScript errors, ESLint errors, security-relevant test route removal), `chore` (ESLint config, tsconfig.json, CI pipeline, compiler options), `docs` (noUncheckedIndexedAccess evaluation if deferred).

---

**Document End**
