# Feature Specification: Code Expressiveness Improvement

**Feature Branch**: `016-code-expressiveness`
**Created**: 2026-02-23
**Status**: Draft
**Input**: User description: "Improve code expressiveness through shared abstractions — route handler factory, result types, DRY utilities, dead export cleanup, and circular dependency resolution. Close client-side tooling gaps with production-grade libraries. Raise overall expressiveness GPA from C+ to B+."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Developer Writes a New API Route Handler (Priority: P1)

A developer adding a new API endpoint to Argos writes only the business logic — not boilerplate. The route handler factory provides try-catch wrapping, error message extraction, logging, and JSON error response formatting automatically. The developer's route file contains 60–70% less ceremony than today's pattern.

**Why this priority**: The 66 existing route handlers share an identical skeleton (imports, errMsg(), try-catch, logger.error, json error response). A single `createHandler()` factory eliminates the most pervasive duplication in the codebase (estimated 1,000–1,500 lines). This is the highest-impact, most visible improvement.

**Independent Test**: Can be fully tested by creating one new route handler using the factory and verifying it handles success, error, and validation failure paths correctly — then migrating 3 existing routes and confirming identical behavior.

**Acceptance Scenarios**:

1. **Given** a developer needs to create a new GET endpoint, **When** they use the handler factory, **Then** they write only the business logic function and the factory handles try-catch, logging, and error formatting
2. **Given** a route handler throws an unexpected error, **When** the factory catches it, **Then** it logs the error with the route context and returns a properly formatted JSON error response with appropriate status code
3. **Given** a route handler returns successfully, **When** the factory processes the result, **Then** it returns the result as JSON with no additional wrapping needed by the developer
4. **Given** a developer needs custom error handling for a specific route, **When** they use the factory, **Then** they can override the default error behavior without losing the other benefits

---

### User Story 2 - Developer Eliminates Duplicated Utility Functions (Priority: P1)

A developer working across the codebase encounters `errMsg()` in one canonical location instead of 19 copy-pasted copies. Similarly, `execFileAsync` (promisified `execFile`) is imported from a single shared module instead of being redeclared in 36 separate files. Other common patterns (parameter parsing, validation error detection) are also consolidated. Additionally, 2 genuinely abandoned abstractions (`safeErrorResponse()` with 0 consumers, `safeJsonParse()` with 3 consumers) are either integrated into the factory pattern or removed. Note: `safeParseWithHandling()` was originally listed as abandoned but live verification found 30+ call sites across 14 files — it is actively used and will be kept.

**Why this priority**: These are the lowest-risk, highest-certainty improvements. Each is a mechanical find-and-replace that reduces cognitive load and ensures bug fixes propagate everywhere. Tied with P1 because it is a prerequisite for the route handler factory. The truly abandoned abstractions (`safeErrorResponse` at 0% adoption, `safeJsonParse` at ~5%) prove that optional utilities fail without an enforcement mechanism — the factory provides that mechanism. `safeParseWithHandling` (~45% adoption, 30+ call sites) is a counter-example: a well-written utility that achieved organic adoption.

**Independent Test**: Can be tested by searching the codebase for `function errMsg` and `promisify(execFile)` — after migration, each pattern appears exactly once (in the shared module) and zero times in route handlers or service files.

**Acceptance Scenarios**:

1. **Given** the codebase has 19 copies of `errMsg()`, **When** the consolidation is complete, **Then** exactly 1 canonical definition exists and all 19 former sites import it
2. **Given** 36 files declare their own `execFileAsync`, **When** the consolidation is complete, **Then** exactly 1 shared `execFileAsync` exists and all 36 files import it
3. **Given** a bug is found in error message extraction, **When** a developer fixes the shared `errMsg()`, **Then** all 66 route handlers receive the fix automatically
4. **Given** 2 existing abstractions have 0–5% adoption (`safeErrorResponse` at 0%, `safeJsonParse` at ~5%), **When** consolidation is complete, **Then** `safeErrorResponse` is absorbed into the route handler factory and removed; `safeJsonParse` is evaluated for absorption or retention. `safeParseWithHandling` (30+ call sites, ~45% adoption) is kept as-is.

---

