# Contract: Bottom Panel

**Components**:

- `src/lib/components/dashboard/ResizableBottomPanel.svelte` (frame)
- `src/routes/dashboard/BottomPanelTabs.svelte` (tab bar)

## Tab Order

| Index | Label    | Component        | Icon (Lucide)    |
| ----- | -------- | ---------------- | ---------------- |
| 0     | Terminal | `TerminalPanel`  | `terminal`       |
| 1     | Chat     | `AgentChatPanel` | `message-square` |
| 2     | Logs     | `LogsPanel`      | `file-text`      |
| 3     | Captures | `CapturesPanel`  | `radio`          |
| 4     | Devices  | `DevicesPanel`   | `wifi`           |

## Tab Bar Styling

```css
height: 32px;
font-family: 'Geist', sans-serif;
font-size: 14px;

.tab {
	padding: 0 12px;
	color: var(--muted-foreground);
}

.tab.active {
	color: var(--primary);
	border-bottom: 2px solid var(--primary);
}
```

## Resize Behavior

- Default height: 240px (stored as `bottomPanelHeight` in dashboard store, default 300px — update to 240px)
- Min height: 100px (tab bar stays visible when collapsed)
- Max height: 80% viewport
- Drag handle at top edge
- Map/content area adjusts via flex

## Tab Persistence

- `mountedTabs: Set<string>` tracks rendered tabs
- Tabs stay mounted after first visit (preserves terminal scrollback)
- Active tab shown via `display: flex`, inactive `display: none`

## Content Components

### CapturesPanel (NEW)

Minimal table with columns: Frequency, Power, Location, Time, Duration.
Data from `/api/signals` endpoint. Empty state when no captures.

### DevicesPanel (RESTRUCTURED — FR-020)

Toolbar:

- Search input (200px, "Search MAC or name...")
- Filter buttons: 2.4G, 5G, Hide No Signal (toggle active: `--surface-hover` fill, `--interactive` border)
- Spacer
- "Whitelisted: X MACs" counter

Table:

- Header: MAC/NAME, RSSI, CHANNEL, TYPE, CLIENTS, ENCRYPTION, FIRST SEEN, ACTIONS
- Header styling: `--surface-header` fill, Fira Code 10px 600 `--foreground-secondary`
- Data rows: alternating, selected = `--surface-hover` fill + 2px left `--interactive` border
- RSSI color-coded by signal band

### AgentChatPanel (RESTRUCTURED — FR-021)

Header (36px): `--card` fill, bot icon (`--interactive`), title, spacer, delete icon (`--muted-foreground`)
Body: AI messages (`--surface-hover` cards), user messages (`--card` cards + `--border`)
Input bar: `--card` fill, text input (32px, `--background` fill), send button (32×32px `--interactive`)

### TerminalPanel (MODIFIED — FR-022)

Existing terminal with conditional error overlay:

- `TerminalErrorOverlay` rendered when `connectionFailed === true`
- Overlay: `--overlay-backdrop` fill, centered error card
- Card: terminal icon (32px `--muted-foreground`), title (Geist 16px 600), message (Geist 14px), recovery link (Fira Code 14px `--interactive`)
