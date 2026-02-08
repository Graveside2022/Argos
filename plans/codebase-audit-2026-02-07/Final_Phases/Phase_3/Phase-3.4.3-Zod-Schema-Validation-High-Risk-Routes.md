# Phase 3.4.3: Zod Schema Validation for High-Risk API Routes

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases (Corrective Action CA-06 from adversarial audit)
**Standards Compliance**: BARR-C Rule 8.4 (validate all external input), OWASP A03:2021 (Injection), CERT INT04-C (enforce input constraints)
**Review Panel**: US Cyber Command Engineering Review Board

---

**Phase**: 3 -- Code Quality, Constants, Linting, and Defensive Coding
**Sub-Phase**: 3.4 -- Defensive Coding Foundations
**Task ID**: 3.4.3
**Risk Level**: MEDIUM -- Behavioral change: previously-accepted invalid input now returns 400
**Prerequisites**: None (independent, but benefits from Phase 3.2 constants for range bounds)
**Blocks**: Phase 4 (Type Safety benefits from `z.infer<>` compile-time types)
**Estimated Files Touched**: 10
**Standards**: BARR-C Rule 8.4, OWASP A03:2021, CERT INT04-C

---

## Objective

Add Zod schema validation to the 10 highest-risk API routes -- those that control hardware or process sensitive data. Currently, Zod is installed but used in only 1 of 38 API routes with `request.json()`.

## Current State Assessment

| Metric                         | Verified Value | Target                                          | Verification Command                                                |
| ------------------------------ | -------------- | ----------------------------------------------- | ------------------------------------------------------------------- |
| API routes with Zod schemas    | 1              | 11 (1 existing + 10 new)                        | `grep -rl "z\.\|zod" src/routes/api/ --include="*.ts" \| wc -l`     |
| API routes with request.json() | 38             | All 38 validated (remaining 28 in future phase) | `grep -rl "request.json" src/routes/api/ --include="*.ts" \| wc -l` |
| Zod package installed          | Yes (^3.25.76) | No change needed                                | `grep "zod" package.json`                                           |

## Scope

### 10 Priority Routes with Schema Specifications

| #   | Route                                              | Risk                                             | Schema Elements                                                                                                                                                                    |
| --- | -------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `src/routes/api/hackrf/start-sweep/+server.ts`     | HackRF hardware control                          | `frequencies: z.array(z.object({ start: z.number().min(1).max(6000), end: z.number().min(1).max(6000) })).min(1).max(10), cycleTime: z.number().int().min(1).max(300).default(10)` |
| 2   | `src/routes/api/gsm-evil/control/+server.ts`       | GSM hardware control, shell command construction | `action: z.enum(['start', 'stop']), frequency: z.string().regex(/^\d+(\.\d+)?$/), gain: z.number().int().min(0).max(100)`                                                          |
| 3   | `src/routes/api/droneid/+server.ts`                | Bettercap process control                        | `action: z.enum(['start', 'stop', 'status'])`                                                                                                                                      |
| 4   | `src/routes/api/kismet/control/+server.ts`         | Kismet service control                           | `action: z.enum(['start', 'stop', 'restart'])`                                                                                                                                     |
| 5   | `src/routes/api/signals/+server.ts`                | Spatial database query                           | `lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180), radiusMeters: z.number().min(1).max(100000), limit: z.number().int().min(1).max(10000)`                     |
| 6   | `src/routes/api/rf/start-sweep/+server.ts`         | RF sweep control                                 | Same as #1                                                                                                                                                                         |
| 7   | `src/routes/api/gsm-evil/scan/+server.ts`          | GSM scan initiation                              | `startFrequency: z.number(), endFrequency: z.number(), gain: z.number().int()`                                                                                                     |
| 8   | `src/routes/api/bettercap/control/+server.ts`      | Bettercap network control                        | `action: z.enum(['start', 'stop', 'status']), interface: z.string().regex(/^[a-zA-Z0-9]+$/)`                                                                                       |
| 9   | `src/routes/api/kismet/scripts/execute/+server.ts` | Script execution (**CRITICAL**)                  | `scriptPath: z.string(), args: z.array(z.string()).optional()` **PLUS path traversal validation** (see below)                                                                      |
| 10  | `src/routes/api/agent/stream/+server.ts`           | AI agent query                                   | `message: z.string().max(4096), model: z.string().optional()`                                                                                                                      |

### Route #9 Special Handling: Path Traversal Validation

Route #9 (`kismet/scripts/execute`) is a CRITICAL security target. The Zod schema alone is insufficient -- the `scriptPath` must be validated against path traversal attacks:

```typescript
import path from 'path';

const ALLOWED_SCRIPT_DIR = '/opt/argos/scripts'; // or wherever scripts are stored

const ExecuteSchema = z.object({
	scriptPath: z.string().refine(
		(p) => {
			const resolved = path.resolve(ALLOWED_SCRIPT_DIR, p);
			return resolved.startsWith(ALLOWED_SCRIPT_DIR);
		},
		{ message: 'Script path must be within allowed directory' }
	),
	args: z.array(z.string()).optional()
});
```

**WARNING**: `startsWith()` alone is bypassable. The `path.resolve()` + `startsWith()` combination is required to canonicalize the path first.

### Schema Application Pattern

Every route must follow this exact pattern:

