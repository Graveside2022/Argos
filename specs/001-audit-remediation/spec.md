# Feature Specification: Constitutional Audit Remediation

**Feature Branch**: `001-audit-remediation`
**Created**: February 13, 2026
**Status**: Draft
**Input**: User description: "Implement constitutional audit remediation for three violation categories: (1) UI Modernization - migrate from hardcoded hex colors to Shadcn component library with full design system including rounded corners, shadows, and accessibility features while preserving all layout and functionality, (2) Service Layer Violations - refactor from service layer pattern to feature-based architecture by moving code from src/lib/services/ to src/lib/<feature>/ following 7-phase plan for Kismet, HackRF, GPS, USRP, and Tactical Map modules, (3) Type Safety Violations - replace 581 type assertions with Zod runtime validation schemas to catch type errors at runtime and improve type safety"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Type Safety Validation (Priority: P1)

Developers working on Argos need confidence that data flowing through the system matches expected types, with runtime validation catching malformed API responses, null values, and incorrect types before they cause crashes.

**Why this priority**: Highest return on investment (42% → 60% compliance), lowest risk, and directly prevents runtime errors that could crash the application during field operations at NTC/JMRC.

**Independent Test**: Can be fully tested by replacing type assertions with Zod schemas file-by-file, running TypeScript compilation and test suites after each change, and verifying validation errors are caught at runtime with invalid data.

**Acceptance Scenarios**:

1. **Given** a developer reviews code with a type assertion like `const data = response as UserData`, **When** they replace it with `const data = UserDataSchema.parse(response)`, **Then** the code compiles successfully and runtime validation catches invalid data
2. **Given** an API endpoint returns malformed data, **When** Zod validation runs, **Then** the system throws a descriptive error instead of crashing with undefined behavior
3. **Given** all 581 type assertions have been migrated, **When** the constitutional audit runs, **Then** zero HIGH violations are reported for type safety
4. **Given** a database query returns unexpected null values, **When** Zod validates the result, **Then** the validation fails gracefully with a clear error message

---

### User Story 2 - UI Design System Migration (Priority: P2)

End users (Army EW operators) need a modern, accessible, professional-looking interface that maintains all current functionality and layout while improving visual consistency, reducing maintenance burden from hardcoded colors, and providing keyboard navigation support.

**Why this priority**: User-facing improvements, resolves 269 MEDIUM violations (42% → 68% compliance), and establishes foundation for future UI work. Scheduled after type safety to ensure runtime stability before visual changes.

**Independent Test**: Can be fully tested by migrating components to Shadcn one-by-one, capturing before/after screenshots, verifying all functionality works identically, and confirming accessibility improvements with keyboard navigation testing.

**Acceptance Scenarios**:

1. **Given** the dashboard displays buttons with hardcoded hex colors, **When** Shadcn Button components replace custom buttons, **Then** buttons display with modern styling (rounded corners, shadows) while triggering the same actions
2. **Given** a user navigates the interface with keyboard only, **When** they tab through interactive elements, **Then** visible focus rings guide navigation (WCAG 2.1 AA compliance)
3. **Given** the tactical map panel is active, **When** UI migration completes, **Then** the map displays in the same position with identical functionality
4. **Given** all components use Shadcn primitives, **When** the constitutional audit runs, **Then** zero MEDIUM violations are reported for hardcoded colors
5. **Given** a developer needs to adjust theme colors, **When** they modify Tailwind config, **Then** all components update consistently without touching individual files

---

### User Story 3 - Feature-Based Architecture Refactor (Priority: P3)

Developers adding features or debugging issues need to understand code organization quickly, with feature-related code (WebSocket, API, types, stores) grouped together rather than scattered across technical layers.

**Why this priority**: Architectural improvement, resolves 10 CRITICAL violations (42% → 45% compliance), but requires careful migration and testing. Scheduled last to avoid disrupting work on P1/P2 tasks.