### User Story 3 - Developer Uses Result Types for Error Handling (Priority: P2)

A developer calling a fallible operation uses a `safe()` wrapper that returns a `[data, error]` tuple instead of writing try-catch blocks. This pattern is available for async operations and provides type-safe error handling without the indentation and ceremony of try-catch.

**Why this priority**: 150 files contain try-catch blocks. Many follow the same pattern: catch, extract message, log, return error JSON. The result type pattern complements the route handler factory — the factory handles route-level errors, while `safe()` handles errors within business logic that need conditional handling.

**Independent Test**: Can be tested by writing the `safe()` utility with unit tests, then converting 3 existing try-catch sites to use it and verifying identical behavior.

**Acceptance Scenarios**:

1. **Given** a developer needs to call a function that may throw, **When** they use `safe()`, **Then** they get a typed tuple where success yields `[data, null]` and failure yields `[null, Error]` without writing try-catch
2. **Given** an async operation fails inside `safe()`, **When** the error is caught, **Then** the error is returned as the second tuple element and the data element is null
3. **Given** a developer needs to handle different error types differently, **When** they use `safe()`, **Then** they can pattern-match on the error type without nested try-catch blocks

---

### User Story 4 - Developer Encounters No Dead Exports (Priority: P2)

A developer exploring the codebase via autocomplete or documentation sees only exports that are actually used. Dead exports (25+ functions and constants that are exported but never imported) have been identified and either removed or unexported.

**Why this priority**: Dead exports create false signals during code exploration — developers spend time understanding functions that nothing calls. Removal is low-risk and purely subtractive. It improves the signal-to-noise ratio of the codebase.

**Independent Test**: Can be tested by running a dead-export analysis tool and confirming zero exported symbols are unused.

**Acceptance Scenarios**:

1. **Given** 25+ exported symbols are never imported, **When** the cleanup is complete, **Then** each has been either removed (if unused internally too) or unexported (if used only within its own file)
2. **Given** a developer uses IDE autocomplete on a module, **When** they see exported functions, **Then** every listed function is actively used by at least one consumer
3. **Given** a previously-dead export is actually needed later, **When** a developer needs it, **Then** they re-export it explicitly (the function body is preserved if used internally)

---

### User Story 5 - Developer Encounters No Circular Dependencies (Priority: P3)

A developer working on the codebase sees clean one-directional dependency flow. The 8 circular dependency cycles (6 introduced by complexity reduction helper extraction, 1 pre-existing, 1 new) are resolved by restructuring imports to flow in one direction.

**Why this priority**: Circular dependencies cause subtle issues (load-order bugs, tree-shaking failures, harder reasoning about module boundaries). These are lower priority because they don't affect runtime behavior today but improve long-term maintainability.

**Independent Test**: Can be tested by running `madge --circular` and confirming zero cycles.

**Acceptance Scenarios**:

1. **Given** 8 circular dependency cycles exist, **When** the resolution is complete, **Then** `madge --circular` reports zero cycles
2. **Given** a helper file was extracted from a service file during complexity reduction, **When** the circular dep is resolved, **Then** shared types or constants are moved to a separate types module that both files import from
3. **Given** a pre-existing cycle between process-lifecycle.ts and process-manager.ts, **When** it is resolved, **Then** the dependency flows in one direction without behavioral change

---

### User Story 6 - Developer Uses Higher-Order Wrappers for Cross-Cutting Concerns (Priority: P3)

A developer needing retry logic, timeout handling, or structured logging for an async operation uses shared higher-order function wrappers instead of reimplementing these patterns ad-hoc.

**Why this priority**: The codebase already uses higher-order functions for data transformation (496 declarative usages) but not as an abstraction mechanism. This extends an existing strength. Lower priority because individual instances of retry/timeout logic are less duplicated than the route handler pattern.

**Independent Test**: Can be tested by writing the wrapper functions with unit tests and converting 2–3 existing retry/timeout patterns to use them.

**Acceptance Scenarios**:

