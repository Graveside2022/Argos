# Feature Specification: Constitutional Compliance Remediation

**Feature Branch**: `010-constitutional-compliance`
**Created**: 2026-02-20
**Status**: Draft
**Input**: Full codebase audit on 2026-02-20 identified violations across Articles II, III, VI, VII, and CLAUDE.md Svelte 5 directives.

## User Scenarios & Testing _(mandatory)_

### User Story 1 — Deterministic Builds via Pinned Dependencies (Priority: P0)

A field operator deploys Argos to an RPi 5 at NTC/JMRC. The system must build identically every time, regardless of when `npm install` runs. Floating version ranges (`^`) allow silent upgrades that could break hardware integrations or security controls.

**Why this priority**: Field-deployed military training systems cannot tolerate build non-determinism. A single unexpected dependency upgrade could break SDR hardware communication during a live exercise.

**Independent Test**: Run `npm install` twice, one week apart, and verify identical `node_modules/` output. Verify no `^` or `~` in package.json.

**Acceptance Scenarios**:

1. **Given** package.json with `^` prefixed versions, **When** all prefixes are removed and exact versions pinned, **Then** `npm install` produces deterministic builds with zero floating ranges.
2. **Given** a pinned package.json, **When** a developer runs `npm outdated`, **Then** outdated packages are visible but not silently upgraded.

---

### User Story 2 — Production Log Hygiene (Priority: P1)

A developer debugging a field issue needs structured, filterable logs — not 224 scattered `console.log` statements at varying verbosity levels with no way to silence them. The existing logger utility exists but is unused.

**Why this priority**: Article VII forbids `console.log` in production. Unstructured logging makes field debugging harder, not easier. A structured logger enables log-level control (debug vs error) critical for deployed systems with limited terminal access.

**Independent Test**: Search the codebase for `console.log`, `console.warn`, `console.error` in `src/lib/` and `src/routes/` — count must drop from 224 to zero (excluding the logger implementation itself).

**Acceptance Scenarios**:

1. **Given** 224 console statements across production code, **When** all are migrated to the structured logger, **Then** zero raw `console.log/warn/error` calls remain in `src/lib/` and `src/routes/` (excluding the logger itself).
2. **Given** the structured logger, **When** log level is set to `error`, **Then** only error-level messages are emitted — debug and info messages are suppressed.
3. **Given** hardware service logging, **When** a GSM Evil scan starts, **Then** log output includes structured context (service name, operation, timestamp) not bare string messages.

---

### User Story 3 — Svelte 5 Runes Compliance (Priority: P1)

A developer maintains the Argos dashboard and encounters mixed Svelte 4/5 patterns — some components use `$derived()` and `$effect()` while others use legacy `$:` declarations and `.subscribe()` calls. This inconsistency causes confusion, prevents Svelte 5 optimizations, and violates CLAUDE.md directives.

**Why this priority**: CLAUDE.md explicitly states "NEVER use manual subscribe()". Mixed patterns create maintenance burden and block Svelte's fine-grained reactivity optimizations. The 16 `.subscribe()` calls and 14 `$:` declarations are concentrated in 7 files, making this tractable.

**Independent Test**: Search for `.subscribe(` and `$:` reactive declarations in `.svelte` and `.ts` files — count must be zero.

**Acceptance Scenarios**:

1. **Given** 16 manual `.subscribe()` calls across 6 service/store files, **When** migrated to `get(store)` for synchronous reads or `$effect()` for reactive subscriptions, **Then** zero `.subscribe()` calls remain.
2. **Given** 14 `$:` reactive declarations in the GSM Evil page, **When** converted to `$derived()` for derivations and `$effect()` for side effects, **Then** zero `$:` declarations remain in `.svelte` files.
3. **Given** store persistence via `.subscribe()` in dashboard stores, **When** migrated to component-level `$effect()`, **Then** localStorage persistence continues to work identically.

