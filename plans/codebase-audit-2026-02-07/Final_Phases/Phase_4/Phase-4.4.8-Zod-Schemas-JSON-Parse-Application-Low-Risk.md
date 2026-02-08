# Phase 4.4.8: Zod Schemas for JSON.parse -- Tier 2 Application-Critical and Tier 3 Low Risk

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: CERT MSC07-C, CERT INT04-C
**Review Panel**: US Cyber Command Engineering Review Board

---

| Field        | Value                                                                            |
| ------------ | -------------------------------------------------------------------------------- |
| Phase        | 4.4                                                                              |
| Task         | 4.4.8                                                                            |
| Title        | Zod Schemas for JSON.parse -- Tier 2 and Tier 3 Sites                            |
| Status       | PLANNED                                                                          |
| Risk Level   | MEDIUM (Zod schemas may reject valid data if too strict)                         |
| Duration     | 1 hour                                                                           |
| Dependencies | Phase-4.4.7 (schema directory and barrel export must exist)                      |
| Commit       | `feat: add Zod runtime validation for application and low-risk JSON.parse sites` |

---

## Objective

Add Zod runtime validation schemas to all remaining 28 JSON.parse call sites (19 Tier 2 + 9 Tier 3), completing the runtime validation coverage for the entire codebase. After this task, zero `JSON.parse` sites use unvalidated `as Type` casts.

## Current State Assessment

After Phase-4.4.7:

- Tier 1 (Security-Critical): 15 sites validated
- Tier 2 (Application-Critical): 19 sites unvalidated -- **this task**
- Tier 3 (Low Risk): 9 sites unvalidated -- **this task**
- Duplicate schemas (usrp-api.ts mirrors api.ts): 6 sites -- **this task**

---

## Tier 2 -- Application-Critical (19 sites)

These sites parse SSE/EventSource data in the frontend. Malformed data causes UI errors but not server crashes.

| #   | File                                                       | Line | Source         | Schema Needed       |
| --- | ---------------------------------------------------------- | ---- | -------------- | ------------------- |
| 1   | src/routes/gsm-evil/+page.svelte                           | 1125 | SSE stream     | GsmScanEvent        |
| 2   | src/routes/rtl-433/+page.svelte                            | 206  | SSE stream     | Rtl433Signal        |
| 3   | src/routes/droneid/+page.svelte                            | 91   | SSE stream     | DroneIdEvent        |
| 4   | src/routes/tactical-map-simple/+page.svelte                | 906  | fetch response | SystemInfo          |
| 5   | src/lib/services/usrp/api.ts                               | 41   | SSE stream     | UsrpSweepData       |
| 6   | src/lib/services/usrp/api.ts                               | 55   | WebSocket msg  | UsrpSweepData       |
| 7   | src/lib/services/usrp/api.ts                               | 65   | SSE stream     | UsrpSweepData       |
| 8   | src/lib/services/hackrf/api.ts                             | 129  | SSE stream     | HackrfSweepData     |
| 9   | src/lib/services/hackrf/api.ts                             | 171  | SSE stream     | HackrfStatus        |
| 10  | src/lib/services/hackrf/api.ts                             | 213  | SSE stream     | HackrfConfig        |
| 11  | src/lib/services/hackrf/api.ts                             | 221  | SSE stream     | HackrfConfigChange  |
| 12  | src/lib/services/hackrf/api.ts                             | 238  | SSE stream     | HackrfRawData       |
| 13  | src/lib/services/hackrf/api.ts                             | 250  | SSE stream     | HackrfRecoveryData  |
| 14  | src/lib/services/gsm-evil/server.ts                        | 136  | SSE stream     | GsmScanEvent        |
| 15  | src/lib/services/websocket/base.ts                         | 222  | WebSocket msg  | Generic (z.unknown) |
| 16  | src/lib/services/localization/coral/CoralAccelerator.v2.ts | 96   | child stdout   | CoralMessage        |
| 17  | src/lib/services/localization/coral/CoralAccelerator.ts    | 43   | child stdout   | CoralMessage        |
| 18  | src/lib/components/dashboard/AgentChatPanel.svelte         | 169  | SSE stream     | AgentChatEvent      |
| 19  | src/lib/components/dashboard/TerminalTabContent.svelte     | 120  | WebSocket msg  | TerminalMessage     |

---

## Tier 3 -- Low Risk (9 sites)

These sites parse localStorage or configuration files. Malformed data causes UI state loss but no security impact.