1. **Given** a developer needs retry logic for an external service call, **When** they use a retry wrapper, **Then** the function is retried on failure with configurable backoff and attempt limits
2. **Given** a developer needs a timeout on a hardware operation, **When** they use a timeout wrapper, **Then** the function rejects with a timeout error if it exceeds the configured limit
3. **Given** existing ad-hoc retry logic in a service, **When** it is migrated to the shared wrapper, **Then** the behavior is identical but the code is shorter and consistent with other retry sites

---

### User Story 7 - API Consumers Receive Consistent Error Responses (Priority: P1)

An API consumer (frontend client, MCP server, or external script) receives a predictable response shape from every Argos API endpoint. Success responses always include `{ success: true, ...data }`. Error responses always include `{ success: false, error: string }` with appropriate HTTP status codes. No more guessing whether the error field is a string, an object, or missing entirely.

**Why this priority**: P1 because this is a prerequisite for the route handler factory — the factory needs to know what shape to produce. Currently 5 distinct error response patterns exist across routes, and 39 unsafe `(error as Error)` casts across 23 files indicate systematic type confusion. Unifying this at the factory level means it's done once, correctly, forever.

**Independent Test**: Can be tested by calling every API endpoint with invalid input and verifying every error response matches the unified shape.

**Acceptance Scenarios**:

1. **Given** a route handler throws an unexpected error, **When** the factory catches it, **Then** the response is `{ success: false, error: "<message>" }` with status 500 — never an object, never undefined
2. **Given** a route receives invalid input that fails Zod validation, **When** the factory processes the validation failure, **Then** the response is `{ success: false, error: "<message>", details: [...] }` with status 400
3. **Given** 39 instances of `(error as Error)` exist across 23 files, **When** the migration is complete, **Then** zero unsafe error casts remain — all error extraction goes through type-safe utilities

---

### User Story 8 - Developer Uses Production-Grade Client-Side Libraries for Common UI Patterns (Priority: P2)

A developer building a data table, a long scrollable list, a validated form, or a toast notification uses well-maintained, headless libraries that integrate with the Lunaris design system instead of hand-rolling these patterns. The tooling gaps identified in the codebase analysis — tables without sorting/filtering, forms without schema validation, lists without virtualization, and an unused toast dependency — are closed with libraries that have 1,000+ GitHub stars, active maintenance, and Svelte 5 compatibility.

**Why this priority**: P2 because these are client-side improvements that complement the server-side abstractions (P1). Each library fills a gap where custom code is either missing, incomplete, or more complex than necessary. The key insight: `svelte-sonner` (1,208 stars, 628K downloads/month) is already installed but has zero imports; `bits-ui` (3,073 stars) and `shadcn` are already dependencies; `@tanstack/table-core` (27,731 stars) integrates via an existing shadcn-svelte data-table helper.

**Independent Test**: Can be tested by adding one data table with sorting, one virtual list, and one validated form to existing pages — then verifying they render correctly with Lunaris styling.

**Acceptance Scenarios**:

1. **Given** a developer needs a sortable, filterable data table, **When** they use `@tanstack/table-core` via the shadcn-svelte `data-table` helper, **Then** they get headless table state management with sorting, filtering, and pagination that renders through existing Lunaris-styled `Table` components
2. **Given** a page displays 1,000+ signal entries, **When** the developer uses Virtua's `VList`, **Then** only visible rows render, maintaining smooth scrolling at 60fps with a 3kB bundle cost
3. **Given** a developer builds a configuration form (e.g., GSM Evil settings), **When** they use `sveltekit-superforms` with Zod schemas, **Then** they get server+client validation, error messages, and accessible form structure without hand-writing validation logic
4. **Given** an API operation succeeds or fails, **When** the UI needs to notify the user, **Then** `svelte-sonner` provides styled toast notifications consistent with the Lunaris dark theme
5. **Given** a REST endpoint needs client-side caching and background refetching, **When** the developer uses `@tanstack/svelte-query` v6, **Then** they get automatic cache management, loading states, and error handling with Svelte 5 runes — without replacing existing WebSocket-fed stores

---

### Edge Cases