---

### User Story 4 — Boolean Naming Convention Compliance (Priority: P2)

A developer reads interface definitions and encounters `active: boolean`, `connected: boolean`, `running: boolean` — properties whose boolean nature is unclear without checking the type annotation. The constitution requires `is/has/should` prefixes for all booleans.

**Why this priority**: Naming conventions improve code readability and reduce bugs. With ~20 violations across core type definitions, this is a moderate refactoring effort with cascading changes to all consumers.

**Independent Test**: Search for boolean interface properties without `is/has/should` prefix — count must be zero (excluding external library type definitions).

**Acceptance Scenarios**:

1. **Given** ~20 boolean properties across type definitions, **When** renamed with `is/has/should` prefixes, **Then** all boolean properties in project-owned interfaces follow the convention.
2. **Given** renamed boolean properties, **When** all consumers are updated, **Then** the project compiles with zero type errors.
3. **Given** external library type definitions (e.g., PNG.js), **When** auditing boolean names, **Then** third-party types are excluded from the convention requirement.

---

### User Story 5 — Theme Color Extraction (Priority: P2)

A designer needs to update the Palantir/cyberpunk color palette across Argos. Currently, 28 Svelte files contain hardcoded hex values. Changing the accent color requires editing dozens of files. The constitution forbids hardcoded hex colors.

**Why this priority**: Maintainability and theming consistency. Extracting colors to theme constants enables single-source palette changes and ensures the dark-mode-only design language stays cohesive.

**Independent Test**: Search for hex color patterns in `.svelte` files — count must be zero (excluding CSS custom property definitions in the theme file).

**Acceptance Scenarios**:

1. **Given** hardcoded hex colors in 28 Svelte files, **When** extracted to CSS custom properties or Tailwind theme tokens, **Then** zero hardcoded hex colors remain in component files.
2. **Given** the extracted theme constants, **When** viewed in the browser, **Then** the visual appearance is pixel-identical to the current design.
3. **Given** terminal color palette in the terminal component, **When** ANSI colors are extracted, **Then** they live in a single theme definition file, not scattered across components.

---

### User Story 6 — Component Decomposition (Priority: P2)

A developer needs to modify the DevicesPanel (938 lines) or DashboardMap (915 lines). The file is too large to reason about, violating the 300-line limit in Article 2.2. Splitting into focused subcomponents improves maintainability and testability.

**Why this priority**: Four dashboard components exceed the 300-line limit by 2.5–3.1x. These are the most-edited files in the project and the hardest to review in PRs.

**Independent Test**: Check line counts of the 4 target components — all must be under 300 lines.

**Acceptance Scenarios**:

1. **Given** DevicesPanel at 938 lines, **When** decomposed into focused subcomponents, **Then** the parent component is under 300 lines and subcomponents are individually under 300 lines.
2. **Given** DashboardMap at 915 lines, **When** decomposed, **Then** map logic, overlay rendering, and popup handling are separate components under 300 lines each.
3. **Given** TopStatusBar at 794 lines and OverviewPanel at 769 lines, **When** decomposed, **Then** all resulting files are under 300 lines.
4. **Given** decomposed components, **When** the application runs, **Then** all dashboard functionality works identically with no visual regression.

---

### User Story 7 — Test Co-location and TODO Tracking (Priority: P3)

A developer wants to find tests for a service file. Currently all 44 test files live in a centralized directory, but Article III.5 requires tests alongside source files. Additionally, 8 untracked TODOs violate Article 2.6.

**Why this priority**: Lower priority because the tests themselves exist and pass — this is an organizational improvement, not a functional gap. TODO tracking is a governance item.

**Independent Test**: Verify `.test.ts` files exist adjacent to their source files. Verify all TODO comments include issue/task references.

**Acceptance Scenarios**:

