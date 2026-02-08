# Phase 4.4.7: Zod Schemas for JSON.parse -- Tier 1 Security-Critical Sites

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: CERT MSC07-C (Detect/Remove Dead Code), CERT INT04-C (Enforce Limits)
**Review Panel**: US Cyber Command Engineering Review Board

---

| Field        | Value                                                                     |
| ------------ | ------------------------------------------------------------------------- |
| Phase        | 4.4                                                                       |
| Task         | 4.4.7                                                                     |
| Title        | Zod Schemas for JSON.parse -- Tier 1 Security-Critical Sites              |
| Status       | PLANNED                                                                   |
| Risk Level   | MEDIUM (Zod schemas may reject valid data if too strict)                  |
| Duration     | 1 hour                                                                    |
| Dependencies | None (independent of catch block migration tasks)                         |
| Commit       | `feat: add Zod runtime validation for security-critical JSON.parse sites` |

---

## Objective

Add Zod runtime validation schemas to all 15 security-critical `JSON.parse` call sites that process data from external sources (network, hardware, child processes). These sites are the highest risk for crashing on malformed input or causing undefined behavior from unvalidated type casts.

## Current State Assessment

### JSON.parse Inventory (verified 2026-02-08)

| Category                 | Count |
| ------------------------ | ----- |
| Total JSON.parse calls   | 49    |
| Inside try-catch         | 31    |
| Outside try-catch        | 18    |
| With `as Type` cast only | 19    |
| No validation at all     | 30    |
| Zod-validated            | 0     |

Zod status: installed (v3.25.76), imported in 1 file (`src/lib/server/env.ts`), validates 3 env vars.

## Schema Directory Structure

Create `src/lib/schemas/` with domain-specific schema files:

```
src/lib/schemas/
  index.ts              -- barrel re-exports
  websocket.ts          -- WebSocket message schemas
  hackrf.ts             -- HackRF data/status/config schemas
  usrp.ts               -- USRP data schemas
  kismet.ts             -- Kismet message schemas
  gsm.ts                -- GSM/IMSI data schemas
  gps.ts                -- GPS position schemas
  rtl433.ts             -- RTL-433 signal schemas
  system.ts             -- System stats, hardware details
  agent.ts              -- Agent event schemas
```

## Tier 1 -- Security-Critical Sites (15 total)

These JSON.parse calls process data from external sources (network, hardware, child processes) where malformed input could crash the application or cause undefined behavior.

| #   | File                                                              | Line | Source             | Schema Needed      |
| --- | ----------------------------------------------------------------- | ---- | ------------------ | ------------------ |
| 1   | src/lib/server/websocket-server.ts                                | 71   | WebSocket client   | WebSocketMessage   |
| 2   | src/lib/server/kismet/webSocketManager.ts                         | 409  | WebSocket client   | ClientMessage      |
| 3   | src/lib/server/kismet/api_client.ts                               | 268  | Kismet SSE stream  | KismetEventData    |
| 4   | src/lib/server/websockets.ts                                      | 71   | WebSocket client   | WebSocketEvent     |
| 5   | src/lib/server/wireshark.ts                                       | 248  | tshark stdout      | PacketArray        |
| 6   | src/lib/server/wireshark.ts                                       | 299  | tshark stdout      | PacketData         |
| 7   | src/routes/api/gps/position/+server.ts                            | 300  | gpsd stream        | GpsdMessage        |
| 8   | src/routes/api/gsm-evil/imsi/+server.ts                           | 42   | shell exec stdout  | ImsiResult         |
| 9   | src/routes/api/gsm-evil/imsi-data/+server.ts                      | 37   | shell exec stdout  | ImsiDataResult     |
| 10  | src/routes/api/tactical-map/cell-towers/+server.ts                | 95   | shell exec stdout  | CellTowerResult    |
| 11  | src/routes/api/hardware/details/+server.ts                        | 269  | lsusb/lspci stdout | HardwareDetailLine |
| 12  | src/lib/server/bettercap/apiClient.ts                             | 32   | shell exec stdout  | BettercapResponse  |
| 13  | src/lib/server/agent/runtime.ts                                   | 154  | SSE stream         | AgentEvent         |
| 14  | src/lib/server/agent/tool-execution/adapters/websocket-adapter.ts | 164  | WS response        | ToolResponse       |
| 15  | src/lib/server/agent/tool-execution/adapters/mcp-adapter.ts       | 158  | MCP response       | McpResult          |

## Execution Steps

### Step 1: Create Schema Directory

```bash
mkdir -p src/lib/schemas
```

### Step 2: Create Schema Files