**Independent Test**: Can be fully tested by migrating one feature module at a time (Kismet, HackRF, GPS, USRP, Tactical Map), running full test suite after each migration, verifying WebSocket connections work, and confirming no broken imports.

**Acceptance Scenarios**:

1. **Given** Kismet service code is in `src/lib/services/websocket/kismet.ts`, **When** it is moved to `src/lib/kismet/websocket.ts`, **Then** all Kismet functionality works identically and tests pass
2. **Given** a developer wants to understand HackRF spectrum analysis, **When** they open `src/lib/hackrf/`, **Then** they find all HackRF-related code (WebSocket, spectrum, sweep, stores) in one directory
3. **Given** the tactical map depends on multiple feature services, **When** refactoring completes, **Then** the map imports from feature modules instead of service layer
4. **Given** all seven phases complete (Kismet, HackRF, GPS, USRP, Tactical Map, WebSocket Base, Cleanup), **When** the constitutional audit runs, **Then** zero CRITICAL violations are reported for service layer pattern
5. **Given** WebSocket connections were working before migration, **When** feature modules are migrated, **Then** real-time HackRF FFT stream, Kismet WiFi data, and GPS positioning continue functioning

---

### Edge Cases

- What happens when Zod validation fails during runtime? System must handle errors gracefully with descriptive messages, not crash
- What happens if a Shadcn component doesn't support required styling variants? Must fall back to custom Tailwind classes while maintaining design system consistency
- What happens if moving service code breaks import paths in 50+ files? TypeScript compiler must catch all broken imports before runtime
- What happens if WebSocket connections fail after service layer migration? Must have rollback strategy to restore working state
- What happens when audit is re-run mid-migration? Expect gradual reduction in violations as each phase completes
- What happens if two feature modules need shared WebSocket base code? Move to `src/lib/server/websocket-base.ts` as shared infrastructure, not service layer

## Requirements _(mandatory)_

### Functional Requirements

**Type Safety (P1):**

- **FR-001**: System MUST replace all 581 type assertions with Zod runtime validation schemas
- **FR-002**: System MUST catch type validation errors at runtime before they cause undefined behavior
- **FR-003**: Zod schemas MUST cover common types including API responses, database query results, user data, and hardware device responses
- **FR-004**: Validation failures MUST provide descriptive error messages identifying which field failed and why
- **FR-005**: System MUST maintain TypeScript strict mode compilation after replacing type assertions
- **FR-006**: All existing tests MUST pass after Zod migration

**UI Design System (P2):**

- **FR-007**: System MUST replace all 269 hardcoded hex colors with Tailwind theme classes
- **FR-008**: System MUST adopt Shadcn component library for buttons, inputs, cards, dialogs, and other interactive elements
- **FR-009**: Visual appearance MUST change (rounded corners, shadows, modern styling) while preserving all layout structure
- **FR-010**: All functionality MUST remain identical after UI migration (same click handlers, same WebSocket data, same map behavior)
- **FR-011**: System MUST achieve WCAG 2.1 AA accessibility compliance with keyboard navigation and focus indicators
- **FR-012**: System MUST capture visual regression baseline before migration to verify intended changes only
- **FR-013**: Installation MUST add required dependencies: shadcn-svelte, clsx, tailwind-merge, and related packages

**Service Layer Refactor (P3):**

