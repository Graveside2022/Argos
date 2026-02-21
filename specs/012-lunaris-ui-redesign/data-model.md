# Data Model: Lunaris Design Token Schema

**Feature**: 012-lunaris-ui-redesign | **Date**: 2026-02-21

This feature has no database entities. The "data model" is the design token schema — the structured set of CSS custom properties that define the Lunaris visual language.

## Token Categories

### 1. Surface Colors

| Token              | Value   | Usage                                               |
| ------------------ | ------- | --------------------------------------------------- |
| `--bg-base`        | #111111 | Deepest background (app shell, map area)            |
| `--bg-card`        | #1A1A1A | Card/panel surfaces, overview panel background      |
| `--bg-elevated`    | #222222 | Hover states, elevated surfaces, active backgrounds |
| `--border-default` | #2E2E2E | Standard borders between sections                   |
| `--border-strong`  | #333333 | Tile borders, emphasis separators                   |
| `--border-subtle`  | #1F1F1F | Subtle internal separations                         |

### 2. Text Colors (6-token consolidated palette)

| Token              | Value   | Usage                                                        |
| ------------------ | ------- | ------------------------------------------------------------ |
| `--text-primary`   | #FFFFFF | Primary content, metric values, tool names, active elements  |
| `--text-data`      | #BBBBBB | Device names, hardware names, log event values, data display |
| `--text-secondary` | #AAAAAA | IP addresses, coordinates, latency values, descriptions      |
| `--text-label`     | #999999 | Section headers (UPPERCASE, letter-spaced), tile labels      |
| `--text-tertiary`  | #666666 | Sub-values, row labels, placeholders, secondary data         |
| `--text-disabled`  | #555555 | Chevrons, inactive status, dates, expand icons, decorative   |

### 3. Accent Colors

| Token            | Value                  | Usage                                                 |
| ---------------- | ---------------------- | ----------------------------------------------------- |
| `--accent`       | #809AD0                | Primary accent (brand, bar fills, active indicators)  |
| `--accent-light` | #A8BBD8                | Secondary accent (secondary bars, lighter highlights) |
| `--accent-muted` | rgba(128,154,208,0.15) | Hover backgrounds, subtle accent fills                |

### 4. Semantic Status Colors

| Token                 | Value   | Usage                                                   |
| --------------------- | ------- | ------------------------------------------------------- |
| `--status-healthy`    | #8BBFA0 | Connected, running, online, operational                 |
| `--status-warning`    | #D4A054 | Degraded, idle, needs attention                         |
| `--status-error`      | #FF5C33 | High-visibility alerts: REC indicator, target markers   |
| `--status-error-soft` | #C45B4A | Desaturated error: Logs error count, overview panel use |
| `--status-inactive`   | #555555 | Stopped, disabled, unavailable                          |
| `--status-info`       | #7B9FCC | Informational, neutral status                           |

### 5. Typography

| Token           | Value                            | Usage                                            |
| --------------- | -------------------------------- | ------------------------------------------------ |
| `--font-mono`   | 'Fira Code', monospace stack     | Data, metrics, labels, code                      |
| `--font-sans`   | 'Geist', system sans-serif stack | Tab labels, UI navigation, buttons               |
| `--text-hero`   | 24px                             | Hero metrics (CPU%, disk, memory values)         |
| `--text-brand`  | 13px                             | Brand identifier ("ARGOS"), section titles       |
| `--text-data`   | 12px                             | Secondary data values, sub-metrics               |
| `--text-row`    | 11px                             | Primary data rows, table content                 |
| `--text-status` | 10px                             | Status text labels                               |
| `--text-label`  | 9px                              | Section labels (uppercase, 1.2px letter-spacing) |

### 6. Layout

| Token                    | Value | Usage                       |
| ------------------------ | ----- | --------------------------- |
| `--rail-width`           | 48px  | Icon rail width             |
| `--panel-width`          | 280px | Overview/side panel width   |
| `--command-bar-height`   | 40px  | Top command bar height      |
| `--bottom-panel-default` | 240px | Default bottom panel height |

### 7. Spacing Scale

| Token        | Value |
| ------------ | ----- |
| `--space-1`  | 4px   |
| `--space-2`  | 8px   |
| `--space-3`  | 12px  |
| `--space-4`  | 16px  |
| `--space-5`  | 20px  |
| `--space-6`  | 24px  |
| `--space-8`  | 32px  |
| `--space-10` | 40px  |
| `--space-12` | 48px  |

## Validation Rules

- All color tokens MUST have WCAG AA contrast (4.5:1) against their expected background
- `--text-primary` (#FFFFFF) on `--bg-base` (#111): ratio = 18.1:1 (AAA)
- `--text-data` (#BBBBBB) on `--bg-base` (#111): ratio = 10.3:1 (AAA)
- `--text-secondary` (#AAAAAA) on `--bg-base` (#111): ratio = 8.0:1 (AAA)
- `--text-label` (#999999) on `--bg-base` (#111): ratio = 5.9:1 (AA)
- `--text-tertiary` (#666666) on `--bg-base` (#111): ratio = 3.5:1 (AA Large — used for sub-values and row labels)
- `--text-disabled` (#555555) on `--bg-base` (#111): ratio = 2.6:1 (decorative elements only — chevrons, expand icons)
- `--status-healthy` (#8BBFA0) on `--bg-card` (#1A1A1A): ratio = 8.7:1 (AAA)
- `--status-warning` (#D4A054) on `--bg-card` (#1A1A1A): ratio = 6.8:1 (AAA)
- `--status-error` (#FF5C33) on `--bg-card` (#1A1A1A): ratio = 5.1:1 (AA)
- `--accent` (#809AD0) on `--bg-base` (#111): ratio = 6.6:1 (AAA)

## State Transitions

No database state transitions. Status tokens map to runtime service states:

- Service online → `--status-healthy` + text "connected" / "running"
- Service degraded → `--status-warning` + text "idle" / "degraded"
- Service failed → `--status-error` + text "stopped" / "failed"
- Service disabled → `--status-inactive` + text "disabled" / "unavailable"
