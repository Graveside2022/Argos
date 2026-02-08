# Phase 4.4.4: Batch 3 -- API Route Catch Block Migration

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: CERT ERR00-C, MISRA C++ Rule 15-3-4
**Review Panel**: US Cyber Command Engineering Review Board

---

| Field        | Value                                                             |
| ------------ | ----------------------------------------------------------------- |
| Phase        | 4.4                                                               |
| Task         | 4.4.4                                                             |
| Title        | Batch 3 -- API Route Catch Block Migration                        |
| Status       | PLANNED                                                           |
| Risk Level   | LOW (mechanical transformation, no behavioral change)             |
| Duration     | 1.5 hours                                                         |
| Dependencies | Phase-4.4.1 (errors.ts extensions must be complete)               |
| Commit       | `fix: annotate API route catch blocks with : unknown (batch 3/8)` |

---

## Objective

Migrate all 80 untyped catch blocks across 51 files in `src/routes/api/` to explicit `catch (error: unknown)` annotations, applying the appropriate transformation pattern (A through E, defined in Phase-4.4.2) based on error variable usage in each catch body.

## Current State Assessment

- **Untyped catches in scope**: 80
- **Files in scope**: 51
- **Priority**: P1 (API routes are the HTTP boundary layer)

## Processing Order

### Top 16 Files (multi-catch, descending by count)

| Order | File                                                       | Catches |
| ----- | ---------------------------------------------------------- | ------- |
| 1     | src/routes/api/rtl-433/control/+server.ts                  | 7       |
| 2     | src/routes/api/agent/tools/+server.ts                      | 7       |
| 3     | src/routes/api/rf/status/+server.ts                        | 3       |
| 4     | src/routes/api/gsm-evil/intelligent-scan-stream/+server.ts | 3       |
| 5     | src/routes/api/droneid/+server.ts                          | 3       |
| 6     | src/routes/api/tools/execute/+server.ts                    | 2       |
| 7     | src/routes/api/rtl-433/stream/+server.ts                   | 2       |
| 8     | src/routes/api/rf/data-stream/+server.ts                   | 2       |
| 9     | src/routes/api/kismet/stop/+server.ts                      | 2       |
| 10    | src/routes/api/kismet/status/+server.ts                    | 2       |
| 11    | src/routes/api/kismet/start/+server.ts                     | 2       |
| 12    | src/routes/api/hackrf/[...path]/+server.ts                 | 2       |
| 13    | src/routes/api/gsm-evil/tower-location/+server.ts          | 2       |
| 14    | src/routes/api/gsm-evil/health/+server.ts                  | 2       |
| 15    | src/routes/api/cell-towers/nearby/+server.ts               | 2       |
| 16    | src/routes/api/agent/stream/+server.ts                     | 2       |

### 35 Single-Catch Files (alphabetical order)

| Order | File                                                   | Catches |
| ----- | ------------------------------------------------------ | ------- |
| 17    | src/routes/api/bettercap/control/+server.ts            | 1       |
| 18    | src/routes/api/bettercap/devices/+server.ts            | 1       |
| 19    | src/routes/api/bettercap/status/+server.ts             | 1       |
| 20    | src/routes/api/btle/control/+server.ts                 | 1       |
| 21    | src/routes/api/companion/[app]/control/+server.ts      | 1       |
| 22    | src/routes/api/debug/spectrum-data/+server.ts          | 1       |
| 23    | src/routes/api/gnuradio/status/+server.ts              | 1       |
| 24    | src/routes/api/gsm-evil/imsi-data/+server.ts           | 1       |
| 25    | src/routes/api/gsm-evil/scan/+server.ts                | 1       |
| 26    | src/routes/api/hardware/acquire/+server.ts             | 1       |
| 27    | src/routes/api/hardware/force-release/+server.ts       | 1       |
| 28    | src/routes/api/hardware/release/+server.ts             | 1       |
| 29    | src/routes/api/hardware/scan/+server.ts                | 1       |
| 30    | src/routes/api/hardware/status/[hardwareId]/+server.ts | 1       |
| 31    | src/routes/api/kismet/devices/list/+server.ts          | 1       |
| 32    | src/routes/api/kismet/devices/stats/+server.ts         | 1       |
| 33    | src/routes/api/kismet/interfaces/+server.ts            | 1       |
| 34    | src/routes/api/kismet/start-safe/+server.ts            | 1       |
| 35    | src/routes/api/kismet/start-with-adapter/+server.ts    | 1       |
| 36    | src/routes/api/mcp/+server.ts                          | 1       |
| 37    | src/routes/api/pagermon/control/+server.ts             | 1       |
| 38    | src/routes/api/rf/usrp-power/+server.ts                | 1       |
| 39    | src/routes/api/rtl-433/protocols/+server.ts            | 1       |
| 40    | src/routes/api/rtl-433/status/+server.ts               | 1       |
| 41    | src/routes/api/system/stats/+server.ts                 | 1       |
| 42    | src/routes/api/terminal/shells/+server.ts              | 1       |
| 43    | src/routes/api/tools/scan/+server.ts                   | 1       |
| 44    | src/routes/api/tools/status/[toolId]/+server.ts        | 1       |
| 45    | src/routes/api/wifite/control/+server.ts               | 1       |
| 46    | src/routes/api/wifite/targets/+server.ts               | 1       |
| 47    | src/routes/api/wireshark/interfaces/+server.ts         | 1       |
| 48    | src/routes/api/wireshark/start/+server.ts              | 1       |
| 49    | src/routes/api/wireshark/status/+server.ts             | 1       |
| 50    | src/routes/api/wireshark/stop/+server.ts               | 1       |
| 51    | src/routes/api/ws/+server.ts                           | 1       |

