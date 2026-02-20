# Implementation Plan: TAK Server Integration Phase 2

**Branch**: `007-tak-server-p2` | **Date**: 2026-02-17 | **Spec**: /specs/007-tak-server-p2/spec.md
**Input**: Feature specification from `/specs/007-tak-server-p2/spec.md`

## Summary

This feature enhances the TAK Server integration by improving the user experience and adding critical connectivity features. Key improvements include:

- Refactoring the TAK configuration UI to fit the dashboard's inline "ToolViewWrapper" pattern, eliminating full-page navigations.
- Adding support for Trust Store (.p12) imports to enable mutual TLS.
- Implementing automated client certificate enrollment via the TAK Server API.
- Providing a "Data Package" (.zip) import workflow to auto-populate configuration.
- Enhancing visibility with connection status indicators in the TopStatusBar and Overview panel.

## Technical Context

**Language/Version**: TypeScript 5.x (Strict Mode)  
**Primary Dependencies**: SvelteKit, Tailwind CSS, SQLite (better-sqlite3), `@tak-ps/node-tak` (via GitHub), `@xmldom/xmldom`, `openssl` (system)  
**Storage**: SQLite (`rf_signals.db`) - `tak_configs` table.  
**Testing**: Vitest (unit/integration), Playwright (E2E).  
**Target Platform**: Linux (Raspberry Pi 5 / x86_64).
**Project Type**: SvelteKit (Web Application).  
**Performance Goals**: UI interaction < 100ms, Status updates < 16ms (WebSocket).  
**Constraints**: Dark mode only, No service layer, No barrel files, Max 300 lines per file.  
**Scale/Scope**: Unified TAK integration using industry-standard libraries.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

1. **Article 1.1 Comprehension**: Plan started with a comprehension summary. (PASS)
2. **Article 1.2 Inventory**:
    - Reusing `src/lib/server/tak/TakService.ts`, `src/lib/server/tak/CertManager.ts`.
    - DEPRECATING and REMOVING `src/lib/server/tak/TakClient.ts`.
    - Replacing `src/lib/components/dashboard/settings/TakSettingsForm.svelte` with new inline `TakConfigView.svelte`.
    - Reusing `src/lib/components/dashboard/views/ToolViewWrapper.svelte`, `src/lib/components/dashboard/IconRail.svelte`, `src/lib/components/dashboard/TopStatusBar.svelte`.
    - Reusing `takStatus` store in `src/lib/stores/tak-store.ts`.
    - Updating types in `src/lib/types/tak.ts`. (PASS)
3. **Article 2.1 TS Strict**: Use strict mode, no `any`. (PASS)
4. **Article 2.6 Forbidden Patterns**: No service layer. No barrel files. (PASS)
5. **Article 6.3 Dependencies**: `@tak-ps/node-tak` approved by user for full protocol coverage. (PASS)
6. **Article 8.3 AI Permissions**: Modification of `tak_configs` schema requires confirmation in Task 1. (PASS)

## Project Structure

### Source Code (repository root)

```text
src/
├── lib/
│   ├── components/
│   │   ├── dashboard/
│   │   │   ├── settings/
│   │   │   │   └── TakSettingsForm.svelte  # REMOVE: Replaced by TakConfigView
│   │   │   └── tak/                        # NEW: Inline TAK components
│   │   │       └── TakConfigView.svelte    # NEW: ToolViewWrapper-based config
│   │   ├── status/
│   │   │   └── TAKIndicator.svelte         # NEW: TopStatusBar indicator
│   ├── server/
│   │   └── tak/
│   │       ├── TakService.ts               # UPDATE: Now wraps @tak-ps/node-tak
│   │       ├── CertManager.ts              # UPDATE: Enrollment & Truststores
│   │       ├── TakClient.ts                # DELETE: Deprecated
│   │       └── TakPackageParser.ts         # NEW: Data package logic
│   ├── stores/
│   │   └── tak-store.ts                    # UPDATE: Extended status fields
│   ├── types/
│   │   └── tak.ts                          # UPDATE: New config fields
├── routes/
│   ├── api/
│   │   └── tak/
│   │       ├── config/+server.ts           # UPDATE: Extended fields
│   │       ├── certs/+server.ts            # EXISTING: Client cert upload
│   │       ├── truststore/+server.ts       # NEW: Truststore upload
│   │       ├── enroll/+server.ts           # NEW: Certificate enrollment
│   │       └── import-package/+server.ts   # NEW: Data package import
│   └── dashboard/
```

**Structure Decision**: Server-side TAK logic stays in `src/lib/server/tak/` (existing codebase pattern). Moving TAK config UI from `TakSettingsForm.svelte` in settings/ to a new `TakConfigView.svelte` in a `tak/` subdirectory using the ToolViewWrapper inline pattern.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --------- | ---------- | ------------------------------------ |
| None      | N/A        | N/A                                  |
