# Argos Project Constitution

**Version**: 2.4.0 | **Ratified**: 2026-02-13 | **Last Amended**: 2026-02-20

---

## Preamble

### Authority
This constitution establishes non-negotiable principles governing all development on Argos. Every specification, plan, task, and implementation must comply with these articles.

### Core Philosophy
Correctness over speed. Reliability over features. Clarity over cleverness.

### Tech Stack & Architecture (USER-SPECIFIED, DO NOT MODIFY)
*   **Language**: TypeScript (strict mode)
*   **Framework**: SvelteKit (No Next.js/Nuxt)
*   **Build Tool**: Vite
*   **Styling**: Tailwind CSS (No proprietary CSS/Sass). Tokens in `src/app.css` (Tailwind v4).
*   **Target OS**: Dragon OS / ParrotOS / Debian / Ubuntu
*   **Hardware**: HackRF One, Alfa WiFi adapters, GPS receivers, USRP B205
*   **Database**: SQLite (rf_signals.db)
*   **Theme**: Dark mode only. Light mode removed.
*   **Architecture**: No thin data-access wrappers. Hardware/protocol services in `src/lib/server/services/`. No barrel files (except shadcn). No ORMs.

---

## Universal Verification Commands
**Enforcement**: A task is NOT complete if any of these commands produce errors.
*   File-Scoped: `npx tsc --noEmit src/lib/FILE.ts`, `npx eslint src/lib/FILE.ts`, `npx vitest run src/lib/FILE.test.ts`
*   Full Project: `npx tsc --noEmit --strict`, `npx eslint src/`, `npm run build`

---

## Article I — Comprehension & Inventory
**1.1 Comprehension Lock**: No code shall be written until the problem is fully understood. Start every task with a confirmed comprehension summary stating: End State, Current State, Problem/Goal, Constraints, and Success Criteria.
**1.2 Codebase Inventory**: Before modifying code, search `src/lib/` for existing implementations. List modified files, related files, and relevant existing types/components in the summary.

## Article II — Code Quality
**2.1 TypeScript Strict**: `strict: true` always. No `any` (use `unknown` + guards). No `@ts-ignore` without issue ID. No type assertions without justification.
**2.2 Modularity**: Single responsibility per file. Max function length: 50 lines. Max file length: 300 lines. No circular dependencies. Explicit exports (no barrel files).
**2.3 Naming**: camelCase (vars/funcs), PascalCase (Types/Components), UPPER_SNAKE_CASE (constants), kebab-case (files). boolean `is/has/should`.
**2.4 Error Handling**: Explicit handling for all external ops. Typed error classes. No swallowed errors. User-visible errors must suggest action.
**2.5 Documentation**: JSDoc for public functions. Block comments for complex algorithms. No commented-out code.
**2.6 Forbidden Patterns**:
*   No thin data-access wrappers (use direct `better-sqlite3` calls). Hardware/protocol services (`src/lib/server/services/`) are allowed.
*   No barrel files `index.ts` (except shadcn/ui).
*   No catch-all utils (`utils.ts`, `helpers.ts`).
*   No class-based UI components.
*   No hardcoded hex colors (use Tailwind theme variables).
*   No `alert()`, `confirm()`, `prompt()`.
*   No untracked TODOs.

## Article III — Testing
**3.1 Test-First**: Write tests before/alongside implementation. Tests must fail without implementation.
**3.2 Coverage**: Unit (80%), Component (all states), Integration (API/WebSocket), E2E (critical flows).
**3.3 Quality**: Tests must be independent, deterministic, and use realistic data. Mock boundaries only.
**3.4 Regression**: Every bug fix requires a reproduction test case.
**3.5 Organization**: Tests live alongside source (`.test.ts`). Integration in `tests/`.

## Article IV — User Experience
**4.1 Design Language**: Cyberpunk theme. Monospaced data. High density. Visual hierarchy.
**4.2 Reuse Workflow**: Search `src/lib/` -> Extend existing -> Create new only if necessary. Document decision.
**4.3 State Communication**: Handle ALL states: Empty, Loading, Default, Active, Error, Success, Disabled, Disconnected. No generic placeholders.
**4.4 Accessibility**: Contrast ratios. Semantic HTML. Keyboard navigation. Screen reader support. Reduced motion.

## Article V — Performance
**5.1 Real-Time**: WebSocket msg < 16ms. Spectrum display > 30fps. Interaction < 100ms. Zero memory leaks.
**5.2 Load**: Initial load < 3s. No unused dependencies. Lazy load heavy components.
**5.3 Resources**: < 15% CPU, < 200MB Heap. Use WebSockets over polling.

## Article VI — Dependencies
**6.1 Discipline**: Pin exact versions. Justify every package. Audit transitive deps.
**6.2 Use Directly**: SvelteKit and Tailwind used directly. No abstraction layers.
**6.3 Forbidden**: No `npm install` without approval. No CSS frameworks. No ORMs. No state libs (Redux/Zustand). No lodash.

## Article VII — Debugging
**7.1 Methodology**: Reproduce -> Classify -> Gather Evidence -> Trace -> Fix.
**7.2 Fix Standards**: No net negative fixes. Fix includes regression test.
**7.3 Forbidden**: No `console.log` in production. No shotgun fixes. No removing error handling to "fix" crashes.

## Article VIII — Operations & Security
**8.1 Security**: No secrets in code. Validate all inputs. Least privilege. Secure defaults (radio/network off by default).
**8.2 Reliability**: Graceful degradation. Auto-recovery with backoff. State persistence.
**8.3 AI Permissions**:
*   **ALLOWED**: Read files, Run checks/tests, Create `src/lib` files (reuse-checked).
*   **ASK FIRST**: Install packages, Modify config/routes/schemas, Delete/Rename files, git operations.
*   **NEVER**: Modify hardware code w/o assignment, Enable TX default, Store secrets, Bypass strict mode, Delete tests.

## Article IX — Spec-Kit Governance
**9.1 Documents**:
*   `spec.md`: WHAT/WHY. Tech-agnostic. No code/paths.
*   `plan.md`: HOW. Tech details. Constitution check. Inventory. Structure.
*   `tasks.md`: Steps. 1 task = 1 commit. Verifiable.
**9.2 Task Granularity**: Min: 5 mins (merge trivial). Max: 2 hours/5 files (split complex). New context per phase.
**9.3 Git Workflow**:
*   **Commit**: One commit per task. Format: `type(scope): TXXX — description`.
*   **Timing**: Commit verify-pass. Never commit broken code.
*   **Branch**: `feature/NNN-feature-name`. Squash merge to main.
*   **Forbidden**: WIP commits. Mega commits. Generic messages. Force-push.
