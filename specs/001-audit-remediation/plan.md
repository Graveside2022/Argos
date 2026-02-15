# Implementation Plan: Constitutional Audit Remediation

**Branch**: `001-audit-remediation` | **Date**: February 13, 2026 | **Spec**: [specs/001-audit-remediation/spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-audit-remediation/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

This plan implements constitutional compliance remediation across three priority levels: (P1) Type Safety - replace 581 type assertions with Zod runtime validation to increase compliance from 42% to 60%, (P2) UI Modernization - migrate from hardcoded hex colors to Shadcn component library to reach 68% compliance, (P3) Service Layer Refactor - migrate from service layer pattern to feature-based architecture to achieve 70%+ compliance. Each phase is independently deployable and testable, with P1 deploying to production immediately for field validation before P2/P3 proceed.

## Technical Context

**Language/Version**: TypeScript 5.8.3 (strict mode), SvelteKit 2.22.3, Svelte 5.35.5
**Primary Dependencies**:

- P1: Zod (runtime validation library)
- P2: shadcn-svelte, clsx, tailwind-merge, @tailwindcss/typography
- Existing: Tailwind CSS 3.4.15, Vite 7.0.3, better-sqlite3

**Storage**: SQLite (rf_signals.db) - no changes
**Testing**: Vitest 3.2.4 (unit/integration), Playwright 1.53.2 (E2E), visual regression (Playwright screenshots)
**Target Platform**: Raspberry Pi 5 (8GB RAM, NVMe SSD), Kali Linux 2025.4, Docker v27.5.1 (argos-dev container)

**Project Type**: Web application (SvelteKit single-page dashboard)
**Performance Goals**:

- Zod validation overhead < 5ms per API response (NFR-001)
- Shadcn components render within 16ms/60 FPS on ARM CPU (NFR-002)
- WebSocket latency < 50ms after refactoring (NFR-004)
- No bundle size increase > 5% (NFR-003)

**Constraints**:

- Node.js heap capped at 1024MB (--max-old-space-size=1024)
- Real-time RF data streaming (HackRF FFT, Kismet WiFi, GPS position)
- Field deployment at NTC/JMRC - must maintain 100% uptime
- Development freeze during 3-6 week remediation period

**Scale/Scope**:

- 581 type assertions to migrate (P1)
- 269 hardcoded hex colors to replace (P2)
- 10 service layer violations across 5 feature modules (P3)
- Total: 860 violations to remediate, targeting 42% → 70%+ compliance

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

### Article II — Code Quality Standards

**§2.1 TypeScript Strictness**:

- ✅ **FIXING VIOLATION**: P1 replaces 581 unjustified type assertions with Zod validation
- ✅ Post-P1: All type assertions will have justifying comments OR be removed
- ✅ Post-P1: Runtime validation catches type errors before crashes

**§2.7 Forbidden Patterns**:

- ✅ **FIXING VIOLATION**: No service layer - P3 migrates from `src/lib/services/` to feature-based `src/lib/<feature>/`
- ✅ **FIXING VIOLATION**: No hardcoded hex colors - P2 migrates to Tailwind theme classes + Shadcn components
- ✅ No barrel files created (not in scope)
- ✅ No new service layers created (we're removing the existing one)

### Article IV — User Experience Consistency

**§4.2 Component Reuse**:

- ✅ P2 replaces custom buttons with Shadcn Button components (reuse over create)
- ✅ P2 replaces custom inputs with Shadcn primitives (reuse over create)
- ⚠️ **ACTION REQUIRED**: Before P2 implementation, audit `src/lib/components/` for existing patterns that Shadcn components should replace

**§4.3 State Communication**:

- ✅ All existing UI states must be preserved during P2 migration (empty, loading, error, success, etc.)
- ✅ FR-013 requires: "All functionality MUST remain identical after UI migration"
- ⚠️ **VERIFICATION REQUIRED**: Visual regression baseline (6-8 screenshots) before P2 begins

### Article V — Performance Requirements

**§5.1 Real-Time Data Standards**:

- ✅ NFR-001: Zod validation overhead < 5ms (must verify with benchmarks)
- ✅ NFR-002: Shadcn render time < 16ms on RPi5 ARM (must verify)
- ✅ NFR-004: WebSocket latency < 50ms post-refactor (must verify)

**§5.3 Hardware Resource Awareness**:

- ✅ Node.js heap capped at 1024MB (no change)
- ✅ NFR-003: Bundle size increase < 5% (measure before/after)

### Article VI — Dependency Management

**§6.1 Dependency Discipline**:

- ⚠️ **GATE — USER APPROVAL REQUIRED** (Article IX §9.3 ASK FIRST tier):
    - `zod` - Runtime validation library (P1)
    - `shadcn-svelte` - Accessible UI component library (P2)
    - `clsx` - Conditional className utility (P2)
    - `tailwind-merge` - Tailwind class conflict resolver (P2)
    - `@tailwindcss/typography` - Optional typography plugin (P2)

**Justification**:

- Zod: Required to replace type assertions with runtime validation (fixing 581 HIGH violations)
- Shadcn: Required to eliminate hardcoded colors and establish design system (fixing 269 MEDIUM violations)
- clsx/tailwind-merge: Required dependencies for Shadcn integration

**§6.3 Forbidden Patterns**:

- ✅ No CSS frameworks beyond Tailwind (Shadcn uses Tailwind)
- ✅ No ORMs (SQLite remains unchanged)
- ✅ No state management libraries (using SvelteKit stores)

### Article VIII — Dependency Verification and Planning

**§8.2 Definition of Done**:

- ✅ Each phase includes verification checklist (typecheck, lint, tests)
- ✅ FR-029: All existing tests must pass after each phase (FR-009 consolidated into FR-029)
- ✅ FR-031: Constitutional audit runs after each phase to track compliance

**§8.3 Verification Commands**:

- ✅ Plan includes verification workflow: `npm run typecheck`, `npm run lint`, `npm run test:unit`, `npm run test:integration`, `npm run test:e2e`

### Article IX — Security and Operational Safety

**§9.1 Security Posture**:

- ✅ FR-005: All existing input sanitization validators remain functional (`validatePid`, `validateInterfaceName`, etc.)
- ✅ NFR-005: Input validation through `input-sanitizer.ts` maintained
- ✅ NFR-006: API authentication via `ARGOS_API_KEY` maintained
- ✅ NFR-007: No secrets committed (using `.env`)

**§9.3 AI Agent Operation Boundaries**:

- ⚠️ **USER APPROVAL REQUIRED**: New dependencies (see Article VI)
- ✅ Within scope: Modify files in `src/lib/`, `src/lib/components/`, `src/routes/` (explicit task scope)
- ⚠️ **USER APPROVAL REQUIRED**: Modify `package.json` to add dependencies

### Article XI — Spec-Kit Workflow Governance

**§11.1 Document Separation**:

- ✅ spec.md is technology-agnostic (focuses on WHAT and WHY)
- ✅ plan.md (this file) contains technical details (HOW)
- ✅ tasks.md will map requirements to concrete implementation steps

**§11.2 Task Granularity**:

- ✅ P1: File-by-file Zod migration (581 assertions across ~50-100 files)
- ✅ P2: Component-by-component Shadcn migration (269 hardcoded colors)
- ✅ P3: Feature module migration (7 phases: Kismet, HackRF, GPS, USRP, Tactical Map, WebSocket Base, Cleanup)

### Article XII — Git Workflow and Commit Strategy

**§12.1 Task-Based Commit Discipline**:

- ✅ Each completed task gets own commit with `type(scope): TXXX — description` format
- ✅ FR-036: "Git history MUST show clear separation between phases with descriptive commit messages"

**§12.2 Branch Strategy**:

- ✅ Feature branch: `001-audit-remediation`
- ✅ Three separate PRs: P1, P2, P3 (independent deployment per FR-033)

### Constitution Check Summary

**PASS** with **2 GATES requiring user approval**:

1. **GATE 1 — Dependency Approval (BLOCKING)**: User must approve installation of: `zod`, `shadcn-svelte`, `clsx`, `tailwind-merge`, `@tailwindcss/typography` per Article IX §9.3
2. **GATE 2 — Component Reuse Audit (NON-BLOCKING)**: Before P2 implementation, audit `src/lib/components/` to identify all custom components that Shadcn should replace per Article IV §4.2

**FIXES** (violations being remediated):

- 581 HIGH violations: Unjustified type assertions → Zod validation (Article II §2.1)
- 269 MEDIUM violations: Hardcoded hex colors → Tailwind theme + Shadcn (Article II §2.7)
- 10 CRITICAL violations: Service layer pattern → Feature-based architecture (Article II §2.7)

**COMPLIANCE**: This plan FIXES violations rather than introducing them. Post-implementation compliance: 42% → 70%+

## Project Structure

### Documentation (this feature)

```text
specs/001-audit-remediation/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (dependency investigation)
├── data-model.md        # NOT APPLICABLE (no new entities)
├── quickstart.md        # Phase 1 output (testing scenarios)
├── contracts/           # NOT APPLICABLE (no API changes)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

**Note**: `data-model.md` and `contracts/` are NOT applicable for this refactoring work. No new entities or API endpoints are being created.

### Source Code (repository root)

**Argos SvelteKit Monolith** (web application with server-side rendering):

```text
src/
├── routes/
│   ├── api/                    # P1: Add Zod validation to API endpoints
│   │   ├── hackrf/             # P3: Migrate to src/lib/hackrf/api.ts
│   │   ├── kismet/             # P3: Migrate to src/lib/kismet/api.ts
│   │   ├── gsm-evil/           # P3: Migrate to src/lib/gsm-evil/api.ts
│   │   ├── gps/                # P3: Migrate to src/lib/gps/api.ts
│   │   └── usrp/               # P3: Migrate to src/lib/usrp/api.ts
│   └── +page.svelte            # P2: Migrate to Shadcn components
│
├── lib/
│   ├── components/             # P2: Replace with Shadcn components
│   │   ├── Button.svelte       # → shadcn-svelte Button
│   │   ├── Input.svelte        # → shadcn-svelte Input
│   │   └── Card.svelte         # → shadcn-svelte Card
│   │
│   ├── services/               # P3: REMOVE ENTIRE DIRECTORY
│   │   ├── websocket/          # P3: → src/lib/{kismet,hackrf,gps}/websocket.ts
│   │   ├── usrp/               # P3: → src/lib/usrp/
│   │   └── tactical-map/       # P3: → src/lib/tactical-map/
│   │
│   ├── stores/                 # P1: Add Zod validation, P3: Organize by feature
│   ├── types/                  # P1: Create Zod schemas co-located with types
│   │
│   ├── server/                 # P1: Add Zod validation
│   │   ├── security/           # P1: Maintain input-sanitizer.ts
│   │   ├── websocket-server.ts # P3: Extract base to websocket-base.ts
│   │   └── hardware/           # No changes
│   │
│   └── [NEW FEATURE MODULES]   # P3: CREATE
│       ├── kismet/             # websocket.ts, api.ts, types.ts, stores.ts
│       ├── hackrf/             # websocket.ts, spectrum.ts, sweep.ts, stores.ts
│       ├── gps/                # api.ts, positioning.ts, stores.ts
│       ├── usrp/               # api.ts, power.ts, types.ts
│       └── tactical-map/       # map-engine.ts, layers/, stores.ts
│
tests/
├── unit/                       # P1: Add Zod validation tests
├── integration/                # P1, P2, P3: Update after each phase
└── e2e/                        # P2: Visual regression, P3: WebSocket verification

config/
├── tailwind.config.js          # P2: Add Shadcn theme configuration
└── vite.config.ts              # No changes

scripts/
└── run-audit.ts                # Run after each phase to track compliance
```

**Structure Decision**:

This is a **SvelteKit monolithic web application** with server-side rendering and API routes. The structure matches "Option 1: Single project" from the template, specialized for SvelteKit conventions.

**P1 (Type Safety)** touches:

- `src/lib/types/*.ts` - Create Zod schemas
- `src/routes/api/**/*.ts` - Add validation to endpoints
- `src/lib/stores/*.ts` - Add validation to store data
- `src/lib/server/**/*.ts` - Add validation to server utilities

**P2 (UI Modernization)** touches:

- `src/lib/components/**/*.svelte` - Replace with Shadcn components
- `src/routes/+page.svelte` - Update to use Shadcn primitives
- `config/tailwind.config.js` - Add Shadcn theme configuration
- Install: `shadcn-svelte`, `clsx`, `tailwind-merge`

**P3 (Service Layer Refactor)** moves:

- `src/lib/services/websocket/kismet.ts` → `src/lib/kismet/websocket.ts`
- `src/lib/services/websocket/hackrf.ts` → `src/lib/hackrf/websocket.ts`
- `src/lib/services/usrp/` → `src/lib/usrp/`
- `src/lib/services/tactical-map/` → `src/lib/tactical-map/`
- `src/lib/server/websocket-server.ts` → Extract base to `src/lib/server/websocket-base.ts`
- DELETE: `src/lib/services/` (entire directory after migration)

## Complexity Tracking

**N/A** - This plan fixes constitutional violations rather than introducing complexity.

The Constitution Check shows **zero new violations**. All changes remediate existing violations:

- Removing 581 unjustified type assertions (HIGH)
- Removing 269 hardcoded hex colors (MEDIUM)
- Removing 10 service layer pattern violations (CRITICAL)

Total compliance improvement: 42% → 70%+
