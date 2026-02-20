# Research: 011 Constitutional Compliance Follow-up

**Date**: 2026-02-20
**Branch**: `011-compliance-followup`

## R-001: Remaining Boolean Properties

**Decision**: Only `running: boolean` needs renaming. `fullDuplex` is already gone.

**Findings**:

- 7 declarations of `running: boolean` found across 6 files
- 0 declarations of `fullDuplex: boolean` found (already renamed in 010 branch)
- ~30 consumer sites reference `.running` across 12+ files

**Affected type definitions** (5 interfaces):

1. `KismetStatus` in `src/lib/kismet/api.ts:17`
2. `KismetServiceStatus` in `src/lib/server/kismet/types.ts:97`
3. `KismetStatusResult` in `src/lib/server/services/kismet/kismet-control-service-extended.ts:21`
4. `GsmEvilHealth.grgsm` in `src/lib/server/services/gsm-evil/gsm-evil-health-service.ts:12`
5. `GsmEvilHealth.gsmevil` in `src/lib/server/services/gsm-evil/gsm-evil-health-service.ts:18`

**Affected return type** (1 inline type): 6. `hackrf-manager.ts:72` — `{ name: string; running: boolean }[]` return type

**Key consumers** (12 files, ~30 sites):

- `service-manager.ts` (4 sites)
- `hardware-detector.ts` (5 sites — class property, not interface)
- `resource-manager.ts` (2 sites)
- `kismet-service.ts` (2 sites)
- `ToolsNavigationView.svelte` (2 sites)
- `GsmEvilPanel.svelte` (2 sites)
- `hardware-debugger.ts` (5 sites — MCP server)
- `ToolCard.svelte` (2 CSS class selectors)

**Risk**: `hardware-detector.ts` has a private `running` property on the `HardwareMonitor` class and an `isRunning()` method that returns it. This is a class member, not an interface field — the rename may be optional (class internals are encapsulated). However, for consistency, the private field should also be renamed.

**Rationale**: Renaming `running` → `isRunning` aligns with the convention established in 010. The `hardware-detector.ts` class already has `isRunning()` method, confirming the intent.

**Alternatives considered**: Leaving `running` as-is for "verb-like" booleans — rejected because the constitution (Article II-2.3) requires the prefix unconditionally.

---

## R-002: Module-Level .subscribe() Calls

**Decision**: Create `persistedWritable()` utility for localStorage persistence. Handle the HackRF spectrum subscription separately.

**Findings**: 8 `.subscribe()` calls across 5 files:

1. `tools-store.ts:148` — persist `toolNavigationPath` to localStorage
2. `tools-store.ts:152` — persist `expandedCategories` to localStorage
3. `terminal-store.ts:85` — persist `terminalPanelState` to localStorage
4. `dashboard-store.ts:54` — persist `bottomPanelHeight` to localStorage
5. `dashboard-store.ts:58` — persist `activeBottomTab` to localStorage
6. `VisibilityEngine.ts:46` — persist `visibilityMode` to localStorage
7. `VisibilityEngine.ts:47` — persist `promotedDevices` to localStorage
8. `hackrf-service.ts:28` — spectrum data aggregation (NOT persistence)

**Pattern analysis**:

- 7 of 8 are pure localStorage persistence: subscribe → serialize → setItem
- 1 (hackrf-service.ts) is a data processing subscription with proper unsubscribe — this is a legitimate reactive subscription, not a persistence pattern. Best handled with a constitutional exemption referencing a real issue.

**Utility design**: `persistedWritable<T>(key: string, defaultValue: T, options?)` that:

- Creates a writable store
- Reads initial value from localStorage (with JSON.parse, falling back to default)
- Internally subscribes to write changes back to localStorage
- Supports custom serializer/deserializer for non-JSON types (Set, etc.)

**Rationale**: This eliminates 7 of 8 `.subscribe()` calls. The HackRF one gets a real issue reference exemption.

---

## R-003: Placeholder Issue References (#999)

**Decision**: Create 4 new GitHub issues (one per article category), then batch-replace all 54 occurrences.

**Findings**: 54 occurrences across 35 files, grouping into 4 categories:

