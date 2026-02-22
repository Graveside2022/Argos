# Feature Specification: Constitution Compliance Remediation

**Feature Branch**: `013-constitution-compliance`
**Created**: 2026-02-22
**Status**: Draft
**Input**: Fix all remaining constitution violations identified in the Feb 22 audit across 6 violation categories: oversized functions (21), oversized files (58), PascalCase filenames (8), `any` types (16), hardcoded hex colors (65 var() fallbacks), and pre-existing test failures (11).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Oversized Function Refactoring (Priority: P1)

As a developer maintaining the Argos codebase, I need all functions to comply with the 50-line limit (Article 2.2) so that each function has a single responsibility and is easy to understand, test, and modify independently.

**Why this priority**: The 21 oversized functions (up to 375 lines) are the most impactful structural violations. They concentrate complexity, make debugging difficult, and represent the highest risk for introducing regressions during future changes. GSM Evil alone has 5 of the top 20 offenders.

**Independent Test**: Run a line-count scan of all functions in `src/` and verify zero functions exceed 50 lines. Each refactored module can be tested independently via its existing unit/integration tests.

**Acceptance Scenarios**:

1. **Given** 21 functions currently exceed the 50-line limit, **When** each function is refactored into smaller extracted helpers, **Then** every function in the codebase is at or below 50 lines.
2. **Given** `performGsmScan` is 375 lines, **When** it is decomposed into scan-phase functions, **Then** each resulting function is under 50 lines and the GSM scan workflow produces identical results.
3. **Given** `createGSMEvilStore` is 320 lines, **When** its action handlers are extracted into separate functions, **Then** the store initialization is under 50 lines and all GSM Evil store tests pass.
4. **Given** any refactored module, **When** its existing tests are executed, **Then** all tests pass with no regressions.

---

### User Story 2 - Oversized File Decomposition (Priority: P1)

As a developer, I need all source files to comply with the 300-line limit (Article 2.2) so that each file has a clear single responsibility and navigation is straightforward.

**Why this priority**: 58 files exceed 300 lines, with `tool-hierarchy.ts` at 1,491 lines being nearly 5x the limit. Oversized files make code review, testing, and onboarding significantly harder.

**Independent Test**: Run a line-count scan of all non-test files in `src/` and verify zero files exceed 300 lines. Build succeeds with no import errors.

**Acceptance Scenarios**:

1. **Given** 58 non-test files exceed 300 lines, **When** the worst offenders are split into domain-specific modules, **Then** no non-test source file exceeds 300 lines.
2. **Given** `tool-hierarchy.ts` is 1,491 lines of static data, **When** it is split by tool category, **Then** each resulting file is under 300 lines and all tool lookups return identical results.
3. **Given** any split file, **When** `npm run build` is executed, **Then** the build succeeds with no import resolution errors.

---

### User Story 3 - File Naming Convention Compliance (Priority: P2)

As a developer, I need all TypeScript files to follow the kebab-case naming convention (Article 2.3) so that the codebase has a consistent, predictable file naming pattern.

**Why this priority**: 8 PascalCase files create inconsistency. This is a mechanical rename with import updates — lower risk than function refactoring but requires careful import path management.

**Independent Test**: Run a filename pattern scan and verify zero `.ts` files (excluding Svelte components) use PascalCase. Build succeeds after all import paths are updated.

**Acceptance Scenarios**:

1. **Given** 8 PascalCase TypeScript files exist in `src/lib/map/` and `src/lib/server/tak/`, **When** each is renamed to kebab-case with `git mv`, **Then** all files follow kebab-case naming.
2. **Given** a renamed file (e.g., `CertManager.ts` to `cert-manager.ts`), **When** all consuming files are updated to the new import path, **Then** `npm run build` succeeds with no unresolved imports.
3. **Given** test files reference the renamed modules, **When** test import paths are updated, **Then** all affected tests pass.

---

### User Story 4 - Type Safety: Eliminate `any` Types (Priority: P2)

As a developer, I need all `any` types replaced with `unknown` plus type guards so that the codebase maintains strict TypeScript safety without implicit type bypasses.

**Why this priority**: 16 `any` usages (8 core + 5 with existing exemptions + 2 `Record<string, any>` + 1 `type = any`) undermine the strict-mode TypeScript policy. Fixing them is localized and low-risk but improves type safety across TAK, Kismet, WebSocket, database, and MCP modules.

**Independent Test**: Run a type-usage scan filtered for actual `any` type annotations and verify zero non-exempted occurrences. TypeScript compilation passes in strict mode.

**Acceptance Scenarios**:

1. **Given** index signatures in `tak.ts` and `kismet/types.ts` use `any`, **When** they are replaced with `unknown` or proper typed alternatives, **Then** `npx tsc --noEmit` passes with no errors.
2. **Given** `as any` casts in `websocket/base.ts` and `tak-service.ts`, **When** they are replaced with proper type assertions or type guards, **Then** the runtime behavior is unchanged and types are sound.
3. **Given** 3 test files use `any`, **When** they are updated to `unknown` with appropriate assertions, **Then** all affected tests pass.

---

### User Story 5 - Hardcoded Hex Color Resolution (Priority: P2)

As a developer, I need the 65 hardcoded hex colors in Svelte files to either use design tokens exclusively or have a documented constitutional exemption for CSS `var()` fallback values.