| #   | File                                                        | Line | Source       | Schema Needed       |
| --- | ----------------------------------------------------------- | ---- | ------------ | ------------------- |
| 1   | src/lib/stores/rtl433Store.ts                               | 73   | localStorage | Rtl433StoreState    |
| 2   | src/lib/stores/gsmEvilStore.ts                              | 82   | localStorage | GsmStoreState       |
| 3   | src/lib/stores/dashboard/terminalStore.ts                   | 29   | localStorage | TerminalStoreState  |
| 4   | src/lib/stores/dashboard/toolsStore.ts                      | 14   | localStorage | z.array(z.string()) |
| 5   | src/lib/stores/dashboard/toolsStore.ts                      | 29   | localStorage | z.array(z.string()) |
| 6   | src/lib/server/mcp/config-generator.ts                      | 137  | fs.readFile  | MCPConfiguration    |
| 7   | src/lib/server/db/geo.ts                                    | 78   | DB column    | z.record(z.unknown) |
| 8   | src/lib/server/db/geo.ts                                    | 90   | DB column    | z.record(z.unknown) |
| 9   | src/lib/services/usrp/sweep-manager/buffer/BufferManager.ts | 227  | child stdout | UsrpBufferLine      |

---

## Duplicate Schema Note

6 entries in `src/lib/services/hackrf/usrp-api.ts` (lines 141, 170, 213, 221, 238, 250) are exact duplicates of the patterns in `src/lib/services/hackrf/api.ts`. They share the same schemas once created:

- HackrfSweepData (line 141 mirrors api.ts:129)
- HackrfStatus (line 170 mirrors api.ts:171)
- HackrfConfig (line 213 mirrors api.ts:213)
- HackrfConfigChange (line 221 mirrors api.ts:221)
- HackrfRawData (line 238 mirrors api.ts:238)
- HackrfRecoveryData (line 250 mirrors api.ts:250)

Import the schemas from `$lib/schemas/hackrf` in both files. Do NOT create duplicate schema definitions.

## Execution Steps

### Step 1: Verify Prerequisite

```bash
ls src/lib/schemas/index.ts
# Expected: file exists (Phase-4.4.7 must be complete)
```

### Step 2: Process Tier 2 Sites (19 files)

For each Tier 2 site:

1. Identify the schema needed from the table above.
2. Check if the schema already exists in `src/lib/schemas/` (created in Phase-4.4.7 for a related type).
3. If not, create it in the appropriate domain schema file.
4. Apply the safeParse pattern at the JSON.parse site.
5. Replace the `as Type` cast with `result.data`.

### Step 3: Process Tier 3 Sites (9 files)

Same procedure. For localStorage sites, Tier 3 schemas can be more lenient:

```typescript
// For localStorage, use a fallback default on failure
try {
	const parsed = JSON.parse(localStorage.getItem('key') ?? '');
	const result = MySchema.safeParse(parsed);
	if (!result.success) {
		// localStorage corrupted; reset to default
		return defaultState;
	}
	return result.data;
} catch (_error: unknown) {
	// JSON.parse failed; reset to default
	return defaultState;
}
```

### Step 4: Apply to Duplicate usrp-api.ts Sites (6 files)

Import the same schemas used in `api.ts` and apply identical safeParse patterns.

### Step 5: Update Barrel Export

Ensure `src/lib/schemas/index.ts` re-exports all new schemas added in this task.

## Verification

### Batch Completion Verification

```bash
# Confirm Zod import count increased from Phase-4.4.7 baseline
grep -rn "from 'zod'" --include='*.ts' --include='*.svelte' src/ | wc -l
# Expected: >= 10 (schema files + env.ts)

# Confirm schemas directory is complete
ls src/lib/schemas/
# Expected: index.ts, websocket.ts, hackrf.ts, usrp.ts, kismet.ts, gsm.ts, gps.ts, rtl433.ts, system.ts, agent.ts

# Confirm no unguarded JSON.parse with 'as' cast remains
grep -rn 'JSON\.parse.*\bas\b' --include='*.ts' --include='*.svelte' src/ \
  | grep -v 'safeParse' | wc -l
# Expected: 0

# Type check
npx tsc --noEmit 2>&1 | tail -5
```

| #   | Check                             | Command                                                                                                                          | Expected  |
| --- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | --------- |
| 1   | Zod imports                       | `grep -rn "from 'zod'" --include='*.ts' --include='*.svelte' src/ \| wc -l`                                                      | >= 10     |
| 2   | Schema directory                  | `ls src/lib/schemas/*.ts \| wc -l`                                                                                               | >= 10     |
| 3   | No unguarded JSON.parse + as cast | `grep -rn 'JSON\.parse.*) as ' --include='*.ts' --include='*.svelte' src/ \| grep -v node_modules \| grep -v safeParse \| wc -l` | 0         |
| 4   | TypeScript compiles               | `npx tsc --noEmit 2>&1 \| tail -5`                                                                                               | No errors |
| 5   | safeParse total usage             | `grep -rn 'safeParse' --include='*.ts' --include='*.svelte' src/ \| wc -l`                                                       | >= 43     |

---

## Appendix B: JSON.parse Site Inventory (49 total)

All 49 sites listed across three tiers:

- Tier 1 (Security-Critical): 15 sites (Phase-4.4.7)
- Tier 2 (Application-Critical): 19 sites (this task)
- Tier 3 (Low Risk): 9 sites (this task)
- Covered by duplicate schemas (usrp-api.ts mirrors api.ts): 6 sites (this task)