For each domain, create a schema file with Zod definitions. Example for `src/lib/schemas/websocket.ts`:

```typescript
import { z } from 'zod';

export const WebSocketMessageSchema = z.object({
	type: z.string(),
	data: z.unknown().optional(),
	id: z.string().optional(),
	timestamp: z.number().optional()
});

export type WebSocketMessage = z.infer<typeof WebSocketMessageSchema>;
```

### Step 3: Apply Validation at Each JSON.parse Site

#### Implementation Pattern for Sites Already Inside try-catch

When JSON.parse is already wrapped in try-catch, the Zod validation replaces the `as` cast but the try-catch remains for the JSON.parse SyntaxError:

```typescript
try {
	const parsed = JSON.parse(data.toString());
	const result = MySchema.safeParse(parsed);
	if (!result.success) {
		console.warn('Invalid data shape:', result.error.format());
		return;
	}
	const message = result.data;
	// ... use message
} catch (error: unknown) {
	console.error('JSON parse failed:', getErrorMessage(error));
}
```

#### Implementation Pattern for Sites NOT Inside try-catch

The 18 JSON.parse calls currently outside try-catch need wrapping. For each:

1. Wrap the JSON.parse + safeParse in a try-catch with `(error: unknown)`.
2. Handle both JSON.parse SyntaxError and Zod validation failure.

```typescript
try {
	const parsed = JSON.parse(rawData);
	const result = MySchema.safeParse(parsed);
	if (!result.success) {
		console.warn('Invalid data shape:', result.error.format());
		return defaultValue;
	}
	const validated = result.data;
	// ... use validated
} catch (error: unknown) {
	console.error('JSON parse failed:', getErrorMessage(error));
	return defaultValue;
}
```

#### Applying at a JSON.parse Site (Concrete Example)

BEFORE (`src/lib/server/websocket-server.ts:71`):

```typescript
const message = JSON.parse(data.toString()) as WebSocketMessage;
```

AFTER:

```typescript
import { WebSocketMessageSchema } from '$lib/schemas/websocket';

const parsed = JSON.parse(data.toString());
const result = WebSocketMessageSchema.safeParse(parsed);
if (!result.success) {
	console.warn('Invalid WebSocket message:', result.error.format());
	return;
}
const message = result.data;
```

### Key Rules

1. Always use `safeParse()`, never `parse()` -- crash-free validation.
2. Log validation failures at `warn` level with `result.error.format()`.
3. Handle the failure path explicitly (return, continue, or use a default value).
4. Replace the `as Type` cast with `result.data` which is fully typed.

### Step 4: Create Barrel Export

Create `src/lib/schemas/index.ts`:

```typescript
export * from './websocket';
export * from './hackrf';
export * from './usrp';
export * from './kismet';
export * from './gsm';
export * from './gps';
export * from './rtl433';
export * from './system';
export * from './agent';
```

## Verification

| #   | Check                             | Command                                                                                                                                                                                                           | Expected  |
| --- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| 1   | Schema directory exists           | `ls src/lib/schemas/`                                                                                                                                                                                             | 10 files  |
| 2   | Zod import count                  | `grep -rn "from 'zod'" --include='*.ts' src/lib/schemas/ \| wc -l`                                                                                                                                                | >= 9      |
| 3   | No unguarded JSON.parse in Tier 1 | `grep -n 'JSON\.parse.*) as ' src/lib/server/websocket-server.ts src/lib/server/kismet/webSocketManager.ts src/lib/server/kismet/api_client.ts src/lib/server/websockets.ts src/lib/server/wireshark.ts \| wc -l` | 0         |
| 4   | TypeScript compiles               | `npx tsc --noEmit 2>&1 \| tail -5`                                                                                                                                                                                | No errors |
| 5   | safeParse usage count             | `grep -rn 'safeParse' --include='*.ts' src/ \| wc -l`                                                                                                                                                             | >= 15     |

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
git revert <zod-tier1-commit-sha>
```

## Out of Scope

- Tier 2 (Application-Critical) sites -- covered in Phase-4.4.8
- Tier 3 (Low Risk) sites -- covered in Phase-4.4.8
- The 35 parameterless `catch {}` blocks -- intentionally error-swallowing

## Cross-References

- **Independent of**: Phase-4.4.0 through Phase-4.4.6 (catch block migrations)
- **Followed by**: Phase-4.4.8 (Tier 2 + Tier 3 Zod schemas)
- **Related**: Phase 2.2.4 (JSON Parse Validation) -- security-focused JSON handling
- **Source**: Phase 4.4 monolithic plan, Section 10 (Task 4.4.8, Tier 1)
