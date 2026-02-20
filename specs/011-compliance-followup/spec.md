# Feature Specification: Constitutional Compliance Follow-up

**Feature Branch**: `011-compliance-followup`
**Created**: 2026-02-20
**Status**: Draft
**Input**: User description: "011 — Constitutional Compliance Follow-up: Address all code review findings from 010 branch."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Complete Boolean Property Naming Convention (Priority: P1)

A developer reviewing the codebase finds that all boolean properties in type definitions and schemas follow a consistent naming convention using `is`, `has`, `should`, `can`, or `will` prefixes. There are no bare boolean property names like `running` or `fullDuplex` — every boolean clearly communicates its nature through its name.

**Why this priority**: Inconsistent boolean naming creates confusion about property types during code review and maintenance. The 010 branch renamed most booleans but left ~8 properties untouched, creating a mixed-convention codebase that is harder to maintain than a fully unconverted one.

**Independent Test**: Verified by searching all type definitions and Zod schemas for boolean properties and confirming each one uses an approved prefix. The application builds and all tests pass after renaming.

**Acceptance Scenarios**:

1. **Given** a type definition containing `running: boolean`, **When** the remediation is applied, **Then** the property is renamed to `isRunning` in the type, all Zod schemas, and every consumer across the codebase.
2. **Given** a type definition containing `fullDuplex: boolean`, **When** the remediation is applied, **Then** the property is renamed to `isFullDuplex` in the type, schema, and all consumers.
3. **Given** the completed rename, **When** a search is performed for unprefixed boolean properties in type definitions, **Then** zero results are found (excluding third-party types and DOM/browser APIs).

---

### User Story 2 - Decompose Oversized Dashboard Components (Priority: P1)

A developer working on the dashboard finds that every component file is under 300 lines, making it easy to understand, test, and modify individual pieces of functionality. The two largest remaining components (DevicesPanel and DashboardMap) and two slightly oversized new sub-components (HardwareCard and GpsDropdown) have been broken into focused, single-responsibility sub-components.

**Why this priority**: Oversized components are the most visible constitutional violation (Article II-2.2) and directly impact developer productivity. DevicesPanel at 940 lines and DashboardMap at 915 lines are the two largest files in the project and were explicitly called out in the code review.

**Independent Test**: Verified by checking that no component file exceeds 300 lines, the application renders correctly in the browser, and all existing tests pass.

**Acceptance Scenarios**:

1. **Given** DevicesPanel.svelte at 940 lines, **When** decomposition is applied, **Then** it is split into sub-components where each file is under 300 lines, and the panel renders identically to its pre-decomposition state.
2. **Given** DashboardMap.svelte at 915 lines, **When** decomposition is applied, **Then** it is split into sub-components where each file is under 300 lines, and all map features (overlays, popups, style switching) work identically.
3. **Given** HardwareCard.svelte at 325 lines, **When** decomposition is applied, **Then** it is split so each resulting file is under 300 lines.
4. **Given** GpsDropdown.svelte at 315 lines, **When** decomposition is applied, **Then** it is split so each resulting file is under 300 lines.
5. **Given** any decomposed component, **When** its parent is rendered, **Then** no functionality is lost and no visual regressions are introduced.

---

### User Story 3 - Extract Hardcoded Colors to Theme Constants (Priority: P2)

A developer or designer modifying the application's visual theme finds that all color values are defined in a central location. Terminal colors, map styling colors, and status indicator colors are all referenced through named constants or design tokens rather than scattered hex values, making theme changes a single-location edit.

**Why this priority**: Hardcoded hex colors make theming impossible and violate the design consistency rules. While not a functional issue, they create maintenance burden when visual changes are needed. The terminal ANSI palette (20+ colors) and map paint properties (5+ colors) are the primary sources.

**Independent Test**: Verified by searching component files for bare hex color values and confirming zero results (excluding CSS variable fallback patterns which are acceptable).

**Acceptance Scenarios**:

1. **Given** the terminal component with 20+ hardcoded ANSI hex colors, **When** extraction is applied, **Then** all colors are defined in a dedicated theme constants location and the terminal component references them by name.
2. **Given** the map component with hardcoded hex paint values, **When** extraction is applied, **Then** all map colors reference theme constants or design tokens.
3. **Given** the extracted theme constants, **When** a developer changes a color value in the constants file, **Then** the change is reflected everywhere that color is used.

---

### User Story 4 - Eliminate Module-Level Store Subscriptions (Priority: P2)

A developer reviewing store code finds no manual `.subscribe()` calls for persistence patterns. Instead, stores that need to persist their state to localStorage use a dedicated utility that handles the subscription internally, keeping the store definition clean and consistent with the project's "no manual subscribe" rule.

**Why this priority**: Module-level `.subscribe()` calls for localStorage persistence are a legitimate pattern but violate the project's explicit "NEVER use manual subscribe()" rule. A utility abstraction eliminates the violation while preserving the functionality.

**Independent Test**: Verified by searching for `.subscribe()` calls in application source files and confirming zero results (excluding the utility implementation itself and third-party code). Stores that previously persisted to localStorage continue to do so correctly.

**Acceptance Scenarios**:

