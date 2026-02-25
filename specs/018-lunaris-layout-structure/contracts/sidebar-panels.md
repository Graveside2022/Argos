# Contract: Sidebar Panels

**Location**: `src/lib/components/dashboard/panels/`
**Container**: 280px wide, `--card` fill, `--border` right border, overflow-y: auto

## System Overview (OverviewPanel)

**Section Order** (FR-003):

1. CPU — Hero metric (24px), progress bar, usage details
2. Disk — Hero metric, usage bar, capacity info
3. Memory — Hero metric, usage bar, capacity info
4. Power — Status indicator, voltage/current if available
5. Network Status — IP, latency, DNS, interface details
6. Hardware — Device list with status dots (green/red + text label)
7. Tools — Active tool count, quick launch links
8. Services — Service list with connection indicators (running/stopped)
9. Events Log — Recent events, scrollable, timestamp + message

**Section Pattern** (FR-004):

```html
<section class="sidebar-section">
	<h3 class="section-header">SECTION NAME</h3>
	<!-- 9px uppercase, letter-spacing 1.2+ -->
	<div class="hero-metric">XX%</div>
	<!-- 24px, --foreground -->
	<div class="section-content">
		<!-- Progress bar / list / rows -->
		...
	</div>
</section>
```

**Data Sources**: `systemHealth` store, `/api/system/services`, `/api/hardware/status`

## OFFNET Tools (ToolsPanel — FR-007)

Back button + "OFFNET" title. 4 category cards:

| Card      | Description          | Tool Count |
| --------- | -------------------- | ---------- |
| RECON     | Reconnaissance tools | Dynamic    |
| ATTACK    | Offensive tools      | Dynamic    |
| DEFENSE   | Defensive tools      | Dynamic    |
| UTILITIES | General utilities    | Dynamic    |

Card styling: `--surface-elevated` fill, `--border` bottom border, 8px/12px padding.

## ONNET Tools (OnnetToolsPanel — FR-008)

Back button (arrow-left + "TOOLS" in `--primary`) + "ONNET" title (Fira Code 12px 600 `--foreground-muted`, letter-spacing 1.5). 2 category cards:

| Card   | Description            |
| ------ | ---------------------- |
| RECON  | Network reconnaissance |
| ATTACK | Network attack tools   |

Same card pattern as OFFNET.

## Map Layers (LayersPanel — FR-009)

4 sections:

1. **Map Provider** — Tile selector (Tactical/Satellite), active gets 2px `--primary` border
2. **Visibility Filter** — 3-button row (All/Active/Flagged)
3. **Map Layers** — Toggle switches per layer (DeviceDots, MilSyms, ConnectionLines, CellTowers, SignalMarkers, AccuracyCircle)
4. **Signal Strength Legend** — 6 rows with colored dots + distance ranges (Very Strong → No Signal)

## Settings (SettingsPanel — FR-010)

4 category cards:

| Card             | Description                         |
| ---------------- | ----------------------------------- |
| Appearance       | Theme, palette, display preferences |
| Connectivity     | Network, VPN, mesh configuration    |
| Hardware         | GPS, SDR, WiFi device settings      |
| Logs & Analytics | Log levels, data retention, export  |

Clicking "Hardware" navigates to HardwareConfigPanel.

## Hardware Config (HardwareConfigPanel — FR-011)

Back button + "HARDWARE" header. 3 device category cards:

| Card          | Detected Devices           | Status               |
| ------------- | -------------------------- | -------------------- |
| GPS Devices   | Device name, accuracy, fix | Green/red dot + text |
| SDR Radios    | Make, model, serial        | Green/red dot + text |
| WiFi Adapters | Interface, chipset, mode   | Green/red dot + text |

Data from `/api/hardware/details` endpoint.
