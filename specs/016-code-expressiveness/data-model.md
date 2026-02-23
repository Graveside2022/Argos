# Data Model: Code Expressiveness Improvement

**Date**: 2026-02-23 | **Branch**: `016-code-expressiveness`

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