- **FR-014**: System MUST migrate code from `src/lib/services/` to feature-based structure `src/lib/<feature>/`
- **FR-015**: Kismet module MUST include websocket.ts, api.ts, types.ts, and stores.ts in `src/lib/kismet/`
- **FR-016**: HackRF module MUST include websocket.ts, spectrum.ts, sweep.ts, and stores.ts in `src/lib/hackrf/`
- **FR-017**: GPS module MUST include api.ts, positioning.ts, and stores.ts in `src/lib/gps/`
- **FR-018**: USRP module MUST include api.ts, power.ts, and types.ts in `src/lib/usrp/`
- **FR-019**: Tactical Map module MUST include map-engine.ts, layers/, and stores.ts in `src/lib/tactical-map/`
- **FR-020**: Shared WebSocket base code MUST move to `src/lib/server/websocket-base.ts` (not feature-specific)
- **FR-021**: System MUST delete empty `src/lib/services/` directory after migration completes
- **FR-022**: All import paths throughout codebase MUST be updated to reflect new feature module locations
- **FR-023**: Full test suite MUST pass after each phase (Kismet, HackRF, GPS, USRP, Tactical Map, WebSocket Base, Cleanup)
- **FR-024**: Real-time WebSocket connections MUST continue functioning after migration (HackRF FFT, Kismet WiFi, GPS position)

**Overall Requirements:**

- **FR-025**: Constitutional audit MUST show compliance improvement: 42% baseline → 60% (P1) → 68% (P1+P2) → 70%+ (P1+P2+P3)
- **FR-026**: System MUST maintain all existing functionality throughout migration (no feature regressions)
- **FR-027**: Each priority level (P1, P2, P3) MUST be independently deployable and testable
- **FR-028**: Git history MUST show clear separation between phases with descriptive commit messages

### Key Entities _(include if feature involves data)_

- **Zod Schema**: Runtime validation schema defining expected shape and constraints of data types (strings, numbers, objects, arrays), used to validate API responses, database results, and user inputs before type assertions
- **Shadcn Component**: Pre-built, accessible UI primitive (Button, Input, Card, Dialog) with consistent styling via Tailwind classes, replacing custom HTML elements with design system primitives
- **Feature Module**: Self-contained directory (`src/lib/<feature>/`) containing all code related to one feature domain (WebSocket, API, types, stores) instead of scattered across technical layers
- **Type Assertion**: TypeScript `as Type` syntax that bypasses type checking, currently used 581 times without justification, to be replaced with Zod validation
- **Service Layer**: Architectural pattern using `src/lib/services/` directory to group code by technical concern (websocket/, usrp/, tactical-map/), forbidden by constitution in favor of feature-based organization

## Success Criteria _(mandatory)_

### Measurable Outcomes

**Type Safety (P1):**

- **SC-001**: Constitutional audit reports zero HIGH violations for type safety (down from 581)
- **SC-002**: Overall compliance increases from 42% to at least 60%
- **SC-003**: All type assertions replaced with Zod validation pass TypeScript strict mode compilation
- **SC-004**: Runtime validation catches at least one real error during testing that would have caused undefined behavior

**UI Design System (P2):**

- **SC-005**: Constitutional audit reports zero MEDIUM violations for hardcoded colors (down from 269)
- **SC-006**: Overall compliance increases from 60% to at least 68%
- **SC-007**: Visual regression testing confirms intentional styling changes only (rounded corners, shadows, modern look)
- **SC-008**: All interactive elements pass keyboard navigation testing (WCAG 2.1 AA compliance)
- **SC-009**: 100% of functionality works identically before and after UI migration (verified by test suite)

**Service Layer Refactor (P3):**

- **SC-010**: Constitutional audit reports zero CRITICAL violations for service layer pattern (down from 10)
- **SC-011**: Overall compliance increases from 68% to at least 70%
- **SC-012**: All seven phases complete successfully with passing tests after each phase
- **SC-013**: Real-time WebSocket connections maintain 100% uptime during and after migration
- **SC-014**: Directory `src/lib/services/` no longer exists after cleanup phase

**Overall:**

- **SC-015**: Total constitutional audit violations decrease from 958 to fewer than 300
- **SC-016**: All existing integration tests, unit tests, and E2E tests pass after each priority phase
- **SC-017**: System remains deployable to Raspberry Pi 5 field units throughout migration process

## Scope _(mandatory)_

### In Scope

**Type Safety (P1):**

