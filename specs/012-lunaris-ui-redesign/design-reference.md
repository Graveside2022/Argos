# Lunaris Design Reference — Extracted from pencil-lunaris.pen

**Source**: `docs/designs/pencil-lunaris.pen`
**Primary Node**: `yHSs9` — "Argos — Lunaris [Steel Blue Accent]"
**Secondary Node**: `sUfN2` — "Argos — Variant B (Lunaris)" (orange accent, layout reference)
**Extracted**: 2026-02-21

> Screenshots are captured via Pencil MCP `get_screenshot` tool on nodes yHSs9 and sUfN2.
> This document preserves the structural data so implementation doesn't require re-reading the .pen file.

---

## Layout Structure (1440×900 canvas)

```
┌──────────────────────────────────────────────────────────────────┐
│ Icon Rail (48px) │ Right Area (fill)                             │
│                  │ ┌────────────────────────────────────────────┐│
│  navTerminal     │ │ Command Bar (40px height, full width)     ││
│  navOverview     │ │ ARGOS | REC | NODE VIPER-6 | ... | 20:45Z││
│  navDevices      │ ├────────────────────────────────────────────┤│
│  navTools        │ │ Content Area (862px)                      ││
│  ─── spacer ───  │ │ ┌──────────┬─────────────────────────────┐││
│  argosLogo       │ │ │Overview  │ Map Area (fill)             │││
│  navLayers       │ │ │Panel     │                             │││
│  navSettings     │ │ │(280px)   │   AP markers (steel blue)   │││
│                  │ │ │          │   Target markers (red)      │││
│                  │ │ │ cpuTile  │                             │││
│                  │ │ │ diskTile │   Map Legend (bottom-left)  │││
│                  │ │ │ memTile  │   Zoom Controls (bot-right) │││
│                  │ │ │ pwrTile  │                             │││
│                  │ │ │ netBlock │                             │││
│                  │ │ │ hwBlock  ├─────────────────────────────┤││
│                  │ │ │ toolsBlk │ Bottom Panel (240px)       │││
│                  │ │ │ svcBlock │ Tab Bar: Terminal|Chat|Logs│││
│                  │ │ │ logBlock │         Captures|Net Map    │││
│                  │ │ └──────────┴─────────────────────────────┘││
│                  │ └────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────┘
```

---

## Icon Rail (node: ROxEh)