## API Route Pattern

Most API routes follow this standard pattern. Apply consistently:

### BEFORE

```typescript
export const GET: RequestHandler = async () => {
	try {
		const data = await someOperation();
		return json({ success: true, data });
	} catch (error) {
		console.error('Failed:', error);
		return json({ success: false, error: (error as Error).message }, { status: 500 });
	}
};
```

### AFTER

```typescript
import { getErrorMessage } from '$lib/types/errors';

export const GET: RequestHandler = async () => {
	try {
		const data = await someOperation();
		return json({ success: true, data });
	} catch (error: unknown) {
		console.error('Failed:', error);
		return json({ success: false, error: getErrorMessage(error) }, { status: 500 });
	}
};
```

Key changes:

1. Add `: unknown` annotation to catch variable
2. Replace `(error as Error).message` with `getErrorMessage(error)`
3. Add import for `getErrorMessage` at top of file

## Execution Steps

### Step 1: Verify Prerequisite

```bash
grep -c 'export function getErrorMessage' src/lib/types/errors.ts
# Expected: 1 (Phase-4.4.1 must be complete)
```

### Step 2: Process Top 16 Multi-Catch Files

Process files 1-16 in order. Each file has 2-7 catch blocks that need transformation. Determine the pattern for each catch block individually.

### Step 3: Process 35 Single-Catch Files

Process files 17-51 in alphabetical order. Each has exactly 1 catch block. Most will follow the standard API route pattern shown above.

### Step 4: Per-File Verification

After modifying each file, run:

```bash
# Verify no untyped catches remain in this file
grep -n 'catch\s*(\s*[a-zA-Z_][a-zA-Z0-9_]*\s*)' FILE | grep -v ': unknown'
# Expected: 0 results
```

## Verification

### Batch Completion Verification

```bash
grep -rn 'catch\s*(\s*[a-zA-Z_][a-zA-Z0-9_]*\s*)' --include='*.ts' src/routes/api/ \
  | grep -v ': unknown' | grep -v ': any' | wc -l
# Expected: 0
```

| #   | Check                   | Command                                                                                                                                 | Expected  |
| --- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| 1   | Zero untyped in api/    | `grep -rn 'catch\s*(\s*[a-zA-Z_][a-zA-Z0-9_]*\s*)' --include='*.ts' src/routes/api/ \| grep -v ': unknown' \| grep -v ': any' \| wc -l` | 0         |
| 2   | TypeScript compiles     | `npx tsc --noEmit 2>&1 \| tail -5`                                                                                                      | No errors |
| 3   | getErrorMessage imports | `grep -rn "getErrorMessage" --include='*.ts' src/routes/api/ \| wc -l`                                                                  | >= 40     |

## Risk Assessment

| Risk                                                     | Likelihood | Impact | Mitigation                                               |
| -------------------------------------------------------- | ---------- | ------ | -------------------------------------------------------- |
| Type error from adding `: unknown`                       | LOW        | LOW    | Pattern-based transformation; tsc validates              |
| Runtime behavior change                                  | NONE       | --     | `: unknown` is annotation-only; no codegen               |
| getErrorMessage() returns different string than .message | LOW        | LOW    | getErrorMessage() preserves .message for Error instances |

## Rollback Strategy

### Git-Based Rollback

```bash
# Revert the entire batch
git revert <batch-3-commit-sha>
```

Commit message: `fix: annotate API route catch blocks with : unknown (batch 3/8)`

### Partial Rollback

If a specific file causes issues:

1. `git diff HEAD~1 -- path/to/file.ts` to see exactly what changed
2. `git checkout HEAD~1 -- path/to/file.ts` to restore the single file
3. The file will revert to untyped catches, which is valid TypeScript (just not compliant)

## Out of Scope

The 35 parameterless `catch {}` blocks are intentionally error-swallowing and do NOT require migration. See Phase-4.4.6 Appendix for the full list.

## Cross-References

- **Depends on**: Phase-4.4.1 (errors.ts extensions)
- **Preceded by**: Phase-4.4.3 (Batch 2: Services)
- **Followed by**: Phase-4.4.5 (Batch 4: Page components)
- **Source**: Phase 4.4 monolithic plan, Section 7 (Task 4.4.5)