- Audit all 581 type assertions across codebase
- Create Zod schemas for ~50-100 common types (UserData, API responses, database results, hardware device responses)
- Replace type assertions with `.parse()` calls file-by-file
- Add error handling for validation failures with descriptive messages
- Update tests to cover Zod validation logic
- Install Zod dependency (`npm install zod`)

**UI Design System (P2):**

- Migrate from hardcoded hex colors to Tailwind theme classes
- Install Shadcn component library with required dependencies (shadcn-svelte, clsx, tailwind-merge)
- Replace custom HTML buttons/inputs with Shadcn Button/Input components
- Apply modern styling (rounded corners, shadows, polished animations)
- Add WCAG 2.1 AA accessibility features (focus rings, keyboard navigation)
- Capture visual regression baseline before migration
- Update Tailwind config for theme customization

**Service Layer Refactor (P3):**

- Migrate Kismet service to `src/lib/kismet/` (websocket, api, types, stores)
- Migrate HackRF service to `src/lib/hackrf/` (websocket, spectrum, sweep, stores)
- Migrate GPS service to `src/lib/gps/` (api, positioning, stores)
- Migrate USRP service to `src/lib/usrp/` (api, power, types)
- Migrate Tactical Map service to `src/lib/tactical-map/` (map-engine, layers, stores)
- Move shared WebSocket base to `src/lib/server/websocket-base.ts`
- Update all import paths throughout codebase
- Delete empty `src/lib/services/` directory
- Run full test suite after each of seven phases

**Overall:**

- Re-run constitutional audit after each priority phase to track compliance improvement
- Maintain passing test suite throughout migration
- Create clear git commits separating each phase
- Document migration in CLAUDE.md and audit reports

### Out of Scope

**Type Safety (P1):**

- Removing all type assertions entirely (some may remain with Zod validation justification)
- Creating Zod schemas for rarely-used types (only cover common patterns)
- Migrating TypeScript to strict mode (already using strict mode)
- Adding Zod validation to third-party library types (focus on internal code)

**UI Design System (P2):**

- Complete redesign of layout structure (layout must remain identical)
- Rewriting all components from scratch (selective replacement only)
- Changing functionality of any features (behavior must stay same)
- Modifying Maplibre map library (map integration unchanged)
- Overhauling WebSocket streaming visualizations (data display unchanged)
- Custom Shadcn theme development (use default theme with Tailwind customization)

**Service Layer Refactor (P3):**

- Big-bang refactor of entire codebase at once (phased approach only)
- Changing business logic during migration (logic remains identical)
- Refactoring code structure beyond service-to-feature migration
- Performance optimization during migration (focus on correctness)
- Adding new features during refactor (pure migration only)

**Component Reuse (Folder 04 - Explicitly Out of Scope):**

- Extracting shared button components (LOW priority, 4 violations, intentionally ignored)
- Button duplication acceptable as context-specific styling
- Will auto-resolve if Shadcn adopted (P2)

**Overall Out of Scope:**

- Adding new features or functionality (pure remediation work)
- Performance improvements or optimization
- Database schema changes
- API endpoint modifications
- Docker configuration changes
- Hardware integration changes (HackRF, Kismet, GPS unchanged)

## Assumptions _(mandatory)_

### Technical Assumptions

**Development Environment:**

- Raspberry Pi 5 with 8GB RAM, Kali Linux 2025.4, Docker v27.5.1 available for testing
- Node.js 20.x with TypeScript 5.8.3, SvelteKit 2.22.3, Svelte 5.35.5 already installed
- Current codebase passes all tests (unit, integration, E2E) before migration starts
- Docker container (`argos-dev`) runs with `network_mode: host` for USB hardware access
- `.env` file exists with valid `ARGOS_API_KEY` (min 32 chars) for authentication

**Type Safety (P1):**

- Zod library compatible with current TypeScript/SvelteKit versions
- Type assertions currently exist because TypeScript inference limitations, not actual type mismatches
- Most type assertions are safe but undocumented (low risk of actual type errors)
- Test coverage sufficient to catch regressions from Zod migration

