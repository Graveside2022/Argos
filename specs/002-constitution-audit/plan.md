# Implementation Plan: Constitutional Code Quality Audit

**Branch**: `001-constitution-audit` | **Date**: 2026-02-13 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-constitution-audit/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Build an automated constitutional compliance auditing system that scans the Argos codebase against the 12 Articles defined in `.specify/memory/constitution.md`. The audit tool will detect violations of code quality standards, forbidden patterns, and missing implementation requirements, then generate comprehensive gap analysis reports with severity classification and compliance trend tracking.

## Technical Context

**Language/Version**: TypeScript 5.8.3 (strict mode)
**Primary Dependencies**: TypeScript Compiler API (built-in AST parsing - zero new deps per GATE 1 resolution), Vitest (coverage extraction via programmatic API), Node.js fs/path (file I/O), fast-glob (file discovery)
**Storage**: JSON files in `.specify/audit-reports/` (timestamped filenames: `audit-YYYY-MM-DD-HHmmss.json`)
**Testing**: Vitest (already configured in project)
**Target Platform**: Node.js 20.x (Raspberry Pi 5, Kali Linux 2025.4)
**Project Type**: Single (CLI command tool integrated into spec-kit workflow via `.claude/commands/speckit.code_check.md`)
**Performance Goals**: Complete full codebase scan (50-100 files in src/) in under 60 seconds (Success Criteria SC-001)
**Constraints**: Must run within Node.js heap limit (1024MB max per CLAUDE.md), must not introduce new dependencies without explicit approval (Article VI, IX §9.3), must integrate seamlessly with existing /speckit.\* command structure, must be executable from any directory within the project
**Scale/Scope**: ~50-100 TypeScript/Svelte files in src/ directory, 12 constitutional articles with approximately 40-50 total validation rules and forbidden patterns, report storage unlimited (JSON files accumulate in audit-reports/)

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

### Pre-Phase 0 Evaluation

| Article                 | Gate                              | Status      | Notes                                                                                                      |
| ----------------------- | --------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------- |
| **I — Comprehension**   | §1.1 Problem defined?             | ✓ PASS      | Spec clearly defines what needs to be audited, why, and success criteria                                   |
|                         | §1.3 Codebase inventory required? | ⚠️ PENDING  | Phase 0 research will inventory existing analysis tools (Article IV §4.2 reuse workflow)                   |
| **II — Code Quality**   | Forbidden patterns avoided?       | ✓ PASS      | No service layers, barrel files, or other banned patterns in plan                                          |
| **III — Testing**       | Test coverage planned?            | ✓ PASS      | Vitest tests required for audit logic (unit tests for validators, integration tests for full audit flow)   |
| **IV — UX Consistency** | §4.2 Reuse-before-create?         | ⚠️ PENDING  | Phase 0 must search for existing code analysis tools in src/lib/ before creating new ones                  |
|                         | §4.3 All states handled?          | ✓ PASS      | CLI tool states: scanning, complete, error, empty results — all accounted for in spec                      |
| **V — Performance**     | Performance budget defined?       | ✓ PASS      | <60 seconds for full scan (SC-001)                                                                         |
| **VI — Dependencies**   | No npm install without approval?  | 🚨 **GATE** | AST parsing library required (ts-morph, typescript-estree, or TS Compiler API). **USER APPROVAL REQUIRED** |
| **VII — Debugging**     | N/A for planning                  | ✓ PASS      | Standard debugging methodology will be followed during implementation                                      |
| **VIII — Verification** | Verification commands identified? | ✓ PASS      | `npx tsc --noEmit`, `npx eslint`, `npx vitest run` before each commit                                      |
| **IX — Security**       | §9.3 Permission boundaries?       | 🚨 **GATE** | Creating `.claude/commands/speckit.code_check.md` is in "ASK FIRST" tier. **USER APPROVAL REQUIRED**       |
|                         | Secrets/privileges handled?       | ✓ PASS      | No secrets, no elevated privileges needed — reads source files only                                        |
| **X — Governance**      | N/A for implementation            | ✓ N/A       | Constitution compliance auditor is itself governed by the constitution                                     |
| **XI — Spec-Kit**       | §11.1 Spec vs Plan separation?    | ✓ PASS      | spec.md is technology-agnostic, plan.md contains all technical details                                     |
|                         | §11.2 Task granularity?           | ⚠️ PENDING  | Phase 2 (tasks.md generation) will ensure proper task sizing                                               |
| **XII — Git Workflow**  | Task-based commits?               | ✓ PASS      | Each completed task gets structured commit per §12.1                                                       |