| Category                 | Article               | Count | Description                                 |
| ------------------------ | --------------------- | ----- | ------------------------------------------- |
| Component state handling | Article-IV-4.3        | 18    | Loading/error/empty states deferred         |
| Button/UI patterns       | Article-IV-4.2        | 8     | Custom styling incompatible with shadcn     |
| Static SVG icons         | Article-IX-9.4        | 18    | Hardcoded SVG strings (safe, no user input) |
| Type narrowing           | Article-II-2.1        | 8     | External API/library type assertions        |
| HMAC salt                | Article-IX-9.1        | 1     | Auth middleware salt documentation          |
| Template example         | analysis-generator.ts | 1     | Example code in template string             |

**Plan**: Create 4 GitHub issues:

- Issue for Article-IV-4.3 (component states) — covers 18 exemptions
- Issue for Article-IV-4.2 (UI patterns) — covers 8 exemptions
- Issue for Article-IX-9.4 (SVG safety) — covers 18 exemptions
- Issue for Article-II-2.1 + IX-9.1 (type narrowing + misc) — covers 9 exemptions

The `analysis-generator.ts` template example should use a generic placeholder like `issue:NNNN` since it's a code template, not an actual exemption.

---

## R-004: Oversized Component Decomposition Strategy

**Decision**: Decompose DevicesPanel and DashboardMap as primary targets. Fix HardwareCard and GpsDropdown as secondary. Note but defer remaining 6 oversized files.

**Findings**: 10 dashboard .svelte files exceed 300 lines:

| File                      | Lines | In Spec?     |
| ------------------------- | ----- | ------------ |
| DevicesPanel.svelte       | 940   | Yes (FR-003) |
| DashboardMap.svelte       | 915   | Yes (FR-004) |
| TerminalPanel.svelte      | 742   | No           |
| AgentChatPanel.svelte     | 619   | No           |
| LayersPanel.svelte        | 467   | No           |
| TerminalTabContent.svelte | 387   | No           |
| IconRail.svelte           | 331   | No           |
| HardwareCard.svelte       | 325   | Yes (FR-005) |
| PanelContainer.svelte     | 317   | No           |
| GpsDropdown.svelte        | 315   | Yes (FR-006) |

**DevicesPanel decomposition strategy**:

- Extract filter chip bar (band/type filters) → `DeviceFilterBar.svelte`
- Extract device list with virtual scrolling → `DeviceList.svelte`
- Extract device detail view → `DeviceDetail.svelte`
- Extract whitelist management → `DeviceWhitelist.svelte`
- Keep DevicesPanel as orchestrator (~100-150 lines)

**DashboardMap decomposition strategy**:

- Extract map controls (style picker, zoom) → `MapControls.svelte`
- Extract device overlay rendering → already has `DeviceOverlay.svelte`
- Extract popup/tooltip rendering → `MapPopup.svelte`
- Extract style/layer configuration → `map-styles.ts` (utility, not component)
- Extract cone/bearing SVG generation → `map-overlays.ts` (utility)
- Keep DashboardMap as orchestrator (~200-250 lines)

**HardwareCard**: Extract each device section (HackRF, Alfa, Bluetooth) → separate mini-components (~100 lines each)

**GpsDropdown**: Extract satellite table → `SatelliteTable.svelte`

**Rationale**: Focus on spec-scoped files. The remaining 6 oversized files should be tracked in a follow-up issue.

---

## R-005: Theme Color Extraction

**Decision**: Create two dedicated constants files — one for terminal ANSI colors, one for map paint colors.

**Terminal ANSI colors** (in TerminalTabContent.svelte):

- 20+ hardcoded hex values for xterm.js theme
- These are standard ANSI color codes — they don't belong in CSS variables since they're JavaScript config, not CSS
- Best approach: `src/lib/components/dashboard/terminal/terminal-theme.ts` exporting a typed theme object

**Map paint colors** (in DashboardMap.svelte):

- ~5 hex values for MapLibre GL paint properties (`#888`, `#111119`, `#3a3a5c`, etc.)
- These are MapLibre style properties passed as JavaScript objects
- Best approach: `src/lib/components/dashboard/map/map-colors.ts` exporting named constants

**Rationale**: These colors are JavaScript constants, not CSS values. CSS variables wouldn't apply here because xterm.js and MapLibre consume JavaScript objects, not CSS. Named TypeScript constants achieve the "single location edit" goal.