**UI Design System (P2):**

- Shadcn-svelte library compatible with Svelte 5.35.5 and SvelteKit 2.22.3
- Current Tailwind CSS 3.4.15 installation supports Shadcn integration
- Visual changes acceptable to end users (Army EW operators) as long as functionality identical
- Accessibility compliance (WCAG 2.1 AA) achievable with Shadcn defaults

**Service Layer Refactor (P3):**

- Feature module structure (`src/lib/<feature>/`) not violating any other constitutional rules
- Moving code files does not break binary compatibility with compiled native modules (node-pty)
- WebSocket connections resilient to code reorganization (connection logic unchanged)
- No circular dependencies between feature modules

### Process Assumptions

- Development work happens on feature branch `001-audit-remediation` with regular commits
- Each priority phase (P1, P2, P3) can be merged independently or as single large PR
- Constitutional audit script (`npx tsx scripts/run-audit.ts`) runs after each phase to verify progress
- Visual regression testing tools available (Playwright for screenshots)
- Rollback plan: git history allows reverting to last working state if phase fails
- No other major development work happens concurrently (avoid merge conflicts)

### Timeline Assumptions

- P1 (Type Safety): 1-2 weeks of focused work
- P2 (UI Design System): 1-2 weeks after P1 completes
- P3 (Service Layer Refactor): 1-2 weeks after P2 completes
- Total timeline: 3-6 weeks for all three phases
- Developer can allocate 20-30 hours per week to remediation work
- Testing and validation included in phase timelines (not additional time)

### Risk Assumptions

- Type Safety (P1): Low risk - documentation and validation only, no logic changes
- UI Design System (P2): Medium risk - visual changes acceptable, functionality must remain identical
- Service Layer Refactor (P3): Medium risk - code moves are mechanical, but require careful testing
- Each phase independently testable and deployable (P1 done, P2/P3 can wait if needed)
- Rollback possible via git if any phase introduces regressions

## Dependencies _(mandatory)_

### Technical Dependencies

**Type Safety (P1):**

- **Zod**: Runtime validation library (`npm install zod`)
    - Version: Latest compatible with TypeScript 5.8.3
    - Purpose: Replace type assertions with runtime validation schemas
    - Risk: Low - widely adopted library with stable API

**UI Design System (P2):**

- **shadcn-svelte**: Shadcn component library for Svelte
    - Purpose: Pre-built accessible UI components
    - Risk: Medium - requires Svelte 5 compatibility verification
- **clsx**: Utility for constructing className strings conditionally
    - Purpose: Dynamic component styling
    - Risk: Low - tiny utility library
- **tailwind-merge**: Utility for merging Tailwind CSS classes
    - Purpose: Resolve conflicting Tailwind classes in components
    - Risk: Low - standard Tailwind ecosystem tool
- **@tailwindcss/typography** (optional): Typography plugin for Tailwind
    - Purpose: Improved text styling
    - Risk: Low - official Tailwind plugin

**Service Layer Refactor (P3):**

- No new external dependencies required
- Depends on TypeScript compiler (`tsc`) catching broken imports
- Depends on ESLint catching unused imports after migration

### Process Dependencies

**Type Safety (P1):**

- Access to full codebase to audit all 581 type assertions
- Ability to run TypeScript compiler (`npm run typecheck`) after each change
- Ability to run test suite (`npm run test:unit`, `npm run test:integration`) for validation

**UI Design System (P2):**

- Visual regression testing capability (Playwright screenshots)
- Access to development environment to preview visual changes
- Ability to capture baseline screenshots before migration starts
- End user (Army EW operator) availability for acceptance testing (optional but recommended)

**Service Layer Refactor (P3):**