### Critical Gates Requiring Resolution

**GATE 1: Dependency Approval (Article VI §6.3, IX §9.3)**

- **Issue**: Constitutional audit requires TypeScript AST parsing to detect violations like `any` types, `@ts-ignore` usage, forbidden patterns
- **Options**:
    1. `ts-morph` (high-level API, easier to use, ~5MB installed)
    2. `@typescript-eslint/typescript-estree` (what ESLint uses internally, medium complexity)
    3. TypeScript Compiler API directly (zero new dependencies, steep learning curve, most control)
- **Recommendation**: Phase 0 research will evaluate which approach best balances implementation ease vs. dependency cost
- **Resolution Required**: User must approve npm package installation OR approve using TypeScript Compiler API directly

**GATE 2: Command Creation Approval (Article IX §9.3)**

- **Issue**: Creating `.claude/commands/speckit.code_check.md` is in the "ASK FIRST" permission tier
- **Justification**: The spec explicitly requires `/speckit.code_check` command (FR-012). This is a spec-kit governance extension
- **Resolution Required**: User must approve command file creation before Phase 1

### Forbidden Pattern Compliance Checklist

- ✓ No service layer pattern (Article II §2.7)
- ✓ No barrel files (Article II §2.7)
- ✓ No catch-all utils.ts (Article II §2.7)
- ✓ No framework wrappers (Article II §2.7)
- ✓ No hardcoded colors (N/A — CLI tool)
- ✓ No browser alerts (N/A — CLI tool)
- ✓ No implementation tests (Article III §3.6)
- ✓ No polling (Article V §5.4)
- ✓ No console.log as logging (Article VII §7.3) — will use structured output
- ✓ No eval/innerHTML (Article IX §9.4)

### Post-Phase 1 Re-evaluation

_To be completed after design artifacts are generated. Will verify:_

- All unknowns from Technical Context resolved
- data-model.md entities align with constitutional principles
- contracts/ API design follows spec-kit patterns
- No new forbidden patterns introduced during design

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
.claude/
└── commands/
    └── speckit.code_check.md           # Command definition (USER APPROVAL REQUIRED — Article IX §9.3)

.specify/
├── audit-reports/                      # Report storage (timestamped JSON files)
│   ├── .gitkeep                        # Preserve directory in git
│   └── audit-YYYY-MM-DD-HHmmss.json   # Example report format
└── memory/
    └── constitution.md                 # Source of truth for audit rules (READ-ONLY)

src/lib/constitution/                   # Constitutional audit implementation
├── types.ts                            # ConstitutionalArticle, Violation, AuditReport, ComplianceScore
├── constitution-parser.ts              # Parse constitution.md into structured rules
├── validators/                         # Per-article validation modules
│   ├── article-i-comprehension.ts      # Comprehension lock checks (placeholder for future)
│   ├── article-ii-code-quality.ts      # TypeScript strictness, forbidden patterns
│   ├── article-iii-testing.ts          # Test coverage validation (Vitest integration)
│   ├── article-iv-ux.ts                # Component state checks, reuse detection
│   ├── article-v-performance.ts        # Performance budget checks (placeholder)
│   ├── article-vi-dependencies.ts      # package.json analysis, pinned versions
│   ├── article-ix-security.ts          # Secret detection, permission violations
│   └── article-xii-git.ts              # Commit message format validation (placeholder)
├── auditor.ts                          # Main audit orchestrator (runs all validators)
├── report-generator.ts                 # Gap analysis report generation (JSON + Markdown)
├── severity-classifier.ts              # Assign CRITICAL/HIGH/MEDIUM/LOW severity
├── trend-tracker.ts                    # Compare against previous audit reports
└── exemption-parser.ts                 # Parse @constitutional-exemption annotations

tests/constitution/                     # Tests for audit tool itself
├── validators/                         # Unit tests for each validator
│   ├── article-ii-code-quality.test.ts
│   ├── article-iii-testing.test.ts
│   └── ...
├── auditor.test.ts                     # Integration test for full audit flow
├── report-generator.test.ts            # Report format validation
└── fixtures/                           # Sample code files with known violations
    ├── valid-component.svelte
    ├── violations-any-type.ts
    ├── violations-forbidden-patterns.ts
    └── constitution-sample.md
