# Research: Codebase Hardening

**Branch**: `008-codebase-hardening` | **Date**: 2026-02-19

## Decision 1: Shell Call Migration Strategy

**Decision**: Migrate all `promisify(exec)` call sites to `execFile` with argument arrays. For commands requiring shell operators (pipes, redirects, background), use `spawn` with appropriate options.

**Rationale**: The unsafe function invokes `/bin/sh -c "command"` which interprets shell metacharacters. `execFile()` calls the binary directly with argv — no shell interpolation possible. This is the Node.js-recommended approach for security.

**Alternatives Considered**:

- **Keep current approach + sanitize inputs**: Rejected — defense-in-depth says eliminate the vulnerability class, not just guard each input
- **Use execa library**: Rejected — adds a dependency for something `execFile` handles natively
- **Shell-escape library**: Rejected — escaping is error-prone and shell-specific

**Findings**:

- 19 files total (18 in original audit + host-exec.ts pass-through wrapper)
- ~66 call sites across all files
- Risk categorization: 5 CRITICAL (dynamic user/system input), 5 HIGH, 4 MEDIUM, 5 LOW (static strings only)
- 3 files import the unsafe function but have zero actual calls (dead imports)
- Existing safe examples: `api/tak/truststore/+server.ts`, `api/system/info/+server.ts`, `api/openwebrx/control/+server.ts` — all use execFile correctly as reference patterns

**Special Cases**:

- Commands with pipes (`|`): Split into two separate execFile calls, pipe stdout programmatically
- Commands with `nohup &`: Use `spawn()` with `{detached: true, stdio: 'ignore'}` and `unref()`
- Commands with `2>&1`: Use `execFile` with `{encoding: 'utf8'}` — stderr is captured in separate callback param
- Commands with `2>/dev/null`: Ignore stderr in the callback/promise resolution

## Decision 2: File Decomposition Approach

**Decision**: Extract sub-components/modules from oversized files, maintaining the original file as a thin orchestrator that imports and composes the extracted pieces.

**Rationale**: Preserves the public API (import paths) while reducing cognitive load. Consumers don't need to change imports unless the original file is fully replaced.

**Alternatives Considered**:

- **Inline splitting (replace original)**: Rejected — forces all consumers to update imports simultaneously
- **Gradual extraction (leave duplicates)**: Rejected — violates DRY, creates maintenance burden

**Findings**:

- 54 files over 300 lines (12 components, 36 logic, 4 data, 2 routes)
- 4 files over 1000 lines (Tier 1, highest ROI): DashboardMap (1794), sweep-manager (1417), TopStatusBar (1203), DevicesPanel (1047)
- 3 data files exempt: tool-hierarchy.ts (1491), carrier-mappings.ts (809), types.ts (315)
- Actual actionable count: 51 files (54 minus 3 exempt)

## Decision 3: Convention Violation Scope

**Decision**: Migrate only genuinely inappropriate raw HTML elements. Exempt intentional cases (map overlays, navigation rail, tab bars) with constitutional exemption comments.

**Rationale**: Forcing shadcn Button into map overlays or navigation rails would break specialized styling and introduce unnecessary abstraction. The constitution's intent is UI consistency, not dogmatic replacement.

**Findings**:

- Raw `<button>`: 9 total, only 1 should migrate (TAKIndicator configure button), 8 are intentionally raw
- Raw `<input>`: 3 in TakConfigView.svelte (1 checkbox, 2 radio buttons) — should migrate to shadcn components
- `as any`: 4 total, all 4 are documented and justified (WebSocket constructor compat + better-sqlite3 internal API). No action needed.
- `.subscribe()`: 0 actual violations. One comment in DashboardMap.svelte references past migration. No action needed.
- IconRail.svelte already has a constitutional exemption comment at line 2.

## Decision 4: Test Strategy for Migration

**Decision**: Rely on existing test suite (250+ tests including 151 security tests) as regression safety net. Add targeted tests only for new patterns (execFile wrapper, decomposed modules with changed behavior).

**Rationale**: The migration is mechanical (same commands, different invocation method). Existing security tests already cover injection patterns. Adding a test per call site would be excessive for a refactoring task.

**Alternatives Considered**:

- **Test every migrated call site**: Rejected — 66 call sites x individual tests = bloat for mechanical changes
- **No new tests**: Rejected — need at least smoke tests for the new execFile patterns
- **Property-based tests for all args**: Considered for future but out of scope for this branch

**Findings**:

- 47 test files, ~250+ tests total
- Security suite: 9 files, 151 tests (injection, validation, property-based, auth, CORS, headers, rate-limit)
- Property-based tests already cover all 6 input validators with 1000+ random iterations each
- Vitest 3.2.4 with jsdom, single worker (RPi5 memory optimization)
- Test commands: `npm run test:unit`, `npm run test:security`, `npm run typecheck`