```typescript
import { z } from 'zod';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const StartSweepSchema = z.object({
	frequencies: z
		.array(
			z.object({
				start: z.number().min(1).max(6000),
				end: z.number().min(1).max(6000)
			})
		)
		.min(1)
		.max(10),
	cycleTime: z.number().int().min(1).max(300).default(10)
});

export const POST: RequestHandler = async ({ request }) => {
	const raw = await request.json();
	const result = StartSweepSchema.safeParse(raw);
	if (!result.success) {
		return json(
			{
				success: false,
				error: 'Invalid request parameters',
				details: result.error.flatten().fieldErrors
			},
			{ status: 400 }
		);
	}
	const { frequencies, cycleTime } = result.data;
	// ... proceed with validated data
};
```

Key requirements:

1. Use `safeParse()`, not `parse()` -- never throw for user input
2. Return HTTP 400 with structured error details on validation failure
3. Destructure from `result.data` after validation -- never use `raw` after this point
4. Error response includes `fieldErrors` for client-side form validation

## Execution Steps

### Step 1: Verify Zod Is Installed

```bash
grep "zod" package.json
# Expected: "zod": "^3.25.76" (or similar)
```

### Step 2: Add Schema to Each Route (Routes 1-10)

For each route:

1. Define the Zod schema at the top of the file
2. Replace `const body = await request.json()` with the safeParse pattern
3. Update the rest of the handler to use `result.data`

### Step 3: Special Handling for Route #9

Add path traversal validation using `path.resolve()` + `startsWith()` in a Zod `.refine()` call.

### Step 4: Verify Schema Count

```bash
grep -rl "z\.\|zod\|Schema" src/routes/api/ --include="*.ts" | wc -l
# Expected: 10+
```

### Step 5: Run Full Verification

```bash
npm run typecheck  # Must pass
npm run test:unit  # Must pass
npm run build      # Must pass
```

## Commit Message

```
feat(validation): add Zod schema validation to 10 highest-risk API routes
```

## Verification

| #   | Check                           | Command                                                                                | Expected |
| --- | ------------------------------- | -------------------------------------------------------------------------------------- | -------- |
| 1   | Zod schemas in API routes       | `grep -rl "z\.\|zod\|Schema" src/routes/api/ --include="*.ts" \| wc -l`                | 10+      |
| 2   | safeParse used (not parse)      | `grep -rn "\.parse(" src/routes/api/ --include="*.ts" \| grep -v "safeParse" \| wc -l` | 0        |
| 3   | Path traversal check in scripts | `grep -n "path.resolve" src/routes/api/kismet/scripts/execute/+server.ts`              | Present  |
| 4   | 400 responses on invalid input  | `grep -rn "status: 400" src/routes/api/ --include="*.ts" \| wc -l`                     | 10+      |
| 5   | TypeScript compiles             | `npm run typecheck`                                                                    | Exit 0   |
| 6   | Build succeeds                  | `npm run build`                                                                        | Exit 0   |
| 7   | Unit tests pass                 | `npm run test:unit`                                                                    | Exit 0   |

## Risk Assessment

| Risk                                             | Likelihood | Impact   | Mitigation                                                                                                                                                           |
| ------------------------------------------------ | ---------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Zod validation rejects previously-accepted input | MEDIUM     | LOW      | Schemas use `.default()` for optional fields. Existing valid input will continue to work. Invalid input that previously silently corrupted data will now return 400. |
| Incorrect schema constraints reject valid input  | LOW        | MEDIUM   | Schema constraints are based on hardware specifications (e.g., HackRF max 6 GHz). Test with real hardware.                                                           |
| Performance overhead from Zod parsing            | VERY LOW   | VERY LOW | Zod parsing is negligible compared to hardware I/O. Schemas are simple objects, not nested trees.                                                                    |
| Path traversal validation false positive         | LOW        | LOW      | Use `path.resolve()` to canonicalize before checking. Symlinks within the allowed directory are still valid.                                                         |

## Success Criteria

- [ ] 10 API routes have Zod schema validation
- [ ] All schemas use `safeParse()` (never `parse()`)
- [ ] Invalid input returns HTTP 400 with structured error details
- [ ] Route #9 (scripts/execute) has path traversal validation
- [ ] No route uses raw `request.json()` data after the safeParse call
- [ ] TypeScript compiles without errors
- [ ] Build succeeds
- [ ] Unit tests pass

## Cross-References

- **Depends on**: Nothing (independent, but benefits from Phase 3.2 constants for named bounds like `RF_BANDS.HACKRF_MAX_FREQ`)
- **Depended on by**: Phase 4 (Type Safety -- `z.infer<typeof Schema>` provides compile-time types)
- **Depended on by**: Phase 2 (Security Hardening -- Zod schemas prevent injection at the validation boundary)
- **Related**: Phase 3.4.0 (Runtime Assertions) -- assertions validate function internals; Zod validates API boundaries
- **Related**: Phase 2.1.2 (Shell Injection Elimination) -- Zod schemas are the first defense against injection
- **Related**: Phase 2.1.4 (SSRF Vulnerability Elimination) -- URL validation can use Zod `.url()` refinements

## Execution Tracking

| Step | Description                      | Status  | Started | Completed | Verified By |
| ---- | -------------------------------- | ------- | ------- | --------- | ----------- |
| 1    | Verify Zod installed             | PENDING | --      | --        | --          |
| 2    | Add schemas (routes 1-8, 10)     | PENDING | --      | --        | --          |
| 3    | Add schema + path traversal (#9) | PENDING | --      | --        | --          |
| 4    | Verify schema count              | PENDING | --      | --        | --          |
| 5    | Run full verification            | PENDING | --      | --        | --          |
