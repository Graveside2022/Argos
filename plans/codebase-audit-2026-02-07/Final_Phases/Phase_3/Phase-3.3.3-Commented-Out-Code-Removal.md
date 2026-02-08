# Phase 3.3.3: Commented-Out Code Removal

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: MISRA Rule 3.1 (no commented-out code), NASA/JPL Rule 31 (no dead code)
**Review Panel**: US Cyber Command Engineering Review Board

---

**Phase**: 3 -- Code Quality, Constants, Linting, and Defensive Coding
**Sub-Phase**: 3.3 -- ESLint Enforcement, TODO Resolution, and Error Hygiene
**Task ID**: 3.3.3
**Risk Level**: LOW -- Deleting dead code, no behavior changes
**Prerequisites**: None (independent task, can run in parallel)
**Blocks**: None
**Estimated Files Touched**: ~30
**Standards**: MISRA Rule 3.1 (no commented-out code in production), NASA/JPL Rule 31 (no dead code)

---

## Objective

Remove all 48 blocks of commented-out code (3+ consecutive lines) across 30 files (~173 lines of dead code). Commented-out code is dead code that creates maintenance confusion and violates MISRA and NASA/JPL standards.

## Correction History

| Date       | Correction ID | Description                                                                                                                                                                                                                                                                                                                                                           |
| ---------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-02-08 | CA-03         | Original inventory identified 19 blocks across 12 files (68 lines). Adversarial re-verification found **48 blocks across 30 files (~173 lines)**. The original inventory used an overly restrictive definition of "commented-out code" that missed blocks without obvious code keywords (e.g., commented HTML, commented CSS-in-JS, commented configuration objects). |

## Current State Assessment

| Metric                               | Original (2026-02-07) | Corrected (2026-02-08) |
| ------------------------------------ | --------------------- | ---------------------- |
| Commented-out code blocks (3+ lines) | 19                    | 48                     |
| Files affected                       | 12                    | ~30                    |
| Total dead lines                     | 68                    | ~173                   |

## Scope

### Complete Inventory (Original 19 Blocks)

| #   | File                                                         | Lines   | Size    | Description                | Action |
| --- | ------------------------------------------------------------ | ------- | ------- | -------------------------- | ------ |
| 1   | `src/lib/components/dashboard/DashboardMap.svelte`           | 28-34   | 7 lines | Old import block           | DELETE |
| 2   | `src/routes/api/bettercap/control/+server.ts`                | 17-22   | 6 lines | Commented bettercap config | DELETE |
| 3   | `src/routes/api/hackrf/data-stream/+server.ts`               | 44-47   | 4 lines | Old data handler           | DELETE |
| 4   | `src/routes/api/hackrf/data-stream/+server.ts`               | 197-200 | 4 lines | Old cleanup code           | DELETE |
| 5   | `src/routes/api/gsm-evil/intelligent-scan-stream/+server.ts` | 154-157 | 4 lines | Old stream logic           | DELETE |
| 6   | `src/routes/api/rf/data-stream/+server.ts`                   | 156-159 | 4 lines | Old RF handler             | DELETE |
| 7   | `src/lib/server/wifite/processManager.ts`                    | 296-299 | 4 lines | Dead wifite code           | DELETE |
| 8   | `src/lib/server/wifite/processManager.ts`                    | 118-120 | 3 lines | Alternate iw command       | DELETE |
| 9   | `src/lib/server/kismet/kismet_controller.ts`                 | 552-555 | 4 lines | Old controller logic       | DELETE |
| 10  | `src/lib/server/bettercap/apiClient.ts`                      | 81-83   | 3 lines | Old API client code        | DELETE |
| 11  | `src/hooks.server.ts`                                        | 157-159 | 3 lines | Error handler remnant      | DELETE |
| 12  | `src/routes/gsm-evil/+page.svelte`                           | 987-989 | 3 lines | Old GSM UI code            | DELETE |
| 13  | `src/routes/gsm-evil/+page.svelte`                           | 994-996 | 3 lines | Old GSM UI code            | DELETE |
| 14  | `src/routes/api/hackrf/start-sweep/+server.ts`               | 24-26   | 3 lines | Old sweep start            | DELETE |
| 15  | `src/routes/api/rf/start-sweep/+server.ts`                   | 31-33   | 3 lines | Duplicate of #14           | DELETE |
| 16  | `src/lib/stores/dashboard/agentContextStore.ts`              | 114-116 | 3 lines | Old store logic            | DELETE |
| 17  | `src/lib/services/websocket/test-connection.ts`              | 82-84   | 3 lines | Dead test code             | DELETE |
| 18  | `src/lib/services/localization/coral/integration-example.ts` | 8-10    | 3 lines | Dead example code          | DELETE |
| 19  | `src/lib/components/dashboard/DashboardMap.svelte`           | 354-356 | 3 lines | Old map code               | DELETE |