1. **Given** 44 test files in a centralized directory, **When** unit tests are moved to co-locate with source, **Then** unit test files live next to their source files.
2. **Given** integration/e2e tests, **When** evaluating co-location, **Then** integration and e2e tests remain in the centralized test directory (Article III.5 allows this).
3. **Given** 8 untracked TODOs, **When** each is linked to a GitHub issue or task reference, **Then** zero bare TODO comments remain.

---

### Edge Cases

- What happens when a pinned dependency has a security vulnerability? The developer must explicitly update the version and re-pin — npm audit will flag it.
- What happens when a `.subscribe()` removal breaks cross-component reactivity? The migration must verify each store subscription's consumers still receive updates via the replacement pattern.
- What happens when a boolean rename causes API response shape changes? Only internal TypeScript interfaces should be renamed — API response shapes that external consumers depend on must be preserved or versioned.
- What happens when decomposing a component breaks Svelte reactivity across the parent/child boundary? Props and events must be wired correctly, verified by existing E2E and visual regression tests.
- What happens when the logger introduces performance overhead in hot paths (WebSocket message handling)? Logger calls in performance-critical paths should use conditional checks to avoid string formatting when the log level is below threshold.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: All dependency versions in package.json MUST use exact pinning (no `^` or `~` prefixes).
- **FR-002**: All `console.log`, `console.warn`, and `console.error` calls in production source directories MUST be replaced with the structured logger.
- **FR-003**: The structured logger MUST support configurable log levels (debug, info, warn, error).
- **FR-004**: All `.subscribe()` calls MUST be eliminated from the codebase, replaced with `get(store)` or `$effect()`.
- **FR-005**: All `$:` reactive declarations MUST be converted to `$derived()` or `$effect()`.
- **FR-006**: All project-owned boolean interface properties MUST use `is/has/should` prefixes.
- **FR-007**: All hardcoded hex colors in component files MUST be replaced with CSS custom properties or Tailwind theme tokens.
- **FR-008**: The 4 oversized dashboard components (DevicesPanel, DashboardMap, TopStatusBar, OverviewPanel) MUST be decomposed to under 300 lines each.
- **FR-009**: Unit test files MUST be co-located alongside their source files.
- **FR-010**: All TODO comments MUST include a task or issue reference.
- **FR-011**: All changes MUST pass typecheck, unit tests, and build verification after each phase.

### Key Entities

- **Logger**: Structured logging utility with level control, context injection, and timestamp formatting.
- **Theme Constants**: Centralized color palette definition used by all 28 affected components.
- **Component Submodules**: Focused child components extracted from the 4 oversized dashboard panels.

## Assumptions

- The existing logger utility can be extended to support the structured logging requirements rather than adding a new dependency.
- Boolean renames are internal-only — no external API contracts depend on the current property names.
- Hex color extraction will use CSS custom properties defined in the theme file (Tailwind v4 layer), not a separate constants file.
- Component decomposition preserves the existing component public API (props, events) — only internal structure changes.
- Test co-location moves unit tests only; integration, e2e, security, and constitutional tests remain in the centralized test directory.
- Svelte 4 writable/readable/derived store patterns are acceptable for cross-component global state — only `.subscribe()` and `$:` patterns are violations.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Zero floating dependency versions (`^` or `~`) in package.json.
- **SC-002**: Zero `console.log/warn/error` calls in production source code.
- **SC-003**: Zero `.subscribe()` calls in application source files.
- **SC-004**: Zero `$:` reactive declarations in component files.
- **SC-005**: Zero boolean interface properties without `is/has/should` prefix (excluding third-party types).
- **SC-006**: Zero hardcoded hex colors in component files (excluding theme definition files).
- **SC-007**: All 4 target dashboard components under 300 lines after decomposition.
- **SC-008**: All unit tests co-located alongside their source files.
- **SC-009**: Zero bare TODO/FIXME comments without issue/task references.
- **SC-010**: Typecheck, unit tests, and build pass with zero errors after all changes.