```

**Structure Decision**: Single project structure with domain-specific `src/lib/constitution/` module. This aligns with Argos's existing architecture where features are organized as lib modules with co-located types, logic, and tests. The command integration uses the existing `.claude/commands/` directory structure established by spec-kit.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation                  | Why Needed         | Simpler Alternative Rejected Because |
| -------------------------- | ------------------ | ------------------------------------ |
| [e.g., 4th project]        | [current need]     | [why 3 projects insufficient]        |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient]  |

## Post-Phase 1 Constitution Check Re-evaluation

**Status**: All critical gates RESOLVED or DEFERRED

### Updated Gate Status

| Article               | Gate                            | Status                              | Resolution                                                                                                                            |
| --------------------- | ------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **I — Comprehension** | §1.3 Codebase inventory         | ✅ COMPLETE                         | R6 research identified 2,000+ lines of existing validators — will extend, not duplicate                                               |
| **IV — UX**           | §4.2 Reuse-before-create        | ✅ COMPLETE                         | Confirmed reuse strategy: compose existing validators from input-sanitizer.ts, types/validation.ts                                    |
| **VI — Dependencies** | No npm install without approval | ✅ **RESOLVED — OPTION A CHOSEN**   | TypeScript Compiler API only (zero new dependencies). User approved purist approach on 2026-02-13. No fallback to ts-morph permitted. |
| **IX — Security**     | §9.3 Command creation           | ⚠️ **USER APPROVAL STILL REQUIRED** | .claude/commands/speckit.code_check.md creation pending user approval                                                                 |

### Design Validation Against Constitution

**Article II (Code Quality)**:

- ✅ All types use TypeScript strict mode (Zod schemas defined in data-model.md)
- ✅ No forbidden patterns in design (no service layers, barrel files, etc.)
- ✅ Error handling explicit (ConstitutionalAuditError hierarchy in contracts/audit-api.md)

**Article III (Testing)**:

- ✅ Test coverage planned (tests/constitution/ directory structure in plan)
- ✅ Unit tests for validators, integration tests for full audit flow

**Article IV (UX)**:

- ✅ All CLI states accounted for (scanning, complete, error, timeout)
- ✅ Reuse confirmed (extends input-sanitizer.ts, types/validation.ts)
- ⚠️ N/A for traditional UI (CLI tool outputs terminal/JSON/Markdown)

**Article VI (Dependencies)**:

- ✅ Zero new dependencies required (TypeScript Compiler API built-in)
- ✅ Alternative (ts-morph) documented for Phase 2 if needed
- ✅ Zod already in project (reused from env.ts pattern)

**Article IX (Security)**:

- ✅ No secrets in plan (constitution.md path configurable via options)
- ✅ Input validation planned (Zod schemas for all audit options)
- ✅ Read-only operations (audit scans code, doesn't modify it)

**Article XI (Spec-Kit Workflow)**:

- ✅ spec.md technology-agnostic (no TypeScript/Zod mentioned in spec.md)
- ✅ plan.md contains all technical details
- ✅ Proper separation maintained

**Article XII (Git Workflow)**:

- ✅ Task-based commits planned (each validator = separate task)
- ✅ Structured commit messages will reference task IDs

### Remaining User Approvals Required

**GATE 2 (BLOCKING)**: Command Creation Approval

**Request**: Permission to create `.claude/commands/speckit.code_check.md`

**Justification**:

- Spec FR-012 explicitly requires `/speckit.code_check` command
- This is a governance tool (spec-kit extension), not core application code
- Article IX §9.3 classifies command creation as "ASK FIRST" tier

**User must approve before Phase 2 (tasks.md generation)**

---

## Phase 1 Deliverables Summary

✅ **research.md**: All NEEDS CLARIFICATION resolved (R1-R6 complete)
✅ **data-model.md**: 7 core entities defined with Zod schemas
✅ **contracts/audit-api.md**: TypeScript API contract for runAudit() and validators
✅ **quickstart.md**: User-facing guide with command examples and troubleshooting
✅ **Agent context updated**: CLAUDE.md now includes constitutional audit context

**Next Phase**: tasks.md generation (Phase 2) — awaits user approval for GATE 2
