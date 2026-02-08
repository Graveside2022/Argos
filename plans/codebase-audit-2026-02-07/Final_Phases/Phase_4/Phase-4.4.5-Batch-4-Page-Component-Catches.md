# Phase 4.4.5: Batch 4 -- Page Component Catch Block Migration

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: CERT ERR00-C, MISRA C++ Rule 15-3-4
**Review Panel**: US Cyber Command Engineering Review Board

---

| Field        | Value                                                                  |
| ------------ | ---------------------------------------------------------------------- |
| Phase        | 4.4                                                                    |
| Task         | 4.4.5                                                                  |
| Title        | Batch 4 -- Page Component Catch Block Migration                        |
| Status       | PLANNED                                                                |
| Risk Level   | LOW (mechanical transformation, no behavioral change)                  |
| Duration     | 1 hour                                                                 |
| Dependencies | Phase-4.4.1 (errors.ts extensions must be complete)                    |
| Commit       | `fix: annotate page component catch blocks with : unknown (batch 4/8)` |

---

## Objective

Migrate all 38 untyped catch blocks across 13 Svelte files in `src/routes/` to explicit `catch (error: unknown)` annotations, applying the appropriate transformation pattern (A through E, defined in Phase-4.4.2) based on error variable usage in each catch body.

## Current State Assessment

- **Untyped catches in scope**: 38
- **Files in scope**: 13 (all `.svelte` files in `src/routes/`)
- **Priority**: P2 (client-side page components)

## Processing Order (descending by catch count)

| Order | File                                                      | Catches |
| ----- | --------------------------------------------------------- | ------- |
| 1     | src/routes/tactical-map-simple/+page.svelte               | 8       |
| 2     | src/routes/gsm-evil/+page.svelte                          | 7       |
| 3     | src/routes/rtl-433/+page.svelte                           | 5       |
| 4     | src/routes/rfsweep/+page.svelte                           | 4       |
| 5     | src/routes/viewspectrum/+page.svelte                      | 3       |
| 6     | src/routes/droneid/+page.svelte                           | 3       |
| 7     | src/routes/hackrfsweep/+page.svelte                       | 2       |
| 8     | src/routes/test-db-client/+page.svelte                    | 1       |
| 9     | src/routes/tactical-map-simple/integration-example.svelte | 1       |
| 10    | src/routes/kismet/+page.svelte                            | 1       |
| 11    | src/routes/kismet-dashboard/+page.svelte                  | 1       |
| 12    | src/routes/hackrf/+page.svelte                            | 1       |
| 13    | src/routes/gsm-evil/LocalIMSIDisplay.svelte               | 1       |

## Svelte-Specific Considerations

### TypeScript in Svelte Files

In `.svelte` files, TypeScript runs in the `<script lang="ts">` block. The import path uses `$lib/types/errors` (SvelteKit alias). Catch blocks inside reactive statements (`$:`) and event handlers follow the same transformation patterns as TypeScript files.

### Import Placement

The `import { getErrorMessage } from '$lib/types/errors';` statement must be placed inside the `<script lang="ts">` block, alongside other imports. Example:

```svelte
<script lang="ts">
	import { getErrorMessage } from '$lib/types/errors';
	// ... other imports

	async function fetchData() {
		try {
			const res = await fetch('/api/data');
			data = await res.json();
		} catch (error: unknown) {
			errorMessage = getErrorMessage(error);
		}
	}
</script>
```

### Reactive Statement Catch Blocks

Some `.svelte` files have catch blocks inside `$:` reactive statements. These follow the same pattern:

```svelte
$: {
	try {
		parsedValue = JSON.parse(rawInput);
	} catch (error: unknown) {
		parseError = getErrorMessage(error);
	}
}
```

## Execution Steps

### Step 1: Verify Prerequisite

```bash
grep -c 'export function getErrorMessage' src/lib/types/errors.ts
# Expected: 1 (Phase-4.4.1 must be complete)
```

### Step 2: Process Each File

For each of the 13 files in processing order:

1. Open the `.svelte` file.
2. Locate each `catch (varName)` without `: unknown` in the `<script>` block.
3. Determine the pattern (A through E, per Phase-4.4.2) based on how `varName` is used.
4. Apply the matching transformation.
5. Add `import { getErrorMessage } from '$lib/types/errors';` if Pattern B, C, or D is applied and the import does not already exist.
6. Save and proceed to the next file.

### Step 3: Per-File Verification

After modifying each file, run:

```bash
# Verify no untyped catches remain in this file
grep -n 'catch\s*(\s*[a-zA-Z_][a-zA-Z0-9_]*\s*)' FILE | grep -v ': unknown'
# Expected: 0 results
```

## Verification

### Batch Completion Verification

```bash
grep -rn 'catch\s*(\s*[a-zA-Z_][a-zA-Z0-9_]*\s*)' --include='*.svelte' src/routes/ \
  | grep -v ': unknown' | grep -v ': any' | wc -l
# Expected: 0
```

| #   | Check                           | Command                                                                                                                                 | Expected  |
| --- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| 1   | Zero untyped in routes/ .svelte | `grep -rn 'catch\s*(\s*[a-zA-Z_][a-zA-Z0-9_]*\s*)' --include='*.svelte' src/routes/ \| grep -v ': unknown' \| grep -v ': any' \| wc -l` | 0         |
| 2   | TypeScript compiles             | `npx tsc --noEmit 2>&1 \| tail -5`                                                                                                      | No errors |
| 3   | Svelte check passes             | `npm run check 2>&1 \| tail -5`                                                                                                         | No errors |

## Risk Assessment

| Risk                                                     | Likelihood | Impact | Mitigation                                               |
| -------------------------------------------------------- | ---------- | ------ | -------------------------------------------------------- |
| Type error from adding `: unknown`                       | LOW        | LOW    | Pattern-based transformation; tsc validates              |
| Runtime behavior change                                  | NONE       | --     | `: unknown` is annotation-only; no codegen               |
| Svelte reactive statement break                          | NONE       | --     | Catch annotation does not affect reactivity              |
| getErrorMessage() returns different string than .message | LOW        | LOW    | getErrorMessage() preserves .message for Error instances |

## Rollback Strategy

### Git-Based Rollback

```bash
# Revert the entire batch
git revert <batch-4-commit-sha>
```

Commit message: `fix: annotate page component catch blocks with : unknown (batch 4/8)`

### Partial Rollback

If a specific file causes issues:

1. `git diff HEAD~1 -- path/to/file.svelte` to see exactly what changed
2. `git checkout HEAD~1 -- path/to/file.svelte` to restore the single file
3. The file will revert to untyped catches, which is valid TypeScript (just not compliant)

## Out of Scope

The 35 parameterless `catch {}` blocks are intentionally error-swallowing and do NOT require migration. See Phase-4.4.6 Appendix for the full list.

## Cross-References

- **Depends on**: Phase-4.4.1 (errors.ts extensions)
- **Preceded by**: Phase-4.4.4 (Batch 3: API routes)
- **Followed by**: Phase-4.4.6 (Batches 5-8: UI, stores, database, other)
- **Source**: Phase 4.4 monolithic plan, Section 8 (Task 4.4.6)
