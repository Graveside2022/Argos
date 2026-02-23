# Research: Tooling Gaps & Alternatives Analysis

## Executive Summary

This document identifies the key tooling gaps in the Argos codebase and evaluates both TanStack and alternative solutions for each. The analysis covers five major gap areas: **data fetching**, **table/list rendering**, **virtual scrolling**, **form management**, and **real-time data coordination**.

---

## Gap 1: Data Fetching & Server State Management

### Current State
- Native `fetch()` in services with manual `setInterval` polling
- No caching layer, no automatic retry with backoff, no stale-while-revalidate
- Loading/error states are inconsistent — most components silently swallow errors
- Circuit breaker exists only for GPS satellites; nothing for Kismet or system endpoints
- No `AbortController` usage (risk of dangling requests on unmount)

### What TanStack Query Would Provide
- Automatic caching, deduplication, background refetching
- Built-in retry with exponential backoff
- `isLoading`, `isError`, `data` reactive states out of the box
- Stale-while-revalidate pattern
- Query invalidation for coordinating updates
- Svelte adapter: `@tanstack/svelte-query`

### Alternatives

| Library | Svelte Support | Key Strengths | Tradeoffs |
|---------|---------------|---------------|-----------|
| **SWR-like custom stores** | Native | Zero deps, fits existing store pattern | Must build retry/cache/dedup yourself |
| **@tanstack/svelte-query** | Official adapter | Full-featured, battle-tested, large community | 15KB+ bundle, learning curve, may conflict with existing store-first architecture |
| **Ky** (HTTP client) | Framework-agnostic | Retry, timeout, hooks built into fetch wrapper | Not a state manager — still need store layer |
| **Custom fetch wrapper + store** | Native | Tailored to Argos's dual WS/REST architecture | Maintenance burden, must handle edge cases |

### Recommendation
**Custom fetch wrapper** that adds retry, abort, and error handling to the existing service pattern. Argos's architecture (WebSocket + REST polling to stores) doesn't map cleanly to TanStack Query's request/response model. A lightweight wrapper around `fetch()` with:
- `AbortController` integration
- Configurable retry with backoff
- Standardized `{ loading, error, data }` return shape
- Integration with existing Svelte stores

This avoids introducing a paradigm conflict while closing the reliability gaps.

---

## Gap 2: Table Features (Sorting, Filtering, Column Management)

### Current State
- `DeviceTable.svelte` (238 lines): Manual sorting on 6 columns, single-row selection, row expansion
- `TowerTable.svelte` (258 lines): Manual sorting on 7 columns, expandable rows, timestamp ticker
- `ScanResultsTable.svelte`: Inline sort, no column sort UI
- Pure utility functions in `device-filters.ts` and `device-formatters.ts`
- **Missing**: column visibility, column resizing, column reordering, multi-select, multi-column sort, per-column filters, pagination, sort persistence

### What TanStack Table Would Provide
- Headless table logic: sorting, filtering, pagination, column visibility, column ordering, row selection, row expansion — all as composable features
- Svelte adapter: `@tanstack/svelte-table`
- ~15KB bundle for full feature set

### Alternatives

| Library | Svelte Support | Key Strengths | Tradeoffs |
|---------|---------------|---------------|-----------|
| **@tanstack/svelte-table** | Official adapter | Most complete headless table, huge ecosystem | Verbose API, significant refactor of existing tables |
| **Svelte Headless Table** | Native Svelte | Lighter weight, Svelte-idiomatic | Smaller community, fewer features |
| **AG Grid (Community)** | Svelte wrapper | Enterprise-grade, virtualization built in | Heavy bundle (~200KB+), opinionated rendering |
| **Enhance existing utils** | Native | Zero deps, preserves current patterns | Must build every feature manually, growing complexity |
| **shadcn-svelte table pattern** | Native (already using shadcn-style) | Composable, matches existing UI system | Still need to build logic layer yourself |

### Recommendation
**@tanstack/svelte-table** is the strongest fit here. The current tables are already headless (logic separated from rendering via `device-filters.ts`), so migrating to TanStack Table's model is a natural evolution. It would replace the manual sorting/filtering logic with a standardized, extensible API while keeping the existing shadcn-style table components for rendering.

Priority features to adopt:
1. Column visibility toggling
2. Multi-row selection (for bulk device operations)
3. Column resizing
4. Persistent sort/filter state via store integration

---

## Gap 3: Virtual Scrolling / Windowing

### Current State
- **Zero virtualization** in the codebase
- `DeviceTable` renders all rows with `{#each devices as device}`
- `LiveFramesConsole` renders all GSM frames
- `TowerTable` renders all towers + nested IMSIs
- XTerm handles its own scrollback (10K line limit as workaround)
- Performance will degrade significantly beyond ~500-1000 rows

### What TanStack Virtual Would Provide
- Headless virtualizer for lists, tables, and grids
- Row-level virtualization with variable row heights
- Svelte adapter: `@tanstack/svelte-virtual`
- Pairs well with TanStack Table for virtualized tables

### Alternatives

| Library | Svelte Support | Key Strengths | Tradeoffs |
|---------|---------------|---------------|-----------|
| **@tanstack/svelte-virtual** | Official adapter | Pairs with TanStack Table, headless, variable heights | Requires integration work with existing table markup |
| **svelte-virtual-list** | Native Svelte 4 | Simple API, drop-in | Svelte 5 compatibility unclear, fixed row heights only |
| **Clusterize.js** | Framework-agnostic | Lightweight DOM-based clustering | Not reactive, manual integration needed |
| **CSS `content-visibility: auto`** | Native browser | Zero JS, progressive rendering | Browser support varies, no fine control |
| **Intersection Observer + manual** | Native | Full control, no deps | Significant implementation effort |

