# Research: Lunaris Design Parity

**Feature**: 019-design-parity
**Date**: 2026-02-25

## Research Tasks

### R1: How should `persistedWritable` handle the "default vs. persisted null" problem?

**Decision**: No change needed to `persistedWritable` itself.

**Rationale**: The existing `persistedWritable` implementation in `src/lib/stores/persisted-writable.ts` checks `localStorage.getItem(key)`. If the key doesn't exist (returns `null` from `getItem`), it uses the provided default value. If the key exists with a serialized value of `'null'`, it deserializes to `null`. So:

- Fresh browser (no key) → uses new default `'terminal'` → panel opens
- User explicitly closed panel (key = `'null'`) → deserializes to `null` → panel stays closed
- User had a different tab active (key = `'chat'`) → deserializes to `'chat'` → that tab opens

This is the correct behavior. The only edge case is users who already have `activeBottomTab` persisted as `'null'` from before this change — they'll continue to see the panel closed until they clear storage or interact with it. This is acceptable.

**Alternatives considered**: Removing persistence for `activePanel` entirely (always open on load). Rejected because the spec says the user should be able to close the panel and have it stay closed during the session.

### R2: Should we use Material Symbols Sharp font for the caret icon?

**Decision**: No — use an inline SVG `<polyline>` path.

**Rationale**: The Pencil design specifies Material Symbols Sharp `keyboard_arrow_down`, but the project only loads Fira Code and Geist fonts. Adding a third font (Material Symbols) would:

1. Add ~300KB+ network weight for a single glyph
2. Violate the "no new dependencies" constraint
3. Be inconsistent — all other icons in the rail and tab bar are inline Lucide-style SVGs

An inline SVG `<polyline points="6 9 12 15 18 9">` produces a visually identical chevron-down at zero cost.

**Alternatives considered**: Loading Material Symbols Sharp as a CDN font. Rejected for weight and offline-capability reasons (Argos may run without internet).

### R3: How to implement network latency measurement without a new API?

**Decision**: Measure round-trip time of the existing `/api/system/status` health check.

**Rationale**: The `TopStatusBar` already calls `fetchHardwareStatus()` every 5 seconds (line 155-165). We can measure the `Date.now()` delta before and after this fetch to derive an approximate latency. This avoids:

1. A new API endpoint
2. An additional network request
3. Server-side ping implementation (which would need `child_process` for ICMP)

The latency value will be slightly higher than pure network RTT (includes server processing), but for field awareness purposes this is sufficient. The Pencil design shows `12ms` which is typical for localhost.

**Alternatives considered**:

- Dedicated `/api/ping` endpoint returning empty 200. Rejected — unnecessary new route.
- WebSocket ping/pong measurement. More accurate but adds complexity to the WebSocket manager.
- Navigator.sendBeacon timing. Not reliable for RTT measurement.

### R4: What determines the "REC" collection state?

**Decision**: Show "REC" when any hardware device has `active` state.

**Rationale**: The Pencil design shows "REC" (recording) not "LIVE". The `TopStatusBar` already tracks `wifiState`, `sdrState`, and `gpsState` as `DeviceState` values. If any is `'active'`, it means that device is currently collecting data. A simple derived check: `isCollecting = wifiState === 'active' || sdrState === 'active' || gpsState === 'active'`. Badge color: `var(--destructive)` = `#FF5C33`.

**Alternatives considered**: Checking Kismet/HackRF service status via API. Rejected — the hardware states already reflect whether services are actively using the devices.

### R5: Callsign configuration — hardcode or make configurable?

**Decision**: Hardcode `'ARGOS-1'` as default. Configuration is out of scope for this spec.

**Rationale**: The spec says "default: ARGOS-1" and notes future configurability via Settings. The current `locationName` reverse-geocoding can be removed from the callsign display (it was never in the design). A future spec can add a Settings field for custom callsign.

