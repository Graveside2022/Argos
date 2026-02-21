# Research: Lunaris UI Redesign

**Feature**: 012-lunaris-ui-redesign | **Date**: 2026-02-21

## R-001: Font Loading Strategy

**Decision**: Self-hosted WOFF2 in `static/fonts/`
**Rationale**: No internet guarantee in field (NTC/JMRC). WOFF2 is smallest with universal support. 5 files, ~250KB total.
**Alternatives rejected**: Google Fonts CDN (no internet), system fallback (inconsistent), Fontsource npm (adds dependency)

## R-002: CSS Token Architecture

**Decision**: Single `lunaris-tokens.css` replacing 3-file system
**Rationale**: Current `app.css` (oklch) + `palantir-design-system.css` (bridge) + `dashboard.css` (layout) creates "which variable?" confusion. Single file with sections eliminates ambiguity.
**Alternatives rejected**: Keep 3-file split (same confusion), Tailwind config-only (components need var() access)

## R-003: Palette Override Removal

**Decision**: Remove `data-palette` attribute system entirely
**Rationale**: 7 palette overrides (blue, green, orange, red, rose, violet, yellow) become dead code. Lunaris uses single `--accent` token.
**Alternatives rejected**: Keep alongside Lunaris (conflicts), convert to presets (deferred to P3)

## R-004: Migration Strategy

**Decision**: Incremental by component group. Token file first, then shell, panels, cards, map, bottom panel.
**Rationale**: Big-bang rewrite of 80 components risks breakage. Incremental allows per-commit testing per Constitution Art. IX.2.
**Alternatives rejected**: Big bang (risk), feature flag toggle (complexity)

## R-005: Status Dot Replacement

**Decision**: Remove all `.status-dot` and `.status-indicator` CSS classes. Replace with text-based semantic color utilities.
**Rationale**: FR-007 mandates text labels, FR-012 mandates color-is-not-sole-indicator. Text labels with color tinting satisfy both.
**Alternatives rejected**: Keep dots alongside text (spec explicitly forbids)

## R-006: Color Format

**Decision**: Hex values (#RRGGBB), not oklch
**Rationale**: Pencil mockup uses hex. Hand-tuned values lose precision in oklch conversion. Tailwind v4 `@theme inline` accepts any CSS color format.
**Alternatives rejected**: oklch (color shift), HSL (same issue)

## R-007: Panel Width Change (320px → 280px)

**Decision**: Reduce overview panel from 320px to 280px per Lunaris mockup
**Rationale**: Mockup uses 280px. Narrower panel gives more space to the map area. Content fits at 280px with the tighter Lunaris typography (9-11px labels vs current 11-14px).
**Impact**: Existing overview card components may need tighter horizontal padding. Test at 1920x1080.

## R-008: Command Bar Height Change (48px → 40px)

**Decision**: Reduce top bar from 48px to 40px per Lunaris mockup
**Rationale**: 40px provides sufficient touch/click target while recovering 8px of vertical space for the map. Brand text at 13px + icons fit comfortably in 40px.
**Impact**: TopStatusBar.svelte layout and dropdown positioning may need adjustment.

## R-009: Existing Component Dependencies

Components currently referencing `--palantir-*` variables (must be migrated):

- `TopStatusBar.svelte`, `OverviewPanel.svelte`, `IconRail.svelte` (direct references)
- `DashboardMap.svelte`, `TowerPopup.svelte` (map chrome)
- `ResizableBottomPanel.svelte` (tab bar)
- All overview cards (SystemInfoCard, HardwareCard, ServicesCard, WifiInterfacesCard, GpsCard)
- `dashboard.css` (layout shell, Leaflet overrides)
- Various components using `.bg-surface`, `.bg-elevated`, `.text-tertiary`, `.border-subtle` utility classes

Components currently using `.status-dot` or `.status-indicator` classes (must have dots removed):

- `ServicesCard.svelte`
- `HardwareCard.svelte`
- `WifiInterfacesCard.svelte`
- `TopStatusBar.svelte` (hardware state indicators)

## R-010: Speed Test Tool Selection

**Decision**: librespeed-cli (Go static binary, v1.0.12)
**Rationale**: Field deployment on RPi 5 requires minimal resource usage and LAN/offline capability. librespeed-cli is a 3 MB static Go binary with zero runtime dependencies and pre-built ARM64 releases. It supports self-hosted LibreSpeed servers for LAN testing when internet is unavailable. JSON output enables easy parsing for the dashboard.
**Alternatives rejected**:

- Ookla speedtest CLI — proprietary, closed-source, Ookla servers only (no LAN testing), requires license acceptance
- fast-cli (sindresorhus) — requires Puppeteer/headless Chromium (~280 MB), unacceptable on memory-constrained RPi 5
- speedtest-cli (sivel) — ARCHIVED since July 2024, no longer maintained
  **Source**: https://github.com/librespeed/speedtest-cli (741 stars, LGPL-3.0, last updated Jun 2025)

## R-011: Gray Text Palette Consolidation

**Decision**: Consolidate from 8 gray text values in the mockup to 6 named tokens
**Rationale**: The mockup uses 8 distinct gray values (#FFFFFF through #555555) but two pairs are perceptually near-identical at 9-11px text sizes: #BBBBBB/#B8B9B6 (1.4% luminance difference) and #666666/#888888 (modest gap). Professional design systems (USWDS, Material, Carbon) typically define 5-7 neutral text tokens. Consolidation reduces ambiguity for implementers without visible design impact. Per dark UI best practices, fewer distinct text tones improve scannability and reduce visual noise on high-density displays.
**Token mapping**: --text-primary (#FFFFFF), --text-data (#BBBBBB, absorbs #B8B9B6), --text-secondary (#AAAAAA), --text-label (#999999), --text-tertiary (#666666, absorbs #888888), --text-disabled (#555555)
**Alternatives rejected**: Keep all 8 values as tokens (implementer confusion, phantom distinctions at small sizes)