### Recommendation
**@tanstack/svelte-virtual** if adopting TanStack Table (they compose naturally). If not adopting TanStack Table, use **CSS `content-visibility: auto`** as a zero-cost first step, then evaluate `svelte-virtual-list` for the device table specifically.

---

## Gap 4: Form State & Client-Side Validation

### Current State
- **Zero `<form>` elements** in the codebase — all inputs use direct `bind:value`
- Zod schemas exist but are only used server-side for API validation
- No dirty/touched tracking, no form-level error aggregation
- Each component reinvents status strings and loading booleans
- `svelte-sonner` is installed but **never imported or used**
- TAK config forms save immediately with no validation gate

### What TanStack Form Would Provide
- Headless form state management
- Zod adapter for validation (reuse existing schemas)
- Field-level and form-level validation
- Dirty/touched tracking, async validation
- Svelte adapter: `@tanstack/svelte-form`

### Alternatives

| Library | Svelte Support | Key Strengths | Tradeoffs |
|---------|---------------|---------------|-----------|
| **@tanstack/svelte-form** | Official adapter | Zod integration, headless, tracks field state | Newer/less mature than React version, overhead for simple forms |
| **Superforms** | SvelteKit-native | Deep SvelteKit integration, Zod support, progressive enhancement | Designed around SvelteKit form actions (not REST API calls) |
| **Formsnap** | Svelte 5 | Composable, works with Superforms or standalone | Primarily a UI binding layer, needs validation lib underneath |
| **Custom Zod + stores** | Native | Reuse existing Zod schemas, minimal deps | Must build dirty/touched/error aggregation |
| **felte** | Svelte | Lightweight, extensible validators | Svelte 5 support unclear |

### Recommendation
**Custom Zod + stores** approach. Argos has very few forms (TAK config, whitelist input, map URL input). The overhead of a form library isn't justified. Instead:
1. Wire existing Zod schemas to validate on `bind:value` changes
2. Create a small `createFormState()` utility returning `{ errors, isDirty, isValid, validate }` as a Svelte store
3. Finally wire up `svelte-sonner` (already installed) for toast notifications on validation errors and success feedback

---

## Gap 5: Real-Time Data Coordination (WebSocket + REST)

### Current State — Critical Architecture Issue
- **Two independent data paths** update **two different stores with the same name**:
  - WebSocket → `src/lib/kismet/stores.ts` (array-based `kismetStore`)
  - REST polling → `src/lib/stores/tactical-map/kismet-store.ts` (Map-based `kismetStore`)
- No synchronization, no deduplication, no ordering guarantees
- Both paths run simultaneously regardless of connection state
- Race conditions on concurrent updates
- Devices can appear in one store but not the other

### No TanStack Solution
TanStack doesn't address real-time WebSocket coordination. This is an architecture issue.

### Alternatives & Approaches

| Approach | Complexity | Key Benefit | Tradeoff |
|----------|-----------|-------------|----------|
| **Unify to single store** | Medium | Eliminates dual-store race condition | Requires audit of all consumers |
| **WebSocket-primary with REST fallback** | Medium | Clear data authority, reduces polling | Must handle WS disconnect gracefully |
| **Event bus / message broker** | High | Decouples sources from consumers | Over-engineered for current scale |
| **Store middleware** | Low | Add dedup/ordering to existing stores | Doesn't fix root dual-store problem |
| **RxJS / observable pattern** | High | Built for stream coordination | Large bundle, paradigm shift |

### Recommendation
**Unify to a single canonical store** (Map-based, from `tactical-map/kismet-store.ts`) and make WebSocket the primary data source with REST as a fallback that only runs when WebSocket is disconnected. This eliminates the race condition at its root. Steps:
1. Remove the array-based `kismet/stores.ts` store
2. Route WebSocket handlers to update the Map-based tactical store
3. Add connection-aware polling: only REST poll when WS is disconnected
4. Use the existing `batchUpdateDevices()` pattern for both sources

---

## Gap 6: Notifications & User Feedback

### Current State
- `svelte-sonner` is in `package.json` but has **zero imports** anywhere
- Errors display as inline status strings (`enrollStatus = 'Failed'`)
- No consistent success/error/warning feedback system
- `validation-error.ts` has a `showToast` callback parameter that's never wired up

### Recommendation
**Wire up svelte-sonner immediately** — it's already installed. Add `<Toaster />` to the root layout and use it in:
- API error responses
- Validation failures (via existing `showToast` callback in `safeParseWithHandling`)
- Service connection/disconnection events
- Successful operations (TAK enrollment, config saves)

This is zero-dependency work (already installed) with high UX impact.

---

## Summary: What to Use Where

| Gap | Use TanStack? | Recommended Tool | Priority |
|-----|--------------|-----------------|----------|
| Data fetching/caching | No | Custom fetch wrapper + existing stores | High |
| Table features | **Yes** | `@tanstack/svelte-table` | High |
| Virtual scrolling | **Yes** (if using TanStack Table) | `@tanstack/svelte-virtual` | Medium |
| Form management | No | Custom Zod + store utility | Low |
| WS/REST coordination | No | Architecture refactor (unify stores) | **Critical** |
| Toast notifications | No | `svelte-sonner` (already installed) | **Quick win** |
| Transitions/animations | No | Svelte 5 native `transition:` directives | Low |
| State persistence | No | Extend existing `persistedWritable` pattern | Low |

### TanStack Verdict
Adopt **TanStack Table** and **TanStack Virtual** — they solve real, measurable gaps in table functionality and performance. Skip TanStack Query (conflicts with WS+store architecture) and TanStack Form (not enough forms to justify). The biggest wins come from architectural fixes (store unification, wiring sonner) that no library can solve.