**Subtotal (original inventory)**: 68 lines of dead code across 12 files.

### Additional 29 Blocks (Discovered 2026-02-08)

~29 additional blocks across ~18 additional files (~105 lines). These blocks were missed by the original inventory because they contained commented-out logic without obvious code keywords (e.g., commented HTML, commented CSS-in-JS, commented configuration objects).

**The executing agent MUST re-run the verification grep at execution time to produce the complete inventory**:

```bash
# Find all blocks of 3+ consecutive // comment lines:
grep -Prn '(^\s*//.*\n){3,}' src/ --include="*.ts" --include="*.svelte" | head -100
```

### Triage Rule

Each discovered block must be triaged:

- **If it contains executable code** (imports, function calls, variable declarations, control flow, HTML elements, CSS properties, configuration objects): **DELETE**
- **If it is purely documentary** (design notes, algorithm explanations, license headers, API documentation): **KEEP**

Comments are not documentation. Code that is preserved "just in case" belongs in git history, not in production source files.

## Execution Steps

### Step 1: Re-Run Discovery Grep

```bash
grep -Prn '(^\s*//.*\n){3,}' src/ --include="*.ts" --include="*.svelte" | head -100
```

Compare against the 19-item inventory above. Identify the additional ~29 blocks.

### Step 2: Triage Each Block

For each block, determine: executable code (DELETE) or documentary comment (KEEP).

### Step 3: Delete All Executable Commented-Out Code

Work through all ~48 blocks. Remove the commented lines. Do not leave empty line gaps where code was removed.

### Step 4: Verify

```bash
npm run typecheck  # Must pass
npm run build      # Must pass
```

## Commit Message

```
refactor(cleanup): remove 48 commented-out code blocks (~173 lines) across 30 files
```

## Verification

| #   | Check                                       | Command                                                                            | Expected                                         |
| --- | ------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------ |
| 1   | No blocks of 3+ consecutive commented lines | `grep -Prn '(^\s*//.*\n){3,}' src/ --include="*.ts" --include="*.svelte" \| wc -l` | 0 (or near-zero, only documentary blocks remain) |
| 2   | TypeScript compiles                         | `npm run typecheck`                                                                | Exit 0                                           |
| 3   | Build succeeds                              | `npm run build`                                                                    | Exit 0                                           |
| 4   | Unit tests pass                             | `npm run test:unit`                                                                | Exit 0                                           |

**Note**: The grep heuristic may produce false positives for legitimate multi-line documentary comments. Manual review is required for the final verification step.

## Risk Assessment

| Risk                                             | Likelihood | Impact | Mitigation                                                   |
| ------------------------------------------------ | ---------- | ------ | ------------------------------------------------------------ |
| Deleting commented code removes useful reference | LOW        | LOW    | Code is in git history; comments are not documentation       |
| Deleting documentary comment by mistake          | LOW        | LOW    | Triage rule distinguishes executable code from documentation |
| Line number shifts break other plan references   | MEDIUM     | LOW    | Other plan files reference by description, not line number   |

## Success Criteria

- [ ] All 48 blocks of commented-out executable code removed
- [ ] No blocks of 3+ consecutive comment lines containing executable code remain
- [ ] Documentary comments preserved where appropriate
- [ ] TypeScript compiles without errors
- [ ] Build succeeds
- [ ] Unit tests pass

## Cross-References

- **Depends on**: Nothing (independent task)
- **Depended on by**: Nothing (independent task)
- **Related**: Phase 1 (Dead Code Removal) -- Phase 1 removes dead files; this task removes dead code within live files
- **Related**: Phase 3.3.4 (TODO Resolution) -- some TODOs may be in commented-out blocks

## Execution Tracking

| Step | Description              | Status  | Started | Completed | Verified By |
| ---- | ------------------------ | ------- | ------- | --------- | ----------- |
| 1    | Re-run discovery grep    | PENDING | --      | --        | --          |
| 2    | Triage each block        | PENDING | --      | --        | --          |
| 3    | Delete executable blocks | PENDING | --      | --        | --          |
| 4    | Verify build integrity   | PENDING | --      | --        | --          |