- What if `@tanstack/svelte-query` is used for a WebSocket-fed endpoint? It should NOT be — WebSocket data stays in existing Svelte stores. TanStack Query is only for REST endpoints that benefit from caching (device status, signal history queries). The spec explicitly scopes this.
- What if `sveltekit-superforms` doesn't fully support Svelte 5 runes mode? Superforms works with Svelte 5 in legacy compatibility mode today. Full runes API is planned for v3. Current version is functional and production-safe — the runes migration is additive, not breaking.
- What if Virtua's Svelte adapter has issues with Svelte 5 snippets? Virtua 298K weekly downloads and active maintenance (pushed Feb 22, 2026) with explicit Svelte support. The snippet API is the standard Svelte 5 child rendering pattern.
- How do shadcn-svelte data-table helpers interact with TanStack Table v9 when it releases? The helpers use `@tanstack/table-core` directly, not the framework adapter. v9 core API is backward-compatible. Migration path is clean.

- What happens when a route handler factory wraps a handler that already has its own try-catch? The inner try-catch still works; the factory only catches unhandled exceptions that escape the inner handler.
- How does dead export removal interact with MCP servers that may call functions via string-based references? MCP servers communicate via HTTP API (localhost:5173) — they do not import Argos modules directly. No risk.
- What if resolving a circular dependency requires moving types to a new file, increasing file count? Only introduce a shared types file when 3+ modules need the same types. Otherwise, move the type to the lower-dependency module.
- What happens when `safe()` wraps a function that throws a non-Error value (e.g., a string)? The `safe()` utility normalizes all thrown values to Error instances.
- How does the route handler factory interact with SvelteKit's existing error handling in `hooks.server.ts`? The factory operates at the route level (inside `+server.ts`). The hooks middleware operates at the request level (before routing). They are complementary, not conflicting.
- What about the existing abstractions that already tried to solve these problems? `safeErrorResponse` (0 consumers) and `safeJsonParse` (3 consumers) are absorbed into the factory. `safeParseWithHandling` (30+ call sites, ~45% adoption) is a success story and is kept as-is. The key difference: `safeParseWithHandling` provides unique Zod-specific value; the other two overlap with what the factory does better.
- What if a route currently returns a non-standard error shape that frontend code depends on? The unified error type is backward-compatible with `{ success: false, error: string }` which is the most common existing shape. Routes that return additional fields (like `conflictingService` in GSM Evil) can extend the base shape via the factory's options.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST provide a shared `errMsg()` utility that extracts error messages from unknown error values, replacing all 19 copy-pasted definitions
- **FR-002**: System MUST provide a shared `execFileAsync()` utility wrapping `promisify(execFile)`, replacing all 36 duplicate declarations
- **FR-003**: System MUST provide a route handler factory function for API route handlers that handles try-catch wrapping, error logging, and JSON error response formatting
- **FR-004**: The route handler factory MUST preserve SvelteKit's `RequestHandler` type signature so existing route type inference continues to work
- **FR-005**: The route handler factory MUST allow handlers to access the full SvelteKit `RequestEvent` (url, params, request, locals, etc.)
- **FR-006**: System MUST provide a `safe()` utility that converts thrown exceptions into `[data, error]` tuple returns for type-safe error handling
- **FR-007**: The `safe()` utility MUST normalize non-Error thrown values (strings, numbers, objects) into proper Error instances
- **FR-008**: System MUST identify and remove or unexport all dead exports (exported symbols with zero importers)
- **FR-009**: System MUST resolve all 8 circular dependency cycles to achieve zero cycles as reported by dependency analysis
- **FR-010**: System MUST provide at minimum retry and timeout higher-order wrappers for cross-cutting async concerns
- **FR-011**: All shared utilities MUST be placed in domain-specific modules (not catch-all utils files), per project convention
- **FR-012**: All changes MUST maintain 100% backward compatibility — no behavioral changes to API responses, error formats, or logging output
- **FR-013**: All existing tests MUST continue to pass after each phase of migration
- **FR-014**: System MUST define a unified API error response type so all routes return a consistent shape (success boolean, optional data, optional error string) — eliminating the current inconsistency where some routes return `{ success, error }`, others `{ status, message }`, and others `{ error }`
- **FR-015**: System MUST eliminate all unsafe `(error as Error)` type casts (39 confirmed instances across 23 files — original estimate of 129 included non-error-context assertions) by routing error handling through the shared `errMsg()` utility or the route handler factory, which perform proper type narrowing
- **FR-016**: System MUST consolidate or deprecate the 2 abandoned abstractions (`safeErrorResponse` with 0 consumers, `safeJsonParse` with 3 consumers) — their functionality should be absorbed into the route handler factory or removed if fully superseded. `safeParseWithHandling` (30+ call sites, actively used) is explicitly KEPT.
- **FR-017**: System MUST integrate `@tanstack/table-core` via the shadcn-svelte `data-table` helper to provide headless data tables with sorting, filtering, and pagination that render through existing Lunaris-styled Table components
- **FR-018**: System MUST integrate Virtua (`virtua`) to provide virtual scrolling for long lists (signal entries, log viewers, scan results) with the `VList` component
- **FR-019**: System MUST integrate `sveltekit-superforms` with Zod schema validation and `formsnap` for accessible form components — applied to configuration forms, settings pages, and any user input flows
- **FR-020**: System MUST activate the already-installed `svelte-sonner` dependency (currently zero imports) to provide toast notifications for API success/error feedback across the UI
- **FR-021**: System MUST optionally integrate `@tanstack/svelte-query` v6 for REST-only endpoints that benefit from client-side caching and background refetching — this MUST NOT replace existing WebSocket-fed Svelte stores
- **FR-022**: System MUST unify the dual Kismet store architecture (two stores independently fed by WebSocket and REST) into a single store with WebSocket as primary data source and REST as fallback