**Alternatives considered**: Adding a `ARGOS_CALLSIGN` env var. Reasonable but adds scope — deferred.

### R6: How to eliminate `--palantir-*` CSS variables?

**Decision**: Full elimination — replace every `var(--palantir-*)` reference across all **33 files** (292 refs — corrected from initial 29/206 estimate, then verified at 292/33 via codemap audit 2026-02-25T14:09Z) with the direct Lunaris token. Delete the bridge file, rename utility classes file.

**Rationale**: The `--palantir-*` variables are defined in `src/lib/styles/palantir-design-system.css` as a pure bridge — each one just maps to an existing Lunaris token (e.g., `--palantir-bg-panel: var(--card)`). This indirection layer:

1. Creates a dual-namespace confusion (developers don't know which to use)
2. Adds a file that serves no purpose once Lunaris tokens are used directly
3. Causes design drift when developers add new `--palantir-*` vars

The Lunaris tokens are already defined in `app.css`. By replacing `var(--palantir-bg-panel)` with `var(--card)` everywhere, we get:

- Single source of truth (tokens defined once in `app.css`)
- Design-code vocabulary alignment (component code matches Pencil design token names)
- One fewer file to maintain

**Scope**: **292 replacements across 33 files** (231 consumer + 61 bridge; corrected from original 206/29, then 254/32 estimates). Includes `TAKIndicator.svelte` (12 refs, outside `dashboard/` dir), `dashboard-page.css` (1 ref), `symbol-layer.ts` (1 comment ref), and `+page.svelte` (duplicate import). Additionally, the `:root` block defines non-palantir tokens (`--space-*`, `--text-*`, `--font-weight-*`, `--letter-spacing-*`, `--radius-*`) used by 274 refs across 40+ files — these MUST be migrated to `app.css` before the `:root` block is deleted. The utility classes in `palantir-design-system.css` (`.map-popup`, `.status-dot`, `.tactical-sidebar`) are kept but migrated to Lunaris tokens and the file renamed to `dashboard-utilities.css`.

**Alternatives considered**: Redefining values in place (update `--palantir-bg-panel` to point to correct hex). Lower effort but perpetuates the dead namespace. Rejected in favor of clean elimination.

### R7: Should the Icon Rail use Lucide icon fonts or continue with inline SVGs?

**Decision**: Migrate to `@lucide/svelte` component imports (already installed, v0.561.0).

**Rationale**: The Pencil design uses Lucide `icon_font` entries (`house`, `list`, `zap`, `waypoints`, `layers`, `settings`). `@lucide/svelte` v0.561.0 is already in `package.json` — no new dependency required (confirmed 2026-02-25). Import individual components: `import { House, List, Zap, Waypoints, Layers, Settings } from '@lucide/svelte'`. This will:

1. Match the design system exactly
2. Reduce component file size (no more 200-char SVG strings)
3. Ensure icon consistency across the app

**Alternatives considered**: Keep inline SVGs but update them to match Lucide's paths. Viable but maintenance-heavy when `@lucide/svelte` is already available.

### R8: Should the Bottom Panel keep dynamic terminal sessions or switch to fixed named tabs?

**Decision**: Switch to fixed named tabs (matching the Pencil design).

**Rationale**: The Pencil design shows 5 fixed tabs (Terminal, Chat, Logs, Captures, Devices) in the bottom panel. The current implementation has dynamic terminal session tabs with a separate TerminalTabBar component. The fixed approach:

1. Matches the design exactly
2. Provides consistent navigation (users always know where Terminal, Chat, etc. are)
3. Simplifies the tab management code (no dynamic session creation in the tab bar)

The dynamic terminal session management (multiple terminal tabs, tmux profiles) can still exist _within_ the Terminal tab as sub-tabs or a session picker, but the top-level tab bar should be fixed.

**Alternatives considered**: Keep dynamic tabs and add the named tabs as pinned/fixed tabs before the dynamic ones. This hybrid approach adds complexity and doesn't match the design.
