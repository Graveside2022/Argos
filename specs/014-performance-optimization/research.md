# Research: Performance Optimization & Complexity Reduction

**Feature**: 014-performance-optimization | **Date**: 2026-02-23

## Summary

No NEEDS CLARIFICATION markers in the spec. All unknowns resolved during the planning phase through codebase exploration and user clarification. This document records the key decisions and their rationale.

---

## Decision 1: Dead Code Verification Method

**Decision**: Triple-verification — `grep -rn` first, then `npm run build`, then incremental (one batch at a time)

**Rationale**: The user's non-negotiable safety requirement ("I need this code not to fucking break") demands layered verification. grep catches static imports, build catches dynamic/re-export chains, incremental batching limits blast radius.

**Alternatives considered**:

- **Bulk deletion with rollback**: Faster but risky — a single bad deletion in a 20-file batch is hard to isolate
- **Static analysis tool (ts-prune, knip)**: Could miss dynamic imports, string-based requires, and Svelte template imports. grep + build is more reliable for this codebase.

---

## Decision 2: HackRF Client vs Server Boundary

**Decision**: Delete all files in `src/lib/hackrf/` EXCEPT `sweep-manager/` subdirectory and `types.ts` (if server imports it)

**Rationale**: The HackRF Sweep UI page was previously deleted, but its client-side code remains as orphans. The `sweep-manager/` subdirectory is imported by `src/lib/server/hackrf/` which powers live `/api/hackrf/` and `/api/rf/` routes. Verified via grep: `sweep-manager/` files have active server-side consumers; client files (`stores.ts`, `api-legacy.ts`, etc.) have zero consumers.

**Alternatives considered**:

- **Delete entire `src/lib/hackrf/`**: Would break server-side sweep functionality
- **Keep everything**: Leaves ~1,245 lines of dead code creating search noise

---

## Decision 3: ESLint Complexity Thresholds

**Decision**: Cyclomatic complexity max 15 (warn), cognitive complexity max 20 (warn) via `eslint-plugin-sonarjs`

**Rationale**: Industry standard thresholds. `warn` not `error` because 21 pre-existing violations would block the entire lint pass. Existing violations get `eslint-disable` annotations with tracking comments.

**Alternatives considered**:

- **`error` level**: Would require refactoring all 21 oversized functions in this same spec — too large and risky
- **Higher thresholds (25/30)**: Would catch fewer violations and provide weaker guardrails
- **No plugin (built-in `complexity` only)**: Misses cognitive complexity, which better correlates with readability issues

---

## Decision 4: Kismet Batch Update Strategy

**Decision**: Single `kismetStore.update()` call per poll cycle with all devices merged at once. Incremental distribution counters maintained during the batch.

**Rationale**: Currently fires 100+ individual `kismetStore.update()` calls in a forEach loop (one per device). Each triggers all derived GeoJSON rebuilds. A single batch reduces N×M reactive recalculations to 1×M.

**Alternatives considered**:

- **Throttle individual updates**: Still fires N updates, just spread over time — doesn't solve derived recalculation storm
- **Web Worker for GeoJSON**: Adds complexity, message serialization overhead, and wouldn't address the root cause (store update granularity)

---

## Decision 5: GSM Evil Persistence Strategy

**Decision**: 2-second trailing debounce via `setTimeout`/`clearTimeout`. Exclude transient state (`scanProgress`, `scanAbortController`) from serialization.

**Rationale**: Currently `JSON.stringify` of entire state (500 progress lines + 1000 IMSIs) fires synchronously on every store mutation during active scans. Debouncing to 2s max and excluding transient data eliminates main-thread blocking.

**Alternatives considered**:

- **requestIdleCallback**: Not available in all browsers, harder to test
- **Web Worker for serialization**: Overkill for a 2-second debounce; `structuredClone` overhead
- **IndexedDB instead of localStorage**: Adds async complexity, migration path needed for existing data

---

## Decision 6: GPS GeoJSON Memoization

**Decision**: Epsilon-based comparison (0.00001 lat/lng, 0.1m accuracy) with previous values. Skip rebuild if unchanged.

**Rationale**: GPS polls every 2 seconds. When stationary, coordinates don't change but 288 trig operations (5 rings × 48 points + 48-point accuracy circle) fire every tick. Epsilon comparison avoids floating-point noise from GPS hardware.

**Alternatives considered**:

- **Exact equality**: Floating-point GPS values may have minor jitter even when stationary
- **Time-based throttle**: Would miss real position changes during movement

---

## Decision 7: Oversized Functions — Annotate, Don't Refactor

**Decision**: 21 existing functions exceeding Article II.2 limits (50 lines max) receive `eslint-disable-next-line` annotations with tracking comments. They are NOT refactored in this spec.

**Rationale**: The user's primary goals are dead code removal, performance optimization, and guardrail installation. Full refactoring of 21 functions (some 375 lines) is a separate, larger effort that would significantly expand scope and risk. The annotations ensure violations are tracked while the guardrails prevent new violations.

**Alternatives considered**:

- **Refactor top 5 worst**: Still adds significant scope; function refactoring can change behavior
- **Ignore entirely**: No tracking, no guardrails — violations accumulate silently

---

## Decision 8: Constitution Auditor Infrastructure Deletion

**Decision**: Delete `src/lib/constitution/` (24 files, ~5,028 lines), `tests/constitution/` (54 files, ~2,155 lines), and `docs/constitutional-audit-tool/` (3 files, ~1,384 lines). Preserve `.specify/memory/constitution.md` (the governance document itself).

**Rationale**: The constitution auditor was a one-time tool used early in the project to measure codebase compliance against the project constitution. It was never part of the application runtime — zero imports from any live code (confirmed via `grep -rn "from.*constitution" src/`). The tool served its purpose and is now dead weight (8,567 lines). The actual governance rules in `.specify/memory/constitution.md` remain as a living standards document.

**Alternatives considered**:

- **Keep for future audits**: Tool was designed for a one-time audit and hasn't been used since. Future audits can use Claude Code or ESLint rules directly.
- **Extract useful parsers**: The markdown parser and validators are tightly coupled to the constitution-specific format. No reuse value.

---

## Decision 9: Duplicate Function Consolidation Strategy

**Decision**: Consolidate truly duplicated utility functions (`convertToMHz`/`convertToHz`, `getBlockingProcesses`/`killBlockingProcesses`) to canonical locations. Keep `detectHackRF` in both `hackrf-manager.ts` and `usb-sdr-detectors.ts` because they have different return types and serve different purposes.

**Rationale**: The full codebase audit found 18 duplicate function pairs, 8 of which survive the dead code deletion. The sweep-manager pair (`convertToMHz`/`convertToHz`) and hardware-manager pair (`getBlockingProcesses`/`killBlockingProcesses`) are true copy-paste duplicates. However, `detectHackRF` in `hackrf-manager.ts` returns `boolean` (quick check) while `usb-sdr-detectors.ts` returns `DetectedHardware[]` (detailed info) — these serve fundamentally different call sites and should not be merged.

**Alternatives considered**:

- **Merge all duplicates blindly**: Would force incompatible return types together, breaking callers
- **Create shared hardware-utils module**: Over-engineering for 2 pairs of functions; better to pick one canonical home