- Ability to run tests in isolated environment (Docker container `argos-dev`)
- Access to HackRF One, Alfa WiFi adapter, GPS hardware for integration testing (optional but recommended)
- Ability to verify WebSocket connections manually via browser DevTools

### External Dependencies

**None** - This is internal code quality and architectural work with no external system dependencies.

### Blocking Dependencies

**None** - All three priority phases can begin immediately. However, recommended sequential order (P1 → P2 → P3) to minimize risk:

- P1 (Type Safety) must complete before P2 to ensure runtime stability before visual changes
- P2 (UI Design System) recommended before P3 to avoid re-styling during architectural refactor
- P3 (Service Layer Refactor) can happen anytime but benefits from stable P1/P2 foundation

## Non-Functional Requirements _(optional)_

### Performance

- **NFR-001**: Zod validation overhead must not add more than 5ms to API response processing time
- **NFR-002**: Shadcn components must render within 16ms (60 FPS) on Raspberry Pi 5 ARM CPU
- **NFR-003**: Feature module refactoring must not increase application bundle size by more than 5%
- **NFR-004**: WebSocket connection latency must remain under 50ms after service layer migration

### Security

- **NFR-005**: All user input must continue passing through existing input sanitization validators (`validatePid`, `validateInterfaceName`, `validateFrequency`, etc.)
- **NFR-006**: API authentication via `ARGOS_API_KEY` must remain enforced after all migrations
- **NFR-007**: No secrets or API keys may be committed during migration work (use `.env`)

### Maintainability

- **NFR-008**: Zod schemas must include JSDoc comments explaining validation rules
- **NFR-009**: Feature modules must include README.md documenting module purpose and structure
- **NFR-010**: Git commits must follow conventional commit format: `refactor(kismet): migrate to feature-based architecture`

### Compatibility

- **NFR-011**: All changes must maintain compatibility with Raspberry Pi 5 (ARM64 architecture)
- **NFR-012**: Docker container (`argos-dev`) must continue functioning with source mounts
- **NFR-013**: Native binaries (node-pty) must not break from code reorganization

### Testing

- **NFR-014**: Test coverage must not decrease during migration (maintain current coverage %)
- **NFR-015**: Integration tests must verify real hardware functionality after each phase (HackRF, Kismet, GPS)
- **NFR-016**: E2E tests must verify complete user workflows work after each phase

## Open Questions _(optional)_

### Type Safety (P1)

- Should Zod schemas be co-located with types (`types.ts`) or in separate `schemas.ts` files?
    - **Default Assumption**: Co-locate with types for easier maintenance unless file becomes too large
- Should validation errors be logged to database or just thrown as exceptions?
    - **Default Assumption**: Throw exceptions with descriptive messages, let error boundaries handle logging

### UI Design System (P2)

- Should visual regression baseline be captured manually or automated via CI/CD?
    - **Default Assumption**: Manual capture before starting, automated in future
- Should Shadcn components be customized to match exact current colors or adopt default theme?
    - **Default Assumption**: Adopt default theme (modern look is the goal), customize only if contrast/accessibility issues

### Service Layer Refactor (P3)

- Should WebSocket base code be in `src/lib/server/websocket-base.ts` or inline into each feature?
    - **Default Assumption**: Move to `src/lib/server/websocket-base.ts` if reused by multiple features, inline if simple
- Should feature modules include their own test files or keep tests in `tests/` directory?
    - **Default Assumption**: Keep tests in `tests/` directory to maintain existing test structure

### Overall

- Should all three phases be merged as single large PR or three separate PRs?
    - **Default Assumption**: Three separate PRs for independent review and deployment
- Should visual changes (P2) be reviewed by end users before merging?
    - **Default Assumption**: Yes - screenshot comparison shared with Army EW operators for feedback

## Related Work _(optional)_

### Constitutional Audit Reports