### Key Entities

- **Route Handler Factory**: A function that wraps route business logic with standardized error handling, logging, and response formatting — consumed by all API `+server.ts` files
- **Result Tuple**: A return type representing success `[T, null]` or failure `[null, Error]` — used as an alternative to try-catch within business logic
- **Shared Utilities**: Canonical definitions of commonly duplicated functions (`errMsg`, `execFileAsync`) — imported from dedicated modules rather than copy-pasted
- **Unified API Error Response**: A consistent response shape (`{ success: boolean, error?: string, details?: unknown }`) enforced by the route handler factory — eliminates the current 5 distinct error shapes across routes
- **Headless Data Table**: A `@tanstack/table-core` instance wrapped by shadcn-svelte's `createSvelteTable` helper — provides sorting, filtering, pagination state management that renders through Lunaris-styled `Table` components
- **Virtual List**: A Virtua `VList` component that renders only visible items in long lists — used wherever Argos displays 100+ rows (signals, devices, logs, scan results)
- **Validated Form**: A `sveltekit-superforms` form instance bound to a Zod schema, wrapped with `formsnap` accessible components — provides server+client validation, error messages, and progressive enhancement

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Total lines of code decreases by at least 1,000 (from ~47,900) after all server-side phases (Part A) are complete. Part B adds new functionality and may increase LOC — net reduction measured against Part A only.
- **SC-002**: Zero files contain a local definition of `errMsg()` — only the shared utility exports it
- **SC-003**: Zero files contain a local `promisify(execFile)` — only the shared utility exports it
- **SC-004**: At least 50 of the 66 route handler files use the route handler factory (remaining may have unusual patterns requiring direct handling)
- **SC-005**: Dead export count drops from 25+ to zero as measured by static analysis
- **SC-006**: Circular dependency count drops from 8 to zero as measured by dependency analysis
- **SC-007**: Production build succeeds with zero new warnings after all migrations
- **SC-008**: All existing unit, integration, and security tests pass without modification (test files may be added but existing tests must not change behavior)
- **SC-009**: New shared utilities achieve 100% branch coverage in unit tests
- **SC-010**: A developer writing a new route handler needs fewer than 10 lines of route-specific code for a simple CRUD endpoint (vs. 20–30 lines today)
- **SC-011**: Zero instances of `(error as Error)` type casts remain in the codebase (down from 39)
- **SC-012**: Every API error response conforms to the unified shape — verifiable by a single integration test that hits all error paths
- **SC-013**: Zero abandoned/unused abstraction modules remain — all utility functions are either actively consumed or removed
- **SC-014**: At least 1 data table in the application uses `@tanstack/table-core` with sorting and filtering — demonstrating the pattern for future tables
- **SC-015**: At least 1 list displaying 100+ items uses Virtua virtual scrolling — demonstrating the pattern for future lists
- **SC-016**: At least 1 form uses `sveltekit-superforms` + `formsnap` with Zod validation — demonstrating the pattern for future forms
- **SC-017**: `svelte-sonner` is actively imported and used for user-facing success/error notifications — zero unused dependencies remain
- **SC-018**: The dual Kismet store architecture is unified into a single store — verified by searching for duplicate store declarations