1. **Given** a store module using `.subscribe()` to persist state to localStorage, **When** the utility is applied, **Then** the store achieves the same persistence behavior without any `.subscribe()` call in the store module.
2. **Given** the persisted store utility, **When** the store's value changes, **Then** the new value is written to localStorage automatically.
3. **Given** a page reload, **When** a persisted store initializes, **Then** it reads its initial value from localStorage (matching pre-utility behavior).
4. **Given** all store modules migrated, **When** a codebase search for `.subscribe()` is performed, **Then** zero results are found in application source files (excluding the utility's internal implementation).

---

### User Story 5 - Replace Placeholder Issue References (Priority: P3)

A developer reading constitutional exemption comments finds that each one references a real, trackable GitHub issue. There are no placeholder references like `issue:#999` — every exemption links to an actual issue that documents the rationale and planned resolution.

**Why this priority**: Placeholder issue references defeat the purpose of the tracking system. While low severity, they create confusion about whether the exemption is tracked or abandoned. This is a quick cleanup task.

**Independent Test**: Verified by searching for `#999` in the codebase and confirming zero results. Each referenced issue number corresponds to a real open GitHub issue.

**Acceptance Scenarios**:

1. **Given** a comment containing `issue:#999`, **When** the cleanup is applied, **Then** the placeholder is replaced with a real GitHub issue number that tracks the specific exemption.
2. **Given** all placeholder references replaced, **When** a search for `#999` is performed, **Then** zero results are found.
3. **Given** each replacement issue number, **When** visited on GitHub, **Then** the issue exists and describes the exempted violation.

---

### Edge Cases

- What happens when a boolean property rename changes an API response shape that external consumers depend on? The internal API contract changes, and any MCP server or script using the old property name will break and must be updated as part of the rename.
- What happens when a decomposed component's sub-component is imported by other components directly? The decomposition must maintain backward-compatible exports or update all import sites.
- What happens when the persisted store utility encounters corrupted localStorage data? It should fall back to the default value gracefully.
- What happens when a map style requires a truly unique color that doesn't belong in the shared theme? The theme system should support component-scoped color tokens alongside global ones.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: All boolean properties in type definitions and Zod schemas MUST use `is`, `has`, `should`, `can`, or `will` prefixes, including `running` (to `isRunning`) and `fullDuplex` (to `isFullDuplex`).
- **FR-002**: All consumers of renamed boolean properties MUST be updated to use the new names, including API route handlers, service classes, store initializers, and test fixtures.
- **FR-003**: DevicesPanel MUST be decomposed into sub-components where no single file exceeds 300 lines.
- **FR-004**: DashboardMap MUST be decomposed into sub-components where no single file exceeds 300 lines.
- **FR-005**: HardwareCard MUST be split so no resulting file exceeds 300 lines.
- **FR-006**: GpsDropdown MUST be split so no resulting file exceeds 300 lines.
- **FR-007**: All decomposed components MUST maintain identical visual rendering and interactive behavior to their pre-decomposition state.
- **FR-008**: Terminal ANSI color palette values MUST be extracted from the terminal component into a dedicated theme constants location.
- **FR-009**: Map paint hex values MUST be extracted from the map component into theme constants or design tokens.
- **FR-010**: A store persistence utility MUST be provided that handles localStorage read/write without requiring `.subscribe()` calls in store modules.
- **FR-011**: All existing store persistence behavior MUST be preserved when migrating to the utility.
- **FR-012**: All `issue:#999` placeholder references MUST be replaced with real GitHub issue numbers.
- **FR-013**: Each replacement GitHub issue MUST exist and describe the specific exempted violation.

### Key Entities

- **Boolean Property**: A typed field declared as `boolean` in an interface, type alias, or Zod schema. Subject to the naming prefix convention.
- **Dashboard Component**: A Svelte component file within the dashboard feature directory, measured by total line count. Subject to the 300-line maximum.
- **Theme Constant**: A named color value defined in a central location, referenced by name rather than by raw hex value in component files.
- **Persisted Store**: A reactive store whose current value is automatically synchronized with browser localStorage, surviving page reloads.
- **Constitutional Exemption**: A code comment that acknowledges a known rule violation and references a tracking issue for future resolution.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Zero boolean properties in type definitions or schemas lack an approved prefix (is/has/should/can/will), verified by automated search.
- **SC-002**: Zero component files in the dashboard directory exceed 300 lines, verified by line count.
- **SC-003**: Zero bare hex color values appear in component files (excluding CSS variable fallback patterns), verified by automated search.
- **SC-004**: Zero `.subscribe()` calls appear in application store modules (excluding the persistence utility internals), verified by automated search.
- **SC-005**: Zero `#999` placeholder references remain in the codebase, verified by automated search.
- **SC-006**: All existing unit tests (190+) continue to pass after all changes.
- **SC-007**: The application builds successfully with zero type errors.
- **SC-008**: No visual or functional regressions in dashboard components, verified by manual inspection or visual regression tests.

## Assumptions

- The boolean rename for `running` and `fullDuplex` properties does NOT need to preserve backward compatibility for external API consumers — these are internal APIs consumed only by the Argos frontend and MCP diagnostic servers. MCP servers will be updated as part of the rename.
- The 300-line component limit applies to `.svelte` files only, not to co-located `.ts` utility files that support them.
- CSS variable fallback patterns (`var(--token, #hex)`) are acceptable and do NOT count as hardcoded hex colors, since the hex value only applies when the variable is undefined.
- The persisted store utility will handle `JSON.parse` failures gracefully by falling back to the store's default value.
- The `issue:#999` placeholders are expected to number fewer than 10 occurrences total.

## Out of Scope

- Creating new constitutional audit validators or updating existing ones.
- Modifying the constitutional audit tooling or report generation.
- Adding new unit tests for decomposed components (existing tests should continue to pass; new component-level tests are a separate effort).
- Migrating the application to a different state management approach.
- Redesigning the color theme or creating a dark/light mode toggle.

## Dependencies

- Depends on the 010-constitutional-compliance branch being merged to dev (completed).
- Depends on GitHub issues #8, #9, and #10 existing (created in 010 branch work).
