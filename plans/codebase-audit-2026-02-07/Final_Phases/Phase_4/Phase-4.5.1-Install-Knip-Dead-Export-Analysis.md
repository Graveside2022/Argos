# Phase 4.5.1: Install knip and Run Dead Export Analysis

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: NASA/JPL Rule 31 (no dead code), CERT MSC12-C (detect and remove dead code), MISRA Rule 2.2 (no dead code)
**Review Panel**: US Cyber Command Engineering Review Board

---

**Phase**: 4 -- Type Safety, Dead Code Elimination, and Compiler Strictness
**Sub-Phase**: 4.5 -- ESLint and Compiler Strictness Escalation
**Task ID**: 4.5.1
**Risk Level**: LOW -- Dev dependency installation only; no production code changes
**Prerequisites**: Task 4.5.0 (green baseline established, 0 errors)
**Blocks**: Task 4.5.2 (ESLint Strictness Escalation)
**Estimated Duration**: 30 minutes
**Estimated Files Touched**: 2 (knip.config.ts [new], package.json)
**Standards**: NASA/JPL Rule 31, CERT MSC12-C, MISRA Rule 2.2

| Field        | Value                                                             |
| ------------ | ----------------------------------------------------------------- |
| Phase        | 4.5                                                               |
| Task         | 4.5.1                                                             |
| Title        | Install knip and Run Dead Export Analysis                         |
| Status       | PLANNED                                                           |
| Risk Level   | LOW                                                               |
| Duration     | 30 minutes                                                        |
| Dependencies | Task 4.5.0                                                        |
| Branch       | `agent/alex/phase-4.5-eslint-compiler-strictness`                 |
| Commit       | `chore: install knip and add dead export detection configuration` |

---

## Objective

Install knip for automated unused export detection. This provides tooling support for ongoing dead code prevention and establishes a baseline measurement of unused exports in the codebase.

## Current State Assessment

| Metric            | Current State                               | Target State                     |
| ----------------- | ------------------------------------------- | -------------------------------- |
| knip installation | NOT installed (`npm ls knip` returns empty) | Installed as devDependency       |
| knip config       | Does not exist                              | `knip.config.ts` at project root |
| npm script        | No `knip` script in package.json            | `knip` script added              |
| Baseline report   | Not captured                                | Captured to audit output file    |

**Note**: The original Phase 4.5 plan incorrectly claimed knip v5.83.1 was installed. Verification on 2026-02-08 confirmed it is NOT installed.

---

## Execution Steps

### Step 1: Install knip

```bash
npm install --save-dev knip
```

### Step 2: Create Configuration

Create `knip.config.ts` at project root with the following content:

```typescript
import type { KnipConfig } from 'knip';

const config: KnipConfig = {
	entry: [
		'src/routes/**/+page.svelte',
		'src/routes/**/+page.ts',
		'src/routes/**/+page.server.ts',
		'src/routes/**/+layout.svelte',
		'src/routes/**/+layout.ts',
		'src/routes/**/+layout.server.ts',
		'src/routes/**/+server.ts',
		'src/routes/**/+error.svelte',
		'src/hooks.server.ts',
		'src/hooks.client.ts',
		'config/app.d.ts',
		'src/lib/server/mcp/dynamic-server.ts',
		'vite.config.ts',
		'config/*.ts',
		'config/*.js'
	],
	project: ['src/**/*.{ts,svelte}'],
	ignore: ['src/**/*.test.ts', 'src/**/*.spec.ts', 'tests/**', 'src/types/**/*.d.ts'],
	ignoreDependencies: ['@sveltejs/adapter-auto', 'autoprefixer', 'postcss', 'tailwindcss'],
	svelte: {
		entry: ['src/routes/**/+*.svelte']
	}
};

export default config;
```

**Configuration rationale:**

| Field                | Purpose                                                                         |
| -------------------- | ------------------------------------------------------------------------------- |
| `entry`              | SvelteKit entry points (routes, hooks, config) -- the roots of the import graph |
| `project`            | All TypeScript and Svelte source files to analyze                               |
| `ignore`             | Test files (not part of production code graph)                                  |
| `ignoreDependencies` | Build-time dependencies consumed by config, not source code imports             |
| `svelte.entry`       | Svelte-specific entry points for component analysis                             |

### Step 3: Initial Run

```bash
npx knip --reporter compact 2>&1 | tee plans/codebase-audit-2026-02-07/Final_Phases/Phase_4/knip-baseline.txt
```

Record the baseline count of unused exports. Do NOT act on the results in this task -- the output is informational for future dead code cleanup passes.

### Step 4: Add npm Script

Add to `package.json` scripts section:

```json
"knip": "knip --config knip.config.ts"
```

### Step 5: Verify Installation

```bash
npm ls knip
# Expected: knip@<version> listed as devDependency

npx knip --version
# Expected: version number output
```

---

## Verification

| #   | Check              | Command                                                                                           | Expected                           |
| --- | ------------------ | ------------------------------------------------------------------------------------------------- | ---------------------------------- |
| 1   | knip installed     | `npm ls knip`                                                                                     | knip@x.y.z listed                  |
| 2   | Config file exists | `test -f knip.config.ts && echo "exists"`                                                         | `exists`                           |
| 3   | npm script added   | `grep '"knip"' package.json \| wc -l`                                                             | 1                                  |
| 4   | knip executes      | `npx knip --reporter compact 2>&1 \| head -5`                                                     | Output with unused export analysis |
| 5   | Baseline captured  | `test -f plans/codebase-audit-2026-02-07/Final_Phases/Phase_4/knip-baseline.txt && echo "exists"` | `exists`                           |
| 6   | Build still passes | `npm run build`                                                                                   | Exit 0                             |

## Risk Assessment

| Risk                                        | Likelihood | Impact | Mitigation                                            |
| ------------------------------------------- | ---------- | ------ | ----------------------------------------------------- |
| knip config misidentifies SvelteKit entries | MEDIUM     | LOW    | Baseline output is informational only; no deletions   |
| knip false positives on re-exported types   | MEDIUM     | LOW    | Review output manually before acting in future phases |
| npm install breaks existing lockfile        | LOW        | MEDIUM | Verify `npm run build` passes after install           |

## Rollback Strategy

```bash
npm uninstall knip
rm knip.config.ts
# Remove "knip" script from package.json
git checkout package.json package-lock.json
```

## Standards Traceability

| Standard | Rule     | Requirement                 | How This Task Satisfies It                             |
| -------- | -------- | --------------------------- | ------------------------------------------------------ |
| NASA/JPL | Rule 31  | No dead code in production  | Provides tooling to detect dead exports automatically  |
| CERT     | MSC12-C  | Detect and remove dead code | knip identifies unused exports for systematic removal  |
| MISRA    | Rule 2.2 | No dead code                | Establishes baseline measurement for dead export count |

## Commit Message

```
chore: install knip and add dead export detection configuration
```

## Execution Tracking

| Step | Description           | Status  | Started | Completed | Verified By |
| ---- | --------------------- | ------- | ------- | --------- | ----------- |
| 1    | Install knip          | PENDING | --      | --        | --          |
| 2    | Create knip.config.ts | PENDING | --      | --        | --          |
| 3    | Run initial baseline  | PENDING | --      | --        | --          |
| 4    | Add npm script        | PENDING | --      | --        | --          |
| 5    | Verify installation   | PENDING | --      | --        | --          |
