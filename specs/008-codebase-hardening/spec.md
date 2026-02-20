# Feature Specification: Codebase Hardening

**Feature Branch**: `008-codebase-hardening`
**Created**: 2026-02-19
**Status**: Draft
**Input**: User description: "Eliminate all remaining CLAUDE.md and Constitution violations discovered in the 2026-02-19 codebase convention audit. Covers shell call migration to safe execution, file decomposition for maintainability, and convention compliance fixes."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Safe Command Execution (Priority: P1)

As a security-conscious operator deploying Argos in a field environment, I need all system commands to execute through safe, injection-resistant methods so that no external input can compromise the host system.

**Why this priority**: Shell injection is the highest-severity vulnerability class in a network analysis tool. Argos runs with hardware access on tactical systems — a command injection could compromise the entire device. This must be resolved before any other code quality work.

**Independent Test**: Can be fully tested by running the security test suite (`npm run test:security`) and verifying zero unsafe shell execution patterns remain. Delivers immediate security hardening value.

**Acceptance Scenarios**:

1. **Given** the codebase contains files that execute system commands, **When** a developer audits all command execution calls, **Then** every call uses argument-array-based execution (not string interpolation into a shell)
2. **Given** a file imports the unsafe shell function, **When** it never actually calls that function, **Then** the unused import is removed entirely
3. **Given** any system command requires dynamic arguments (device names, process IDs, file paths), **When** those arguments are passed to execution, **Then** they are provided as separate array elements, never concatenated into a command string

---

### User Story 2 - Maintainable File Sizes (Priority: P2)

As a developer maintaining Argos, I need all component and logic files to be under 300 lines so that I can understand, review, and modify any single file without excessive cognitive load.

**Why this priority**: Large files (some exceeding 1000 lines) slow down code review, increase merge conflict likelihood, and make it harder for new contributors to onboard. Decomposition enables parallel development and targeted testing.

**Independent Test**: Can be tested by running a line-count audit across all source files and confirming no component or logic file exceeds 300 lines (pure data files are exempt). Delivers maintainability value immediately.

**Acceptance Scenarios**:

1. **Given** a component or logic file exceeds 300 lines, **When** a developer decomposes it, **Then** the resulting files are each under 300 lines and the original functionality is preserved
2. **Given** a file is a pure data definition (static lookup tables, type definitions), **When** the line-count audit runs, **Then** that file is excluded from the 300-line threshold
3. **Given** a large file is decomposed into smaller modules, **When** the full test suite runs, **Then** all existing tests continue to pass without modification

---

### User Story 3 - Convention Compliance (Priority: P3)

As a developer working on the Argos UI, I need all interactive elements to use the project's design system components (not raw HTML) so that the interface remains visually consistent and accessible across all panels.

**Why this priority**: Raw HTML buttons and inputs bypass the design system's built-in accessibility attributes, consistent styling, and theming support. Fixing these ensures a uniform operator experience and reduces future UI maintenance burden.

**Independent Test**: Can be tested by searching the codebase for raw `<button>` and `<input>` elements in Svelte components and verifying they have been replaced with design system equivalents (where appropriate). Delivers UI consistency value.

**Acceptance Scenarios**:

1. **Given** a Svelte component contains a raw HTML button element, **When** a developer evaluates it, **Then** it is replaced with the project's Button component unless it is intentionally raw (e.g., map overlay controls)
2. **Given** a TypeScript file uses an unsafe type assertion (`as any`), **When** it is reviewed, **Then** the assertion is replaced with a properly typed pattern
3. **Given** all convention fixes are applied, **When** the type checker and linter run, **Then** no new errors or warnings are introduced

---

### Edge Cases

- What happens when a system command requires shell operators (pipes, redirects, background execution)?
    - These must be restructured to use programmatic alternatives (e.g., Node.js `spawn` with `detached: true` and file descriptor options instead of `nohup &`)