- **Primary Reference**: `/docs/reports/2026-02-13/` - Full audit report with detailed analysis
    - `README.md` - Overview and priority matrix
    - `01-ui-modernization/` - 269 MEDIUM violations, Shadcn decision matrix, dependency analysis
    - `02-service-layer-violations/` - 10 CRITICAL violations, 7-phase refactoring plan
    - `03-type-safety-violations/` - 581 HIGH violations, remediation strategy
    - `04-component-reuse/` - 4 LOW violations, explicitly out of scope (do nothing)

### Constitution

- **Article II §2.1**: Type assertions require justification comments (HIGH violations)
- **Article II §2.7**: No service layer pattern, use feature-based organization (CRITICAL violations)
- **Article II §2.7**: No hardcoded hex colors, use Tailwind theme (MEDIUM violations)
- **Article IV §4.2**: Reuse existing components before creating new ones (LOW violations - ignored)

### Existing Codebase

- **Security Infrastructure**: `src/lib/server/security/input-sanitizer.ts` - 6 validators must remain functional
- **Authentication**: `src/hooks.server.ts` - API key validation must continue working
- **WebSocket**: `src/lib/server/websocket-server.ts` - Connection handling unchanged
- **Hardware**: `src/lib/server/hardware/` - Detection and management unchanged

### Tools & Scripts

- **Audit Script**: `scripts/run-audit.ts` - Run after each phase to verify compliance progress
- **Test Suites**: `npm run test:unit`, `npm run test:integration`, `npm run test:e2e` - Must pass after each phase
- **TypeCheck**: `npm run typecheck` - Must pass after Zod migration
- **Lint**: `npm run lint` - Must pass after each phase

## Notes _(optional)_

### Implementation Strategy

**Sequential Phases (Recommended):**

1. **Week 1-2**: P1 (Type Safety) - Highest ROI, lowest risk, establishes runtime safety before visual changes
2. **Week 3-4**: P2 (UI Design System) - User-facing improvements, auto-resolves folder 04 violations
3. **Week 5-6**: P3 (Service Layer Refactor) - Architectural cleanup after stable P1/P2 foundation

**Parallel Phases (Alternative - Higher Risk):**

- P1 and P2 can be worked on simultaneously by different developers
- P3 should wait until P1/P2 merge to avoid import path conflicts
- Higher risk of merge conflicts and integration issues

### Compliance Score Tracking

| Milestone                       | Compliance | Violations Resolved                 | Risk   |
| ------------------------------- | ---------- | ----------------------------------- | ------ |
| **Baseline**                    | 42%        | 0                                   | -      |
| **After P1 (Type Safety)**      | ~60%       | 581 HIGH                            | LOW    |
| **After P2 (UI Modernization)** | ~68%       | 581 HIGH + 269 MEDIUM               | MEDIUM |
| **After P3 (Service Layer)**    | ~70%+      | 581 HIGH + 269 MEDIUM + 10 CRITICAL | MEDIUM |
| **Target**                      | >50%       | All HIGH + MEDIUM + CRITICAL        | -      |

### Rollback Strategy

Each phase independently reversible via git:

```bash
# If P1 introduces regressions
git revert <P1-merge-commit>

# If P2 breaks functionality
git revert <P2-merge-commit>

# If P3 causes WebSocket failures
git revert <P3-merge-commit>
```

All phases maintain passing test suite before merge - test failures block merge approval.

### Communication Plan

- **After P1**: Share compliance score improvement (42% → 60%) with stakeholders
- **After P2**: Share before/after UI screenshots with Army EW operators for feedback
- **After P3**: Share architectural diagram showing new feature-based structure
- **Final Report**: Document total compliance improvement (42% → 70%+) and lessons learned

### Success Indicators (Beyond Metrics)

- Developers report easier code navigation with feature modules (P3)
- Test failures provide more descriptive Zod validation errors instead of undefined behavior (P1)
- UI receives positive feedback from end users for modern, accessible design (P2)
- No production incidents related to migration changes
- Constitutional audit becomes useful tool for ongoing code quality (not just one-time fix)