- **Width**: 48px, **Background**: `$--sidebar` (#18181b dark)
- **Border**: right 1px `$--sidebar-border`
- **Padding**: 10px vertical, **Gap**: 8px
- **Icon library**: Lucide
- **Icon size**: 18×18 (logo 20×20)

| Order | Name        | Icon (Lucide) | Fill Color              | Notes                                                   |
| ----- | ----------- | ------------- | ----------------------- | ------------------------------------------------------- |
| 1     | navTerminal | `terminal`    | #809AD0 (accent)        | Terminal shortcut, accent fill                          |
| 2     | (separator) | —             | `$--sidebar-border` 1px | Horizontal line                                         |
| 3     | navOverview | `house`       | #FFFFFF                 | Active state                                            |
| 4     | navDevices  | `list`        | `$--sidebar-foreground` | Inactive                                                |
| 5     | navTools    | `swords`      | `$--sidebar-foreground` | Inactive                                                |
| —     | (spacer)    | —             | —                       | fill_container                                          |
| 6     | argosLogo   | `waypoints`   | #FFFFFF                 | Brand mark, 20×20, future feature (not yet implemented) |
| 7     | navLayers   | `layers`      | `$--sidebar-foreground` | Inactive                                                |
| 8     | (separator) | —             | `$--sidebar-border` 1px | Horizontal line                                         |
| 9     | navSettings | `settings`    | `$--sidebar-foreground` | Inactive                                                |

**Active state**: Fill = #FFFFFF (full white)
**Inactive state**: Fill = `$--sidebar-foreground` (#808080 dark mode)
**Terminal shortcut**: `terminal` icon at top of rail, always accent (#809AD0) — focuses bottom panel terminal
**Logo**: `waypoints` (polyline) icon, 20×20, always #FFFFFF — positioned below spacer. Reserved for a future feature (not yet implemented); currently renders as a static brand watermark.

---

## Command Bar (node: 7lftm)

- **Height**: 40px, **Background**: `$--card` (#1A1A1A)
- **Border**: bottom 1px `$--border` (#2E2E2E)
- **Padding**: 0 16px, **Gap**: 12px
- **Alignment**: center vertical

| Element     | Content        | Font      | Size | Weight | Color            | Notes                |
| ----------- | -------------- | --------- | ---- | ------ | ---------------- | -------------------- |
| brandIcon   | terminal       | Lucide    | 16px | —      | #809AD0 (accent) | Brand logo icon      |
| brandLabel  | "ARGOS"        | Fira Code | 13px | 700    | #809AD0 (accent) | letter-spacing: 2    |
| recDot      | (circle)       | —         | 6×6  | —      | #FF5C33 (error)  | Ellipse, not text    |
| recText     | "REC"          | Fira Code | 10px | 600    | #FF5C33          | letter-spacing: 1    |
| nodeLabel   | "NODE VIPER-6" | Fira Code | 12px | 500    | $--foreground    | letter-spacing: 1    |
| (spacer)    | —              | —         | —    | —      | —                | fill_container       |
| netIcon     | signal         | Lucide    | 12px | —      | #809AD0          | Network latency icon |
| netText     | "47ms"         | Fira Code | 11px | normal | #666666          |                      |
| meshIcon    | network        | Lucide    | 12px | —      | #809AD0          | Mesh status icon     |
| meshNum     | "3"            | Fira Code | 11px | 600    | #809AD0          | Active nodes         |
| meshSlash   | "/"            | Fira Code | 11px | normal | #666666          |                      |
| meshDenom   | "4"            | Fira Code | 11px | normal | #666666          | Total nodes          |
| weatherIcon | cloud-sun      | Lucide    | 14px | —      | $--muted-fg      |                      |
| weatherText | "72°F Clear"   | Geist     | 11px | normal | $--muted-fg      | Only sans-serif here |
| milDate     | "2026-02-20"   | Fira Code | 11px | normal | #555555          | letter-spacing: 0.5  |
| milTime     | "20:45Z"       | Fira Code | 11px | 600    | $--foreground    | letter-spacing: 1    |

---

## Overview Panel (node: Xw9vi)

- **Width**: 280px, **Background**: `$--card` (#1A1A1A)
- **Border**: right 1px `$--border`
- **Layout**: vertical, clip: true

### Header (node: 5PsBP)

- Height: 40px, padding: 0 16px
- "SYSTEM OVERVIEW" — Fira Code 11px weight 600, color $--muted-foreground, letter-spacing 1.5
- No expand icon (removed — expand icon retained only on Logs block)

### Metric Tiles (4 identical structures)

Each tile: **72px height**, fill #111111, border-bottom 1px #2E2E2E

| Tile     | Node  | Label    | Value    | Sub-value    | Bar Fill            |
| -------- | ----- | -------- | -------- | ------------ | ------------------- |
| cpuTile  | 4VVOy | "CPU"    | "47%"    | "52°C"       | 115px/fill (accent) |
| diskTile | 3y7rL | "DISK"   | "127 GB" | "254 GB"     | accent              |
| memTile  | 8efBu | "MEMORY" | "5.2 GB" | "8 GB Total" | accent              |
| pwrTile  | zojot | "POWER"  | "78%"    | "4.5V USB-C" | accent              |

**Typography inside tiles**:

- Label: Fira Code 9px, weight 600, #999999, letter-spacing 1.2, UPPERCASE
- Value: Fira Code 24px, weight bold, #FFFFFF
- Sub-value: Fira Code 12px, weight normal, #666666
- Progress bar track: #222222, height 2px, cornerRadius 1
- Progress bar fill: #809AD0 (accent), height 2px, cornerRadius 1

### Network Block (node: bFfMZ)

- Header: "NETWORK STATUS" + "connected" status text
- Rows: Host IP, VPN IP+latency, ATAK server+latency
- Speed Test button: cornerRadius 3, fill #1A1A1A, border #2E2E2E, gauge icon + "Speed Test" text
- Label text: #666666, 9px | Value text: #AAAAAA, 9px | Latency: #666666, 9px

### Hardware Block (node: PShzr)

- Header: "HARDWARE" — same label styling as tiles
- Rows: device name (#BBBBBB, 11px) + status text (#8BBFA0 "connected" / "monitor")
- Row height: 20px, gap 8px

### Tools Block (node: AHCAv)

- Header: "TOOLS"
- Rows: tool name (#FFFFFF, 11px) + status + chevron "›" (#555555, 13px)
- Status colors: #8BBFA0 running time, #D4A054 "idle", #555555 "stopped"

### Services Block (node: kmda1)

- Header: "SERVICES"
- Rows: service name (#BBBBBB, 11px) + uptime (#8BBFA0) + chevron spacer (8px)
- Single row shown: gpsd "12h 07m"

### Logs Block (node: LhR9C)

- Header row: "LOGS" label + expand icon (maximize-2, #555555, 12px) — no badge (count shown in Events row only)
- Data rows (18px height each):
    - "Events 24h" → "147" (#BBBBBB, 11px, weight 600)
    - "Warnings" → "3" (#D4A054 warning color, 11px, weight 600)
    - "Errors" → "0" (#C45B4A desaturated error — always red regardless of value, 11px, weight 600)
    - "Last alert" → "12m ago" (#AAAAAA, 10px, normal)
- Row labels: #666666, 9px | Spacer line: fill_container height 1

---

## Map Area (node: YPlqr)

- **Background**: `$--background` (#111111)
- **Grid lines**: #1A1A1A, 1px — horizontal at y=155, 310, 465; vertical at x=278, 556, 834
- **AP Markers**: 6×6 ellipses, fill #809AD0 (accent)
- **Target Markers**: 6×6 ellipses, fill #FF5C33 (error)
- **Map Legend** (node: UmNjk): cornerRadius 4, fill #111111CC (80% opacity), padding 8 14
    - GPS row: "GPS 7 SAT" (#809AD0 accent, 10px, 600) · "Fort Irwin, CA" (#AAAAAA, 10px)
    - Coords row: "35.2631°N 116.6837°W" + MGRS + "920m ASL"
- **Zoom Controls**: framed buttons 28×28, $--card background, $--border stroke

---

## Bottom Panel (node: rXcq2)

- **Height**: 240px, **Background**: `$--card` (#1A1A1A)
- **Border**: top 1px `$--border`
- **Layout**: vertical, clip: true

### Tab Bar (node: CKyJy)

- Height: 40px, padding: 4 12px, gap: 4px
- Font: **Geist** (sans-serif), 14px, weight 500
- Active tab: fill $--background, cornerRadius 6px, border 1px, shadow, text #809AD0 (accent). Terminal tab includes `plus` icon (12px, #555555) for new tmux windows.
- Inactive tab: no fill, cornerRadius 6px, text $--muted-foreground
- Collapse icon: `keyboard_arrow_down` (Material Symbols Sharp), 16×16, $--muted-foreground
- Tab labels: "Terminal" | "Chat" | "Logs" | "Captures" | "Network Map"

### Terminal Body (node: 3sibR)

- Background: #0A0A0A (near-black), padding 12px, gap 2px

---

## Color Reference (Dark Mode)

### Surfaces

| Token         | Hex     | Usage                                            |
| ------------- | ------- | ------------------------------------------------ |
| $--background | #111111 | Base background, map area, tile fill             |
| $--card       | #1A1A1A | Card/panel surfaces, command bar, speed test btn |
| $--border     | #2E2E2E | Standard borders                                 |
| $--muted      | #2E2E2E | Secondary backgrounds                            |
| #222222       | —       | Progress bar track, elevated surfaces            |
| #333333       | —       | Tile borders (--border-strong)                   |
| #1F1F1F       | —       | Subtle borders                                   |
| #0A0A0A       | —       | Terminal body background                         |

### Text

| Token              | Color   | Usage                                                                  |
| ------------------ | ------- | ---------------------------------------------------------------------- |
| `--text-primary`   | #FFFFFF | Primary text, metric values, tool names                                |
| `--text-data`      | #BBBBBB | Device names, hardware names, log event values, inactive tabs, weather |
| `--text-secondary` | #AAAAAA | IP values, latency, log row values, coordinates                        |
| `--text-label`     | #999999 | Section labels (UPPERCASE), tile labels                                |
| `--text-tertiary`  | #666666 | Sub-values, row labels, network latency, speed test text               |
| `--text-disabled`  | #555555 | Chevrons, inactive status, date, expand icons                          |

### Accent (Steel Blue)

| Color   | Usage                                                                     |
| ------- | ------------------------------------------------------------------------- |
| #809AD0 | Brand text, accent icons, mesh count, progress bars, AP markers, GPS text |

### Semantic Status

| Color   | Meaning            | Examples                                |
| ------- | ------------------ | --------------------------------------- |
| #8BBFA0 | Healthy/Running    | "connected", "monitor", uptime          |
| #D4A054 | Warning/Idle       | "idle"                                  |
| #FF5C33 | Error/Alert (high) | "REC" indicator, target markers         |
| #C45B4A | Error/Soft (panel) | Logs error count, overview panel errors |
| #555555 | Inactive/Stopped   | "stopped"                               |

### Typography

| Font      | Usage                                                                            |
| --------- | -------------------------------------------------------------------------------- |
| Fira Code | ALL data: metrics, labels, IPs, coordinates, status text, section headers        |
| Geist     | Tab labels ("Terminal", "Chat", "Logs", "Captures", "Network Map"), weather text |

### Icon Libraries

| Library                | Usage                                                                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Lucide                 | All navigation and status icons (waypoints, house, list, swords, layers, settings, terminal, signal, network, cloud-sun, maximize-2, gauge) |
| Material Symbols Sharp | Bottom panel collapse caret (`keyboard_arrow_down`)                                                                                         |

---

## Speed Test Button (node: BmHMm)

Located in Network Block. Design spec:

- Height: 24px, cornerRadius: 3
- Background: #1A1A1A ($--card)
- Border: 1px #2E2E2E
- Icon: `gauge` (Lucide), 11×11, #666666
- Text: "Speed Test", Fira Code 9px, weight 500, #666666
- Layout: center justified, gap 6px
- Width: fill_container
