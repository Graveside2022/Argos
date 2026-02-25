# Contract: Command Bar (TopStatusBar)

**Component**: `src/lib/components/dashboard/TopStatusBar.svelte`
**Type**: Status display with dropdown menus

## Segment Layout

```
|--ARGOS--|●|--NODE--|────────────spacer────────────|--LATENCY--|--MESH--|--WEATHER--|--DATE--|--ZULU--|
```

| #   | Segment    | Content                      | Font               | Color                | Spacing               |
| --- | ---------- | ---------------------------- | ------------------ | -------------------- | --------------------- |
| 1   | Brand      | "ARGOS"                      | Fira Code 14px 600 | `--primary`          | letter-spacing: 2px   |
| 2   | Collection | Red dot (8px) when recording | —                  | `--destructive`      | margin: 0 8px         |
| 3   | Callsign   | Node hostname / config       | Fira Code 12px 500 | `--foreground`       | letter-spacing: 1px   |
| —   | Spacer     | —                            | —                  | —                    | flex: 1               |
| 4   | Latency    | Signal icon + "XXms"         | Fira Code 12px     | `--foreground`       | —                     |
| 5   | Mesh       | "X/Y" (connected/total)      | Fira Code 12px     | `--foreground`       | —                     |
| 6   | Weather    | Temp + condition icon        | Fira Code 12px     | `--foreground`       | —                     |
| 7   | Date       | "DD MMM YYYY"                | Fira Code 12px     | `--muted-foreground` | letter-spacing: 0.5px |
| 8   | Zulu       | "HH:MM:SSZ"                  | Fira Code 12px 600 | `--foreground`       | letter-spacing: 1px   |

## Container Styling

```css
height: 40px;
background: var(--card);
border-bottom: 1px solid var(--border);
padding: 0 16px;
gap: 12px;
display: flex;
align-items: center;
```

## Hardware Indicator Buttons

WiFi, SDR, GPS indicators are clickable buttons within the command bar that open dropdown menus. They sit between the callsign and the spacer (or integrated with the left group).

## Data Sources

| Segment    | Source                                        | Refresh          |
| ---------- | --------------------------------------------- | ---------------- |
| Collection | TBD (recording state)                         | Real-time        |
| Callsign   | Config / hostname                             | Static           |
| Latency    | `/api/system/metrics` or `systemHealth` store | 5s poll          |
| Mesh       | TAK store or `/api/tak/connection`            | Real-time via WS |
| Weather    | `/api/weather/current?lat=&lon=`              | 10-min poll      |
| Date/Zulu  | `Date.now()`                                  | 1s interval      |
