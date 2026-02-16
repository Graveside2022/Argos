# Quickstart: GSM Evil Page Modernization

**Date**: 2026-02-16 | **Branch**: `006-gsm-evil-modernization`

## Prerequisites

- Spec 003 (UI Modernization) is complete — shadcn components installed
- Branch `006-gsm-evil-modernization` is checked out and synced with dev
- Node.js 22.x, npm dependencies installed

## Verification Before Starting

```bash
# Verify branch
git branch --show-current  # Should be: 006-gsm-evil-modernization

# Verify environment
npm run typecheck && echo "Types OK"
npm run test:unit && echo "Tests OK"

# Verify current page works
# Open http://localhost:5173/gsm-evil in browser
```

## Implementation Order

### Phase 1 — Component Extraction (6 tasks)

Extract components from monolith one at a time. After each extraction, verify the page renders identically.

1. Extract `ErrorDialog` → `src/lib/components/gsm-evil/ErrorDialog.svelte`
2. Extract `ScanConsole` → `src/lib/components/gsm-evil/ScanConsole.svelte`
3. Extract `LiveFramesConsole` → `src/lib/components/gsm-evil/LiveFramesConsole.svelte`
4. Extract `GsmHeader` → `src/lib/components/gsm-evil/GsmHeader.svelte`
5. Extract `ScanResultsTable` → `src/lib/components/gsm-evil/ScanResultsTable.svelte`
6. Extract `TowerTable` → `src/lib/components/gsm-evil/TowerTable.svelte`

**After each extraction**: `npm run typecheck && npm run lint`

### Phase 2 — Visual Modernization (5 tasks)

Upgrade component internals to use shadcn primitives, removing custom CSS.

7. Replace all buttons with shadcn Button variants
8. Replace both tables with shadcn Table components
9. Replace all badges/indicators with shadcn Badge
10. CSS cleanup — delete replaced styles, verify <200 lines remain
11. Theme integration — replace hardcoded colors, test all 8 palettes

**After each upgrade**: `npm run typecheck && npm run lint`

### Phase 3 — Final Verification (1 task)

12. Full verification: `npm run typecheck && npm run lint && npm run test:unit && npm run build`

## Key Files

| File                                   | Role                       |
| -------------------------------------- | -------------------------- |
| `src/routes/gsm-evil/+page.svelte`     | Page orchestrator (modify) |
| `src/lib/components/gsm-evil/*.svelte` | Sub-components (create)    |
| `src/lib/components/ui/button/`        | shadcn Button (reuse)      |
| `src/lib/components/ui/table/`         | shadcn Table (reuse)       |
| `src/lib/components/ui/badge/`         | shadcn Badge (reuse)       |
| `src/lib/components/ui/alert-dialog/`  | shadcn AlertDialog (reuse) |
| `src/lib/stores/gsm-evil-store.ts`     | State store (unchanged)    |
| `src/lib/types/gsm.ts`                 | Types (unchanged)          |
| `src/lib/utils/gsm-tower-utils.ts`     | Utilities (unchanged)      |

## Component Interface Reference

See `data-model.md` for complete TypeScript interfaces for each component's props.

## Critical Rules

- **No layout changes** — every element stays in the same position
- **No functionality changes** — all scanning, IMSI capture, tower display works identically
- **Store remains unchanged** — sub-components receive data via props from the parent page
- **One commit per task** — verify before each commit
- **Dark mode only** — no light mode support needed
