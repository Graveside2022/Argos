# Contract: Hardware Dropdown Menus

**Location**: `src/lib/components/dashboard/status/`
**Container**: 260px wide, `--card` fill, `--border` border, 12px padding, 8px gap, 4px radius, drop shadow (blur 8, #00000040)

## Shared Dropdown Pattern

```html
<div class="hardware-dropdown">
	<div class="dropdown-title">{title}</div>
	<!-- Fira Code 10px 600 --foreground-secondary, letter-spacing 1.5, bottom border -->
	<div class="dropdown-rows">
		{#each rows as row}
		<div class="dropdown-row">
			<span class="row-label">{row.label}</span>
			<!-- Geist 12px --foreground-secondary -->
			<span class="row-value">{row.value}</span>
			<!-- Fira Code 12px --foreground-bright -->
		</div>
		{/each}
	</div>
</div>
```

## WiFi Adapter Dropdown

**Title**: "WIFI ADAPTER"
**Rows** (7):

| #   | Label     | Value Source     | Special                       |
| --- | --------- | ---------------- | ----------------------------- |
| 1   | Chipset   | Hardware details | —                             |
| 2   | MAC       | Hardware details | —                             |
| 3   | Driver    | Hardware details | —                             |
| 4   | Interface | Hardware details | —                             |
| 5   | Mode      | Hardware details | —                             |
| 6   | Bands     | Hardware details | —                             |
| 7   | Used by   | Service binding  | `--status-healthy` 600 weight |

**Data Source**: `/api/hardware/details` → WiFi adapter section

## SDR Radio Dropdown

**Title**: "SOFTWARE DEFINED RADIO"
**Rows** (6):

| #   | Label   | Value Source     | Special                       |
| --- | ------- | ---------------- | ----------------------------- |
| 1   | Make    | Hardware details | —                             |
| 2   | Model   | Hardware details | —                             |
| 3   | Serial  | Hardware details | —                             |
| 4   | FW API  | Hardware details | —                             |
| 5   | USB     | Hardware details | —                             |
| 6   | Used by | Service binding  | `--status-healthy` 600 weight |

**Data Source**: `/api/hardware/details` → SDR section

## GPS Receiver Dropdown

**Title**: "GPS RECEIVER"
**Rows** (8):

| #   | Label      | Value Source     | Special                                                                                            |
| --- | ---------- | ---------------- | -------------------------------------------------------------------------------------------------- |
| 1   | Fix        | GPS store        | Color-coded: 3D Fix = `--status-healthy`, 2D = `--status-warning`, No Fix = `--status-error-muted` |
| 2   | Satellites | GPS store        | PRN count + signal detail                                                                          |
| 3   | Speed      | GPS store        | m/s or km/h                                                                                        |
| 4   | Accuracy   | GPS store        | meters                                                                                             |
| —   | Divider    | —                | `--border`, full width                                                                             |
| 5   | Device     | Hardware details | Device name                                                                                        |
| 6   | Protocol   | Hardware details | NMEA version                                                                                       |

**Data Sources**: `gpsStore` (real-time) + `/api/hardware/details`

## Behavior Contract

1. Only one dropdown can be open at a time (`openDropdown` state in TopStatusBar)
2. Clicking outside closes the dropdown
3. Clicking the same indicator toggles the dropdown
4. Dropdown positions below the indicator button, aligned left
5. If no hardware detected, show "No device detected" single row