## Assumptions

- The 19 `errMsg()` copies are functionally identical (verified: all return `err instanceof Error ? err.message : String(err)`)
- The 36 `execFileAsync` declarations all use the same `promisify(execFile)` pattern with consistent options
- SvelteKit's `RequestHandler` type is compatible with a factory wrapper pattern (the factory returns a `RequestHandler` that delegates to a simpler inner function)
- The codebase's convention against catch-all utils files means dedicated modules will be created (e.g., `error-utils.ts`, `exec-utils.ts`, `result.ts`) rather than a single file
- Dead exports identified in the analysis are truly dead — they will be verified by building the project after removal
- Circular dependency resolution may require creating small shared-types modules for cycles caused by mutual type references
- The result tuple pattern is compatible with TypeScript's type narrowing (the tuple discriminant works with `if (err)` checks)
- No external consumers depend on the specific structure of error responses (MCP servers use HTTP API, not direct imports)
- `@tanstack/table-core` is used directly (not `@tanstack/svelte-table`) because the official Svelte 5 adapter is not yet released; shadcn-svelte provides the `createSvelteTable` + `FlexRender` adapter
- Virtua's Svelte adapter uses Svelte 5 snippets (`{#snippet children(item)}`) for item rendering
- `sveltekit-superforms` works with Svelte 5 in legacy compatibility mode; full runes support is planned for v3 but is not required for functional correctness
- `svelte-sonner` is already installed (`1.0.7`) but requires explicit imports to activate — no version change needed
- `@tanstack/svelte-query` v6 requires Svelte 5.25.0+ and uses the `$derived.by(createQuery({...}))` pattern for reactivity
- The Kismet dual-store problem is architectural (two stores fed independently by WebSocket and REST) — the fix is code restructuring, not a new library

## Scope Boundaries

**In scope**:

Part A — Server-Side Abstractions:

- Route handler factory
- Unified API error response type
- Shared `errMsg()` and `execFileAsync` utilities
- Result type utility (`safe()`)
- Dead export identification and removal
- Circular dependency resolution (all 8 cycles)
- Higher-order wrappers (retry, timeout)
- Migration of existing code to use new abstractions
- Elimination of all 39 unsafe `(error as Error)` casts across 23 files
- Consolidation/removal of 2 abandoned abstractions (`safeErrorResponse` at 0 consumers, `safeJsonParse` at 3 consumers); `safeParseWithHandling` retained (30+ call sites, actively used)

Part B — Client-Side Tooling Gaps (no overlap with Part A — different files, different layer):

- `@tanstack/table-core` + shadcn-svelte `data-table` helper for headless data tables
- Virtua (`virtua`) for virtual scrolling of long lists
- `sveltekit-superforms` + `formsnap` for schema-validated forms
- Activate `svelte-sonner` (already installed, zero imports) for toast notifications
- `@tanstack/svelte-query` v6 for REST endpoint caching (optional — defer if simple `fetchJSON<T>()` suffices)
- Unify dual Kismet store architecture

**Out of scope**:

- Pipelines / function composition (`pipe()`) — lower priority given the codebase's async-heavy nature where intermediate variable names improve debuggability
- Builder / Fluent API pattern — would require significant redesign of data access layer
- Domain-Specific Language for signal queries — ambitious but better as a separate feature
- Code generation / metaprogramming — requires tooling infrastructure not yet in place
- Partial application / currying beyond what naturally emerges from the higher-order wrappers
- Any table/grid library with fewer than 1,000 GitHub stars (Tzezar Datagrid, SVAR DataGrid — rejected for insufficient community validation). **Exception**: `formsnap` (790 stars) is included because it is the official shadcn-svelte form component, tightly coupled to the superforms + bits-ui stack already installed in the project.
- Any non-headless UI library that would conflict with the Lunaris design system
- Replacing WebSocket-fed stores with TanStack Query — real-time data stays in existing store architecture

