# Data Model: Code Expressiveness Improvement

**Date**: 2026-02-23 (original) | 2026-02-24 (updated with Part C entities) | 2026-02-24 (V3 — all 32 findings)
**Branch**: `016-code-expressiveness`

## Entities

This feature primarily introduces **utility types and functions**, not persistent data entities. The data model describes the TypeScript types that form the abstraction contracts.

### 1. Result Tuple

```typescript
// src/lib/server/result.ts
type Result<T> = [T, null] | [null, Error];
```

**Purpose**: Replace try-catch boilerplate with return-value error handling.
**Relationships**: Used by `safe()` utility. Consumed by route handlers and services.
**Validation**: TypeScript discriminated union — `if (err)` narrows correctly.

### 2. Unified API Error Response

```typescript
// src/lib/server/api/api-response.ts
interface ApiSuccessResponse {
	success: true;
	[key: string]: unknown; // Domain-specific data fields
}

interface ApiErrorResponse {
	success: false;
	error: string;
	details?: unknown; // Optional: Zod validation issues
}
```

**Purpose**: Standardize all API responses per spec FR-014 — every response includes `success: boolean`.
**Relationships**: Enforced by `createHandler()` factory. Consumed by frontend fetch calls and MCP servers.
**Note**: The factory adds `success: true/false` automatically. Routes that already return `{ success: true, ... }` are compatible. Routes that omit `success` will gain it via factory wrapping.

### 3. Handler Options

```typescript
// src/lib/server/api/create-handler.ts
interface HandlerOptions {
	/** Logging context (defaults to URL pathname) */
	method?: string;
	/** Optional Zod schema for request body validation */
	validateBody?: z.ZodType;
	/** Custom HTTP status for specific error types */
	errorStatus?: number;
}
```

**Purpose**: Configure factory behavior per-route without losing default benefits.
**Relationships**: Passed to `createHandler()`.

### 4. Existing Entities (Unchanged)

These entities already exist and are NOT modified by this feature:

- **KismetState** (`src/lib/stores/tactical-map/kismet-store.ts`) — primary store; `src/lib/kismet/stores.ts` (secondary) to be absorbed
- **SignalMarker** (`src/lib/types/signals.ts`) — untouched
- **Zod Schemas** (`src/lib/schemas/*.ts`) — untouched, may be referenced by Superforms

### 5. Environment Schema — Expanded (FR-023, Part C)

```typescript
// src/lib/server/env.ts — expanded from 4 to ~19 vars
const envSchema = z.object({
	// Existing (4)
	NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
	DATABASE_PATH: z.string().min(1).default('./rf_signals.db'),
	KISMET_API_URL: z.string().url(),
	ARGOS_API_KEY: z.string().min(32),
	// Kismet auth/connection
	KISMET_HOST: z.string().default('localhost'),
	KISMET_PORT: z.coerce.number().default(2501),
	KISMET_API_KEY: z.string().default(''),
	KISMET_USER: z.string().default('kismet'),
	KISMET_PASSWORD: z.string().default('kismet'),
	// External API keys (optional)
	ANTHROPIC_API_KEY: z.string().optional(),
	OPENCELLID_API_KEY: z.string().optional(),
	// Public-facing URLs
	PUBLIC_KISMET_API_URL: z.string().default('http://localhost:2501'),
	PUBLIC_HACKRF_API_URL: z.string().default('http://localhost:8092'),
	// Self / CORS
	ARGOS_API_URL: z.string().default('http://localhost:5173'),
	ARGOS_CORS_ORIGINS: z.string().default(''),
	// Third-party service URLs (new)
	GSM_EVIL_URL: z.string().default('http://localhost:8080'),
	OPENWEBRX_URL: z.string().default('http://localhost:8073'),
	BETTERCAP_URL: z.string().default('http://localhost:80'),
	// Temp directory
	ARGOS_TEMP_DIR: z.string().default('') // Resolved at runtime: os.tmpdir()/argos
});
```

**Purpose**: Single source of truth for all environment variables. Zod validates at startup.
**Relationships**: Consumed by all server modules (replacing direct `process.env` reads).
**Validation**: Zod `.parse()` at startup — system exits with clear error on missing required vars.

### 6. Geographic Constants (FR-027, FR-029, Part C)

```typescript
// src/lib/constants/limits.ts — expanded
export const GEO = {
	EARTH_RADIUS_M: 6371000,
	METERS_PER_DEGREE_LAT: 111320 // NEW: export for consumers
} as const;
```

**Purpose**: Single source for geographic magic numbers (replaces 4 hardcoded `6371000` and 1 hardcoded `111320`).
**Relationships**: Consumed by `geo.ts`, `map-helpers.ts`, `status-bar-data.ts`, `kismet.service.ts`, `kismet/devices/+server.ts`.

### 7. Delay Utility (FR-026, Part C)

```typescript
// src/lib/utils/delay.ts — NEW
export const delay = (ms: number): Promise<void> =>
	new Promise<void>((resolve) => setTimeout(resolve, ms));
```

**Purpose**: Replace 38 inline `new Promise(resolve => setTimeout(resolve, N))` patterns.
**Relationships**: Consumed by 21 files across services, stores, and route handlers.
**Note**: Placed in `src/lib/utils/` (not `src/lib/server/`) because some consumers are client-side stores.

### 8. Client-Side Fetch Wrapper (FR-034, Part C)

```typescript
// src/lib/utils/fetch-json.ts — NEW
export async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T | null> {
	try {
		const response = await fetch(url, options);
		if (!response.ok) return null;
		return (await response.json()) as T;
	} catch (error: unknown) {
		console.error(`fetchJSON failed for ${url}:`, error);
		return null;
	}
}
```

**Purpose**: Replace ~37 identical try/catch/return-null fetch patterns across 19 client-side files.
**Relationships**: Consumed by stores (`status-bar-data.ts`, `gsm-evil-page-logic.ts`, `tak-config-logic.ts`) and components (`OverviewPanel.svelte`, `GsmEvilPanel.svelte`).
**Note**: Placed in `src/lib/utils/` (not `src/lib/server/`) — client-side only. Server-side fetch in API routes has different error handling needs and should NOT use this wrapper.

### 9. External API Response Interfaces (FR-035, Part C)

```typescript
// Types placed near their consumers
interface KismetRawDevice {
	/* typed fields replacing Record<string, unknown> */
}
interface OpenCelliDResponse {
	/* lat, lon, accuracy, etc. */
}
interface GpsdResponse {
	/* class, time, lat, lon, etc. */
}
interface OpenMeteoResponse {
	/* temperature, windspeed, etc. */
}
```

**Purpose**: Eliminate ~100+ unsafe `as string`/`as number` casts on external API data.
**Relationships**: Consumed by `kismet/devices/+server.ts`, `cell-tower-service.ts`, `gps-satellite-service.ts`, `status-bar-data.ts`.

## State Transitions

### Route Handler Lifecycle (New)

```
Request → createHandler() →
  ├─ Success: fn(event) returns data → json(data) → Response
  ├─ Validation Error: Zod parse fails → json({ error }, { status: 400 })
  └─ Unexpected Error: catch → errMsg(err) → logger.error → json({ error }, { status: 500 })
```

### Result Tuple Flow (New)

```
safe(() => riskyFn()) →
  ├─ Success: [data, null] → use data
  └─ Failure: [null, Error] → handle error (no try-catch needed)
```