- What happens when a file decomposition changes an import path that other files depend on?
    - All consumers must be updated in the same commit to maintain a working state at every commit
- What happens when a raw button is intentionally used for a non-standard UI context (e.g., map overlays)?
    - These cases are evaluated individually and documented as exempt if the design system component is not appropriate

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST execute all external commands using argument-array-based methods, never shell string interpolation
- **FR-002**: System MUST remove all unused imports of unsafe shell execution functions
- **FR-003**: System MUST validate all dynamic command arguments (device names, process IDs, file paths) before passing them to execution
- **FR-004**: All Tier 1 files (>1000 lines) MUST be decomposed to under 300 lines each (pure data files exempt). Tier 2/3 deferred to follow-up branch
- **FR-005**: All interactive UI elements MUST use the project's design system components unless explicitly documented as exempt
- **FR-006**: System MUST NOT introduce any new violations of project conventions (no `console.log`, no `.subscribe()`, no barrel files, no `as any`)
- **FR-007**: All existing tests MUST continue to pass after every change
- **FR-008**: Each file decomposition MUST preserve the original module's public API or update all consumers in the same commit

### Key Entities

- **Command Execution Call**: A site in the codebase where an external system binary is invoked (19 files including host-exec.ts wrapper, ~66 call sites identified)
- **Oversized File**: A component or logic file exceeding 300 lines (51 actionable files identified after excluding 3 exempt data files; 4 exceeding 1000 lines)
- **Convention Violation**: A usage of raw HTML elements, unsafe type assertions, or other patterns prohibited by project conventions (9 raw buttons + 3 raw inputs = 12 total; 4 `as any` assertions, all documented library limitations)

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Zero files in the codebase import or use shell-string-based command execution — verified by automated grep
- **SC-002**: Zero Tier 1 files (>1000 lines) remain after decomposition — verified by line-count audit. Tier 2/3 compliance deferred to follow-up branch
- **SC-003**: All existing tests pass after all changes are complete (163+ unit, 151 security, 25+ integration)
- **SC-004**: Type checking completes with zero errors (no new warnings introduced beyond pre-implementation baseline)
- **SC-005**: Security test suite passes with zero regressions
- **SC-006**: No new convention violations introduced (verified by constitutional audit tool)

## Assumptions

- Pure data files (static lookup tables, type-only files) are exempt from the 300-line file size threshold
- Shell commands that require shell operators (pipes, redirects, background execution) will be restructured using Node.js process management APIs rather than simply being wrapped in a shell string
- The 4 files exceeding 1000 lines will be decomposed first due to highest maintainability ROI. Tier 2/3 decomposition (47 files, 300-999 lines) deferred to follow-up branch per IX-9.2 task granularity — each decomposition takes 1-2 hours and this branch establishes the pattern
- Each decomposition commit will be atomic — all import path updates included in the same commit
- Map overlay buttons and other context-specific raw HTML elements may be exempted from design system migration after case-by-case evaluation
- III-3.1 Test-First adapted for mechanical refactoring — existing 250+ tests (151 security, 80+ unit, 25+ integration) serve as regression net. No new behavior introduced = no new test-first requirement. New tests added only for genuinely new patterns.

## Scope Boundaries

### In Scope

- Migration of all ~66 unsafe shell execution call sites across 19 files (including deletion of host-exec.ts wrapper)
- Decomposition of Tier 1 oversized files (4 files >1000 lines). Tier 2 (500-999) and Tier 3 (300-500) deferred to follow-up branch per IX-9.2 task granularity
- Replacement of 4 raw HTML elements (1 button + 3 inputs) with design system components; 8 intentional raw buttons documented as exempt
- 4 `as any` type assertions verified as documented library limitations — no action needed

### Out of Scope

- No new features or functionality
- No UI redesign beyond component swap-ins
- No changes to pure data files (tool-hierarchy.ts at 1491 lines, carrier-mappings.ts at 810 lines, types.ts at 315 lines)
- No changes to the database schema or API contracts