Total: 15 + 19 + 9 + 6 = 49

---

## Final Verification Checklist (Phase 4.4 Gate)

Run each command and confirm the expected output after ALL Phase 4.4 tasks are complete (4.4.0 through 4.4.8).

### Check 12.1: Zero Untyped Catches

```bash
# Total untyped catch blocks across entire src/
grep -rn 'catch\s*(\s*[a-zA-Z_][a-zA-Z0-9_]*\s*)' --include='*.ts' --include='*.svelte' src/ \
  | grep -v ': unknown' | wc -l
# MUST BE: 0
```

### Check 12.2: Zero `: any` Catches

```bash
grep -rn 'catch\s*(\s*\w\+\s*:\s*any' --include='*.ts' --include='*.svelte' src/ | wc -l
# MUST BE: 0
```

### Check 12.3: TypeScript Compiles Clean

```bash
npx tsc --noEmit 2>&1 | grep -c 'error TS'
# MUST BE: 0 (or same as baseline before this phase)
```

### Check 12.4: getErrorMessage() Exported

```bash
grep 'export function getErrorMessage' src/lib/types/errors.ts
# MUST MATCH: export function getErrorMessage(error: unknown): string
```

### Check 12.5: Zod Schema Coverage

```bash
# Schema files exist
ls src/lib/schemas/*.ts | wc -l
# MUST BE: >= 10

# JSON.parse sites with 'as' cast (unvalidated) should be 0
grep -rn 'JSON\.parse.*) as ' --include='*.ts' --include='*.svelte' src/ \
  | grep -v node_modules | grep -v safeParse | wc -l
# MUST BE: 0
```

### Check 12.6: No Regressions

```bash
# Run existing tests
npm run test:unit 2>&1 | tail -10

# Run type checker
npm run typecheck 2>&1 | tail -5

# Lint check (no new warnings from error handling)
npm run lint 2>&1 | grep -c 'error'
```

### Check 12.7: Catch Block Census (Post-Migration)

```bash
echo "=== Post-Migration Census ==="
echo -n "Total catch with params: "
grep -rn 'catch\s*(\s*\w\+' --include='*.ts' --include='*.svelte' src/ | wc -l
echo -n "Typed : unknown: "
grep -rn 'catch\s*(\s*\w\+\s*:\s*unknown' --include='*.ts' --include='*.svelte' src/ | wc -l
echo -n "Parameterless catch {}: "
grep -rn 'catch\s*{' --include='*.ts' --include='*.svelte' src/ | wc -l
echo -n "Untyped (MUST BE 0): "
grep -rn 'catch\s*(\s*[a-zA-Z_][a-zA-Z0-9_]*\s*)' --include='*.ts' --include='*.svelte' src/ \
  | grep -v ': unknown' | wc -l
# Expected: 676 total, 676 typed unknown, 35 parameterless, 0 untyped
```

---

## Risk Assessment

| Risk                                        | Likelihood | Impact | Mitigation                                                                      |
| ------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------- |
| Zod schema too strict (rejects valid data)  | MEDIUM     | MEDIUM | Use safeParse + warn, not throw; test with real data                            |
| Zod schema too loose (accepts invalid data) | LOW        | LOW    | Progressive tightening; start with z.object + z.unknown() for unverified fields |
| Performance impact of Zod validation        | LOW        | LOW    | safeParse adds ~1-5 microseconds per call; negligible vs JSON.parse             |

## Rollback Strategy

### Zod Schema Rollback

If Zod schemas are too strict and reject valid data in production:

1. Replace `safeParse` with `JSON.parse` + `as Type` cast (the previous state)
2. Fix the schema to accept the valid data shape
3. Re-apply the validated version

No data loss is possible because `safeParse` never throws -- it returns `{ success: false }`.

### Git-Based Rollback

```bash
git revert <zod-tier2-tier3-commit-sha>
```

## What Phase 4.4 Does NOT Change

- `.catch()` inline callbacks (104 occurrences) -- separate scope
- Parameterless `catch {}` blocks (35 occurrences) -- intentionally error-swallowing, legitimate pattern
- Error handling logic (what happens after catch) -- no behavioral change
- Error classes or factory functions in errors.ts -- only additions
- Runtime behavior of any existing code path -- annotation-only for catch blocks

## Cross-References

- **Depends on**: Phase-4.4.7 (schema directory must exist)
- **Completes**: All 49 JSON.parse sites validated with Zod
- **Related**: Phase 2.2.4 (JSON Parse Validation) -- security-focused JSON handling
- **Related**: Phase 3.4.3 (Zod Schema Validation High-Risk Routes) -- complementary validation
- **Source**: Phase 4.4 monolithic plan, Section 10 (Task 4.4.8, Tiers 2-3) and Section 12 (Verification Checklist)
