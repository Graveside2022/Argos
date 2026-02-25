# Contract: Captures Panel

**Location**: `src/lib/components/dashboard/panels/CapturesPanel.svelte`
**Container**: Bottom panel tab content, fill width × fill height

## Layout

```html
<div class="captures-panel">
	<div class="captures-toolbar">
		<span class="captures-title">CAPTURES</span>
		<!-- Fira Code 10px 600 --foreground-secondary, letter-spacing 1.5 -->
		<span class="spacer"></span>
		<span class="captures-count">{count} signals</span>
		<!-- Fira Code 10px --muted-foreground -->
	</div>
	<div class="captures-table">
		<div class="table-header">
			<!-- --surface-header fill, Fira Code 10px 600 --foreground-secondary -->
		</div>
		<div class="table-body">
			<!-- Scrollable rows, Fira Code 11px --foreground -->
		</div>
	</div>
</div>
```

## Table Columns

| Column    | Width | Content   | Font                                  |
| --------- | ----- | --------- | ------------------------------------- |
| Frequency | 120px | MHz value | Fira Code 11px --foreground           |
| Power     | 80px  | dBm value | Fira Code 11px, color-coded by signal |
| Location  | 160px | Lat/Lon   | Fira Code 11px --foreground           |
| Time      | 100px | HH:MM:SS  | Fira Code 11px --foreground-secondary |
| Duration  | 80px  | Seconds   | Fira Code 11px --foreground-secondary |

## Empty State

When no captures exist:

- Center-aligned text: "No captures recorded" (Geist 14px --foreground-secondary)
- Sub-text: "Start a scan to begin capturing signals" (Geist 12px --muted-foreground)

## Data Source

- **API**: `/api/signals` endpoint
- **Refresh**: Reactive via WebSocket signal updates or 10s polling fallback

## Props

```typescript
{
	// No props — data fetched internally from /api/signals
}
```
