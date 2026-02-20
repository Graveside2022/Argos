# Implementation Plan: Constitutional Compliance Follow-up

**Branch**: `011-compliance-followup` | **Date**: 2026-02-20 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/011-compliance-followup/spec.md`

## Summary

Complete the constitutional compliance remediation started in branch 010 by addressing all code review findings: finish the boolean `running` → `isRunning` rename across 6 type definitions and ~30 consumers, decompose 4 oversized dashboard components (DevicesPanel 940→<300, DashboardMap 915→<300, HardwareCard 325→<300, GpsDropdown 315→<300), extract hardcoded terminal ANSI and map paint colors to TypeScript constants files, create a `persistedWritable()` utility to eliminate 7 module-level `.subscribe()` calls, and replace 54 placeholder `issue:#999` references with real GitHub issue numbers.

## Technical Context

**Language/Version**: TypeScript 5.8 (strict mode)
**Primary Dependencies**: SvelteKit 2.22, Svelte 5 (Runes), Tailwind CSS 4, xterm.js, MapLibre GL
**Storage**: SQLite via better-sqlite3 (no schema changes in this feature)
**Testing**: Vitest (190+ unit tests, co-located in src/)
**Target Platform**: Raspberry Pi 5, Kali Linux (aarch64), Chromium browser
**Project Type**: SvelteKit web application
**Performance Goals**: No regressions — maintain current <100ms interaction, <3s load
**Constraints**: 8GB RAM (RPi 5), single-worker vitest, OOM-protected dev server
**Scale/Scope**: ~155 source files affected across 5 user stories, no new features

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Article | Rule                       | Status      | Notes                                                |
| ------- | -------------------------- | ----------- | ---------------------------------------------------- |
| II-2.2  | Max file length: 300 lines | FIXING      | 4 target files exceed limit; 6 more noted for future |
| II-2.3  | Boolean is/has/should      | FIXING      | `running` → `isRunning` across 6 definitions         |
| II-2.6  | No hardcoded hex colors    | FIXING      | Terminal ANSI + map paint colors to constants        |
| II-2.6  | No untracked TODOs         | PASS        | Completed in 010 (issues #8, #9, #10)                |
| III-3.5 | Tests alongside source     | PASS        | Completed in 010                                     |
| VI-6.1  | Pin exact versions         | PASS        | Completed in 010                                     |
| IX-9.3  | One commit per task        | WILL COMPLY | Each task = one commit                               |

**Gate result**: PASS — all violations are being actively fixed by this feature.

**Post-design re-check**: No new violations introduced. The `persistedWritable()` utility creates one new file but follows single-responsibility (Article II-2.2). Component decomposition creates new files but each under 300 lines.

## Project Structure

### Documentation (this feature)

```text
specs/011-compliance-followup/
├── plan.md              # This file
├── research.md          # Phase 0 output (completed)
├── spec.md              # Feature specification
├── checklists/
│   └── requirements.md  # Quality checklist (all pass)
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
src/lib/
├── stores/
│   ├── persisted-writable.ts          # NEW: persistedWritable() utility
│   └── dashboard/
│       ├── tools-store.ts             # MODIFY: use persistedWritable()
│       ├── terminal-store.ts          # MODIFY: use persistedWritable()
│       └── dashboard-store.ts         # MODIFY: use persistedWritable()
├── map/
│   └── VisibilityEngine.ts            # MODIFY: use persistedWritable()
├── kismet/
│   └── api.ts                         # MODIFY: running → isRunning
├── server/
│   ├── kismet/
│   │   ├── types.ts                   # MODIFY: running → isRunning
│   │   └── service-manager.ts         # MODIFY: consumer update
│   ├── services/
│   │   ├── kismet/
│   │   │   └── kismet-control-service-extended.ts  # MODIFY: running → isRunning
│   │   └── gsm-evil/
│   │       └── gsm-evil-health-service.ts          # MODIFY: running → isRunning
│   ├── hardware/
│   │   ├── hackrf-manager.ts          # MODIFY: running → isRunning
│   │   ├── resource-manager.ts        # MODIFY: consumer update
│   │   └── detection/
│   │       └── hardware-detector.ts   # MODIFY: private running → isRunning
│   └── mcp/servers/
│       └── hardware-debugger.ts       # MODIFY: consumer update
├── tactical-map/
│   └── kismet-service.ts              # MODIFY: consumer update
├── components/dashboard/
│   ├── DashboardMap.svelte            # MODIFY: decompose (915→<300)
│   ├── map/
│   │   ├── MapControls.svelte         # NEW: extracted from DashboardMap
│   │   ├── MapPopup.svelte            # NEW: extracted from DashboardMap
│   │   ├── map-styles.ts              # NEW: map style configuration
│   │   ├── map-overlays.ts            # NEW: cone/bearing SVG generation
│   │   └── map-colors.ts             # NEW: map paint color constants
│   ├── TerminalTabContent.svelte      # MODIFY: reference terminal-theme.ts
│   ├── terminal/
│   │   └── terminal-theme.ts          # NEW: ANSI color palette constants
│   ├── panels/
│   │   ├── DevicesPanel.svelte        # MODIFY: decompose (940→<300)
│   │   ├── devices/
│   │   │   ├── DeviceFilterBar.svelte # NEW: filter chip bar
│   │   │   ├── DeviceList.svelte      # NEW: device list view
│   │   │   ├── DeviceDetail.svelte    # NEW: device detail view
│   │   │   └── DeviceWhitelist.svelte # NEW: whitelist management
│   │   └── overview/
│   │       └── HardwareCard.svelte    # MODIFY: split (325→<300)
│   ├── status/
│   │   └── GpsDropdown.svelte         # MODIFY: split (315→<300)
│   └── shared/
│       └── ToolCard.svelte            # MODIFY: CSS class .running → .isRunning
└── 35 files                           # MODIFY: replace issue:#999 with real issue numbers
```

**Structure Decision**: Existing SvelteKit project structure. New files follow the established pattern of co-locating sub-components in feature directories (e.g., `panels/devices/`, `map/`, `terminal/`). The `persistedWritable()` utility goes in `src/lib/stores/` as a reusable store factory.

## Complexity Tracking

No constitution violations need justification. All changes reduce violations.

## Key Decisions from Research

1. **`fullDuplex` already renamed** — 010 branch handled it. Only `running` → `isRunning` remains (R-001).
2. **54 placeholder issues, not <10** — scope larger than spec assumed. Grouped into 4 new GitHub issues by article category (R-003).
3. **Theme colors as TypeScript constants, not CSS variables** — xterm.js and MapLibre consume JS objects, not CSS. Named TS constants achieve the "single edit" goal without forcing an incompatible abstraction (R-005).
4. **8 `.subscribe()` calls, 7 are persistence** — `persistedWritable()` handles 7. HackRF spectrum subscription gets a real issue reference exemption (R-002).
5. **10 oversized components total, 4 in scope** — remaining 6 tracked for a future branch to avoid scope creep (R-004).
