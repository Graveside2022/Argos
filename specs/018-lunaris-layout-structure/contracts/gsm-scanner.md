# Contract: GSM Scanner Layout States

**Location**: `src/routes/gsm-evil/+page.svelte` + child components in `src/lib/components/gsm-evil/`
**Container**: Full-width mode — no sidebar, fills entire content area

## State Machine

```
empty → active (on scan start) → expanded (on expand toggle)
  ↑         ↓                         ↓
  └─── (on scan stop) ←──────────────┘
```

**State derivation**: `gsmEvilStore` — empty when no scan data, active when scan running, expanded via user toggle.

## State 1: Empty

```html
<div class="gsm-scanner gsm-empty">
	<div class="gsm-header">
		<!-- 48px, --surface-elevated fill -->
		<span class="gsm-title">GSM SCANNER</span>
		<!-- Fira Code 14px 600 --foreground -->
		<span class="spacer"></span>
		<button class="scan-button">START SCAN</button>
		<!-- --primary fill, Fira Code 12px 600 -->
	</div>
	<div class="scan-results-panel">
		<!-- --surface-inset fill, --border border -->
		<div class="empty-state">
			<span>SCAN RESULTS</span>
			<!-- Fira Code 10px 600 --foreground-secondary -->
			<p>No scan data. Press START SCAN to begin.</p>
			<!-- Geist 13px --muted-foreground, centered -->
		</div>
	</div>
	<div class="console-panel">
		<div class="console-header">CONSOLE</div>
		<!-- 36px, --card fill, Fira Code 10px 600 --foreground-secondary -->
		<div class="console-body"></div>
		<!-- --surface-terminal fill, min-height 140px -->
	</div>
</div>
```

## State 2: Active

```html
<div class="gsm-scanner gsm-active">
	<div class="gsm-header">
		<!-- Same as empty, but STOP SCAN button -->
	</div>
	<div class="imsi-capture-panel">
		<div class="panel-title-row">
			<span>IMSI CAPTURE</span>
			<!-- Fira Code 10px 600 --foreground-secondary -->
			<span class="capture-count">{count}</span>
		</div>
		<div class="data-table">
			<!-- Columns: IMSI, TMSI, Carrier, LAC, Cell ID, First Seen, Last Seen -->
			<!-- Header: --surface-header, Fira Code 10px 600 -->
			<!-- Rows: Fira Code 11px --foreground, alternating --card/--background -->
		</div>
	</div>
	<div class="live-frames-panel">
		<div class="panel-header">LIVE FRAMES</div>
		<!-- 36px, --card fill -->
		<div class="panel-body"></div>
		<!-- 140px, --surface-terminal fill, monospace scrollback -->
	</div>
</div>
```

## State 3: Expanded

```html
<div class="gsm-scanner gsm-expanded">
	<div class="gsm-header">
		<!-- Same header, plus COLLAPSE toggle -->
	</div>
	<div class="imsi-table-full">
		<!-- Full-width IMSI data table, fill available height -->
	</div>
	<div class="live-frames-stacked">
		<!-- Two stacked Live Frames panels -->
		<div class="live-frames-panel">...</div>
		<div class="live-frames-panel">...</div>
	</div>
</div>
```

## IMSI Table Columns

| Column     | Width | Content         | Special                               |
| ---------- | ----- | --------------- | ------------------------------------- |
| IMSI       | 160px | 15-digit string | Fira Code 11px --foreground           |
| TMSI       | 100px | Hex value       | Fira Code 11px                        |
| Carrier    | 120px | Carrier name    | Geist 12px                            |
| LAC        | 80px  | Location area   | Fira Code 11px                        |
| Cell ID    | 80px  | Cell identifier | Fira Code 11px                        |
| First Seen | 100px | HH:MM:SS        | Fira Code 10px --foreground-secondary |
| Last Seen  | 100px | HH:MM:SS        | Fira Code 10px --foreground-secondary |

## Data Sources

- **Store**: `gsmEvilStore` from `src/lib/stores/gsm-evil/gsm-evil-store.ts`
- **API**: `/api/gsm-evil/status`, `/api/gsm-evil/scan`
- **WebSocket**: Real-time IMSI captures and frame data
