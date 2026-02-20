# Implementation Plan: MIL-STD-2525 Military Symbology & Native TAK Integration

**Branch**: `005-milsymbol-tak-integration` | **Date**: 2026-02-17 | **Spec**: [specs/005-milsymbol-tak-integration/spec.md](/specs/005-milsymbol-tak-integration/spec.md)
**Input**: Feature specification from `/specs/005-milsymbol-tak-integration/spec.md`

## Summary

This feature integrates MIL-STD-2525D military symbology into the Argos tactical map and enables bidirectional connectivity with TAK servers using native TLS and .p12 certificate authentication. It replaces the current "dots" visualization with professional standard symbols and allows the user to switch to a Google Hybrid Satellite view (or custom XYZ source) for visual parity with ATAK/WebTAK. The backend will use a persistent Node.js process to maintain the TAK connection, translating Kismet/RF detections into Cursor on Target (CoT) messages.

## Technical Context

**Language/Version**: TypeScript 5.x (Strict Mode)
**Primary Dependencies**:

- `@missioncommand/mil-sym-ts` (Client-side symbol generation)
- `@tak-ps/node-tak` (Server-side TAK connectivity)
- `maplibre-gl` (Existing map engine, adding Raster Tile support)
- `tls` / `fs` (Node.js native modules for secure cert handling)
  **Storage**:
- `rf_signals.db` (SQLite) - No schema change expected for core signals, but potential config storage.
- Filesystem: Protected directory `data/certs` (0600 permissions) for `.p12` and extracted PEM files.
  **Testing**: Vitest (Unit/Integration), Playwright (E2E)
  **Target Platform**: Linux (Raspberry Pi 5 / Kali / Parrot)
  **Project Type**: SvelteKit Web App + Node.js Service Integration
  **Performance Goals**:
- Symbol rendering < 10ms per batch.
- Map interaction > 30fps with raster tiles.
- CoT updates < 1s latency.
  **Constraints**:
- Strict CSP (Content Security Policy) for map tiles.
- Offline capability (cached tiles or graceful failure).
- Certificate security (never exposed to frontend).

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

### Article I — Comprehension & Inventory

- [x] **1.1 Comprehension**: Confirmed. Goal is visual and functional parity with TAK.
- [x] **1.2 Inventory**: Checked `src/lib/map`, `src/routes/settings`. No existing TAK integration found.

### Article II — Code Quality

- [x] **2.1 Strict Mode**: Will use `strict: true` in all new files.
- [x] **2.2 Modularity**: TAK service will be a standalone module in `src/lib/server/tak`.
- [x] **2.4 Error Handling**: Specific error classes for `TakAuthError`, `TakConnectionError`.

### Article VIII — Operations & Security

- [x] **8.1 Security**: Certificates stored with `0600` permissions. Passwords not logged.
- [x] **8.3 AI Permissions**: Will ask before installing new npm packages (`@missioncommand/mil-sym-ts`, `@tak-ps/node-tak`).

## Project Structure

### Documentation (this feature)

```text
specs/005-milsymbol-tak-integration/
├── plan.md              # This file
├── research.md          # Library analysis and architectural decisions
├── data-model.md        # TAK entities and CoT schema mapping
├── quickstart.md        # Testing and usage guide
├── contracts/           # API contracts for settings and WebSocket events
└── tasks.md             # Implementation tasks
```

### Source Code (repository root)

```text
src/
├── lib/
│   ├── map/
│   │   ├── layers/
│   │   │   ├── SatelliteLayer.ts       # New: Raster layer handler
│   │   │   └── SymbolLayer.ts          # New: MIL-STD-2525 renderer
│   │   └── symbols/
│   │       └── SymbolFactory.ts        # New: Wrapper for mil-sym-ts
│   └── server/
│       └── tak/
│           ├── TakService.ts           # New: Main service logic
│           ├── TakClient.ts            # New: @tak-ps/node-tak wrapper
│           └── CertManager.ts          # New: Secure file handling
├── routes/
│   └── api/
│       └── tak/                        # New: API endpoints
│           ├── config/
│           └── certs/
└── components/
    └── map/
        └── MapSettings.svelte          # Update: Add Provider/Layer controls
```

**Structure Decision**: Option 1 (Single Project). Integrating into existing SvelteKit structure.