## Reference Documentation

### Libraries — Part B Tooling

| Library                    | Package                  | Version            | Stars  | Downloads/mo | License | Docs                                                                                                     |
| -------------------------- | ------------------------ | ------------------ | ------ | ------------ | ------- | -------------------------------------------------------------------------------------------------------- |
| TanStack Table             | `@tanstack/table-core`   | latest             | 27,731 | 34,515,505   | MIT     | [tanstack.com/table](https://tanstack.com/table)                                                         |
| shadcn-svelte (data-table) | `shadcn` (CLI)           | 3.8.4 (installed)  | 8,358  | —            | MIT     | [shadcn-svelte.com/docs/components/data-table](https://www.shadcn-svelte.com/docs/components/data-table) |
| Virtua                     | `virtua`                 | latest             | 3,464  | 1,294,794    | MIT     | [github.com/inokawa/virtua](https://github.com/inokawa/virtua)                                           |
| Superforms                 | `sveltekit-superforms`   | latest             | 2,724  | 404,421      | MIT     | [superforms.rocks](https://superforms.rocks)                                                             |
| Formsnap                   | `formsnap`               | latest             | 790    | 221,211      | MIT     | [formsnap.dev](https://formsnap.dev)                                                                     |
| TanStack Query             | `@tanstack/svelte-query` | 6.x                | 48,587 | 302,837      | MIT     | [tanstack.com/query](https://tanstack.com/query)                                                         |
| svelte-sonner              | `svelte-sonner`          | 1.0.7 (installed)  | 1,208  | 628,676      | MIT     | [svelte-sonner.vercel.app](https://svelte-sonner.vercel.app)                                             |
| Bits UI                    | `bits-ui`                | 2.15.5 (installed) | 3,073  | 1,422,130    | MIT     | [bits-ui.com](https://bits-ui.com)                                                                       |

### GitHub Repositories

- **TanStack Table**: [github.com/TanStack/table](https://github.com/TanStack/table) — Headless UI for building powerful tables & datagrids
- **TanStack Query**: [github.com/TanStack/query](https://github.com/TanStack/query) — Asynchronous state management and data fetching
- **Virtua**: [github.com/inokawa/virtua](https://github.com/inokawa/virtua) — Zero-config, ~3kB virtual list for React, Vue, Solid, Svelte
- **Superforms**: [github.com/ciscoheat/sveltekit-superforms](https://github.com/ciscoheat/sveltekit-superforms) — SvelteKit form library with multi-validator support
- **Formsnap**: [github.com/svecosystem/formsnap](https://github.com/svecosystem/formsnap) — Accessible form components wrapping Superforms
- **svelte-sonner**: [github.com/wobsoriano/svelte-sonner](https://github.com/wobsoriano/svelte-sonner) — Toast component for Svelte (port of sonner)
- **shadcn-svelte**: [github.com/huntabyte/shadcn-svelte](https://github.com/huntabyte/shadcn-svelte) — shadcn/ui for Svelte 5
- **Bits UI**: [github.com/huntabyte/bits-ui](https://github.com/huntabyte/bits-ui) — Headless components for Svelte

### Key Documentation Pages

- shadcn-svelte Data Table guide: [shadcn-svelte.com/docs/components/data-table](https://www.shadcn-svelte.com/docs/components/data-table)
- TanStack Table v8 + Svelte 5 community reference: [svelte5-and-tanstack-table-v8.vercel.app](https://svelte5-and-tanstack-table-v8.vercel.app/)
- TanStack Query v5→v6 Svelte migration: [tanstack.com/query/latest/docs/framework/svelte/migrate-from-v5-to-v6](https://tanstack.com/query/latest/docs/framework/svelte/migrate-from-v5-to-v6)
- Superforms + Zod quickstart: [superforms.rocks/get-started/zod](https://superforms.rocks/get-started/zod)
- Formsnap via shadcn-svelte: [shadcn-svelte.com/docs/components/form](https://www.shadcn-svelte.com/docs/components/form)
