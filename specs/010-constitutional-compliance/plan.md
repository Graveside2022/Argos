# Implementation Plan: Constitutional Compliance Remediation

**Feature Branch**: `010-constitutional-compliance`
**Created**: 2026-02-20
**Source**: Full codebase audit (2026-02-20)

## Tech Stack

- TypeScript 5.8 (strict mode), SvelteKit 2.22, Svelte 5 (Runes), Tailwind 4
- better-sqlite3, child_process (execFile/spawn), fs/promises
- Vitest for testing, ESLint for linting

## Approach

This is a **remediation spec** — no new features, only compliance fixes. Each phase targets a specific constitutional article or CLAUDE.md directive. Phases are independent and can be committed separately.

## Affected Files Summary

### Phase 1: Dependencies (1 file)

- `package.json` — remove `^`/`~` from all 64 dependency versions

### Phase 2: Logger (96 files)

- `src/lib/utils/logger.ts` — already exists with full API (level control, context, rate limiting)
- 55 files in `src/lib/` with console.log/warn/error
- 40 files in `src/routes/` with console.log/warn/error
- 1 file `src/lib/server/mcp/README.md` (exclude — documentation)

### Phase 3: Svelte 5 Runes (7 files)

- `src/lib/stores/dashboard/dashboard-store.ts` — 2 subscribe()
- `src/lib/stores/dashboard/terminal-store.ts` — 1 subscribe()
- `src/lib/stores/dashboard/tools-store.ts` — 3 subscribe()
- `src/lib/map/VisibilityEngine.ts` — subscribe()
- `src/lib/tactical-map/hackrf-service.ts` — 2 subscribe()
- `src/lib/tactical-map/kismet-service.ts` — 5 subscribe()
- `src/routes/gsm-evil/+page.svelte` — 14 `$:` declarations

### Phase 4: Boolean Naming (~14 type definition files, ~20 properties)

- `src/lib/hackrf/stores.ts` — active, connected, connecting
- `src/lib/stores/connection.ts` — connected, connecting, running
- `src/lib/types/tools.ts` — installed, showControls
- `src/lib/types/system.ts` — charging
- `src/lib/types/tak.ts` — connectOnStartup
- `src/lib/types/service-responses.ts` — running, connected, sweeping
- `src/lib/api/hackrf.ts` — connected, sweeping
- `src/lib/server/hardware/types.ts` — available
- `src/lib/kismet/api.ts` — running, active
- `src/lib/server/mcp/dynamic-server.ts` — installed
- `src/lib/server/services/gsm-evil/gsm-evil-health-service.ts` — running
- `src/lib/hackrf/sweep-manager/process-manager.ts` — detached
- `src/lib/types/gps.ts` — used
- Plus all consumer files that reference these properties

### Phase 5: Theme Colors (28 Svelte files)

- `src/app.css` — add CSS custom property definitions
- 28 component files with hardcoded hex values (see audit report)

### Phase 6: Component Decomposition (4 components)

- `src/lib/components/dashboard/panels/DevicesPanel.svelte` (938 lines)
- `src/lib/components/dashboard/DashboardMap.svelte` (915 lines)
- `src/lib/components/dashboard/TopStatusBar.svelte` (794 lines)
- `src/lib/components/dashboard/panels/OverviewPanel.svelte` (769 lines)

### Phase 7: Test Co-location & TODOs

- Move unit tests from `tests/unit/` to `src/` (co-locate)
- Update vitest config if needed
- Add issue references to 8 TODO comments

## Constitution Check

| Article            | Compliance After | Notes                               |
| ------------------ | ---------------- | ----------------------------------- |
| II-2.2             | Yes              | 4 components split to <300 lines    |
| II-2.3             | Yes              | Boolean naming fixed                |
| II-2.6             | Yes              | Hex colors extracted, TODOs tracked |
| III-3.5            | Yes              | Tests co-located                    |
| VI-6.1             | Yes              | Deps pinned                         |
| VII-7.3            | Yes              | console.log eliminated              |
| CLAUDE.md Svelte 5 | Yes              | subscribe() and $: eliminated       |