**Why this priority**: All 65 occurrences are CSS `var()` fallbacks (e.g., `var(--primary, #809AD0)`). This is a policy decision rather than a code fix — the fallback pattern is actually a defensive best practice. Needs a constitutional amendment or token-only migration.

**Independent Test**: Either verify zero hardcoded hex values in Svelte files OR verify the constitution has been amended to exempt `var()` fallback values.

**Acceptance Scenarios**:

1. **Given** 65 hex color values exist as CSS `var()` fallbacks across 11 Svelte files, **When** the constitutional exemption approach is chosen, **Then** Article 4.1 is amended to explicitly allow hex values as `var()` fallback parameters.
2. **Given** the exemption is documented, **When** the constitution auditor runs, **Then** `var()` fallback hex values are not flagged as violations.

---

### User Story 6 - Fix Pre-existing Test Failures (Priority: P3)

As a developer, I need all 11 pre-existing test failures fixed so that the test suite runs green and regressions are immediately detectable.

**Why this priority**: These failures predate the current work and mask potential new regressions. However, they are in lower-priority test domains (constitution auditor, load tests, TAK markers) and don't block feature development.

**Independent Test**: Run `npm run test:unit` and `npm run test:all` and verify zero failures.

**Acceptance Scenarios**:

1. **Given** `auditor.test.ts` has 5 failures related to scope handling and compliance scoring, **When** the auditor test expectations are aligned with actual auditor behavior, **Then** all 5 tests pass.
2. **Given** `article-ix-security.test.ts` has 2 failures for dynamic constructor detection and multi-violation counting, **When** the validator logic or test expectations are corrected, **Then** both tests pass.
3. **Given** `dataVolumes.test.ts` has 3 failures for load scenario calculations and timeouts, **When** the test data, calculation logic, and timeouts are corrected, **Then** all 3 tests pass.
4. **Given** `tak-markers.test.ts` has 1 failure from an import/setup error, **When** the test setup is fixed, **Then** the test passes.

---

### Edge Cases

- What happens when a refactored function's extracted helper is used by only one caller? Keep it as a private module-level function in the same file; do not create a separate file for single-use helpers.
- How does the system handle circular dependencies created by file splits? Use domain-specific modules with unidirectional imports. If a circular dependency is detected during build, restructure the dependency graph.
- What if a PascalCase rename conflicts with an existing kebab-case file? Check for conflicts before renaming. No conflicts are expected since these 8 files have unique names.
- What if fixing an `any` type reveals a deeper type error? Fix the underlying type error rather than introducing a new assertion. Document any complex type guard patterns.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST have zero functions exceeding 50 lines in any `src/` non-test TypeScript or Svelte file.
- **FR-002**: System MUST have zero non-test source files exceeding 300 lines in `src/`.
- **FR-003**: All TypeScript files in `src/` (excluding Svelte components) MUST use kebab-case naming.
- **FR-004**: System MUST have zero explicit `any` type usages in production code (test files may use `any` with documented justification).
- **FR-005**: All color values in Svelte component markup MUST reference design tokens via CSS custom properties. Hex values are permitted only as `var()` fallback parameters.
- **FR-006**: All unit, integration, and performance tests MUST pass (zero failures in `npm run test:all`).
- **FR-007**: All refactored modules MUST preserve existing public API signatures — no breaking changes to exports.
- **FR-008**: `npm run build` MUST succeed after all changes with zero TypeScript errors.
- **FR-009**: `npm run lint` MUST pass with zero errors after all changes.
- **FR-010**: Extracted helper functions MUST be co-located with their primary consumer (same directory, not a generic utils file).

### Key Entities

- **Violation**: A specific instance where code does not comply with a constitution article. Characterized by article reference, file path, line number, and severity.
- **Constitution Article**: A rule in the project governance document (`.specify/memory/constitution.md`). Each article has a number, title, and enforceable constraint.
- **Design Token**: A CSS custom property defined in the design system (`src/app.css`, `src/lib/styles/palantir-design-system.css`) that abstracts a visual value (color, spacing, typography).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Zero functions in `src/` exceed 50 lines (currently 21 violations).
- **SC-002**: Zero non-test source files in `src/` exceed 300 lines (currently 58 violations).
- **SC-003**: Zero PascalCase TypeScript files in `src/` (currently 8 violations).
- **SC-004**: Zero `any` type usages in production TypeScript code (currently 16 violations).
- **SC-005**: All tests pass with zero failures (currently 11 pre-existing failures).
- **SC-006**: `npm run build` completes successfully with no type errors.
- **SC-007**: Constitution compliance audit reports zero violations across all checked articles.
- **SC-008**: No public API signatures change — all existing consumers work without modification.
- **SC-009**: Developer can locate any function's source file in under 10 seconds using file naming conventions alone.

## Assumptions

- The 65 hardcoded hex colors will be resolved via constitutional exemption for `var()` fallbacks rather than full token migration, since the fallback pattern is defensive and intentional.
- Test failures in `auditor.test.ts` are caused by stale test expectations rather than auditor bugs — tests will be updated to match actual auditor behavior.
- File splits will not require new barrel files (`index.ts`) — consumers will import directly from the specific module file per Article 2.6.
- The 58 oversized files count may decrease naturally as oversized functions are extracted, since function extraction often involves creating new files.
- Refactoring scope is limited to structural compliance — no behavioral changes, no new features, no UI modifications.
