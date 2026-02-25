# Token Contract: Before → After

**Feature**: 017-lunaris-ui-unification
**Date**: 2026-02-24

This contract documents every CSS custom property change. The "Before" column shows the current value; "After" shows the Lunaris target. Token names are preserved — only values change (except where noted).

## Surface Tokens

| Token                    | Before                       | After     | Change Type         |
| ------------------------ | ---------------------------- | --------- | ------------------- |
| `--background`           | `oklch(0.141 0.005 285.823)` | `#111111` | Value replace       |
| `--foreground`           | `oklch(0.985 0 0)`           | `#FFFFFF` | Value replace       |
| `--card`                 | `oklch(0.21 0.006 285.885)`  | `#1A1A1A` | Value replace       |
| `--card-foreground`      | `oklch(0.985 0 0)`           | `#FFFFFF` | Value replace       |
| `--popover`              | `oklch(0.21 0.006 285.885)`  | `#1A1A1A` | Value replace       |
| `--popover-foreground`   | `oklch(0.985 0 0)`           | `#FFFFFF` | Value replace       |
| `--border`               | `oklch(1 0 0 / 10%)`         | `#2E2E2E` | Transparent → solid |
| `--input`                | `oklch(1 0 0 / 15%)`         | `#2E2E2E` | Transparent → solid |
| `--secondary`            | `oklch(0.274 0.006 286.033)` | `#2E2E2E` | Value replace       |
| `--secondary-foreground` | `oklch(0.985 0 0)`           | `#FFFFFF` | Value replace       |
| `--muted`                | `oklch(0.274 0.006 286.033)` | `#2E2E2E` | Value replace       |
| `--muted-foreground`     | `oklch(0.705 0.015 286.067)` | `#666666` | Value replace       |
| `--accent`               | `oklch(0.274 0.006 286.033)` | `#2E2E2E` | Value replace       |
| `--accent-foreground`    | `oklch(0.985 0 0)`           | `#FFFFFF` | Value replace       |
| `--sidebar`              | `oklch(0.21 0.006 285.885)`  | `#18181b` | Value replace       |
| `--sidebar-foreground`   | `oklch(0.985 0 0)`           | `#FFFFFF` | Value replace       |
| `--sidebar-border`       | `oklch(1 0 0 / 10%)`         | `#2E2E2E` | Transparent → solid |
| `--sidebar-ring`         | `oklch(0.421 0.095 57.708)`  | `#666666` | Value replace       |

## Accent Tokens

| Token                  | Before                                      | After                         | Change Type   |
| ---------------------- | ------------------------------------------- | ----------------------------- | ------------- |
| `--primary`            | `oklch(0.795 0.184 86.047)` (golden yellow) | `#A8B8E0` (Blue ★ steel blue) | Value replace |
| `--primary-foreground` | `oklch(0.421 0.095 57.708)`                 | `#111111`                     | Value replace |
| `--ring`               | `oklch(0.421 0.095 57.708)`                 | `#666666`                     | Value replace |

## Semantic Status Tokens

| Token                  | Before                        | After     | Change Type         |
| ---------------------- | ----------------------------- | --------- | ------------------- |
| `--success`            | `hsl(142 69% 58%)` (~#4ade80) | `#8BBFA0` | Vivid → desaturated |
| `--success-foreground` | `hsl(220 24% 7%)`             | `#111111` | Value replace       |
| `--warning`            | `hsl(43 96% 56%)` (~#fbbf24)  | `#D4A054` | Vivid → desaturated |
| `--warning-foreground` | `hsl(220 24% 7%)`             | `#111111` | Value replace       |
| `--destructive`        | `oklch(0.704 0.191 22.216)`   | `#FF5C33` | Value replace       |
| `--info`               | `hsl(217 92% 68%)` (~#60a5fa) | `#A8B8E0` | Vivid → accent blue |
| `--info-foreground`    | `hsl(220 24% 7%)`             | `#111111` | Value replace       |
| `--text-muted`         | `hsl(213 4% 39%)`             | `#666666` | Value replace       |

## New Tokens (did not exist before)

| Token              | Value              | Purpose                          |
| ------------------ | ------------------ | -------------------------------- |
| `--text-secondary` | `#BBBBBB`          | Secondary text tier              |
| `--text-tertiary`  | `#888888`          | Tertiary text tier               |
| `--text-inactive`  | `#555555`          | Inactive text                    |
| `--error-desat`    | `#C45B4A`          | Desaturated error                |
| `--inactive`       | `#555555`          | Inactive state                   |
| `--success-bg`     | `#222924`          | Success background               |
| `--warning-bg`     | `#291C0F`          | Warning background               |
| `--error-bg`       | `#24100B`          | Error background                 |
| `--info-bg`        | `#222229`          | Info background                  |
| `--widget-bg`      | `#151515`          | Widget background                |
| `--hover-tint`     | `#ffffff14`        | Hover tint                       |
| `--separator`      | `#ffffff1a`        | Fine separator                   |
| `--bar-track`      | `#1E1E1E`          | Progress bar track               |
| `--switch-off`     | `#2A2A2A`          | Toggle off state                 |
| `--font-primary`   | `var(--font-mono)` | Alias                            |
| `--font-secondary` | `var(--font-sans)` | Alias                            |
| `--text-brand`     | `0.8125rem`        | 13px brand text                  |
| `--text-status`    | `0.625rem`         | 10px status text                 |
| `--text-section`   | `0.5625rem`        | 9px section header               |
| `--text-hero`      | `1.5rem`           | 24px hero (alias for --text-2xl) |

## Removed Tokens / Classes

| Token/Class                        | Before                         | Reason                        |
| ---------------------------------- | ------------------------------ | ----------------------------- |
| `:root` (light mode block)         | 33 lines of oklch light values | Dark mode only                |
| `[data-palette='blue']` (+ 6 more) | 7 shadcn palette blocks        | Replaced by 13 Lunaris themes |
| `.glass-panel`                     | backdrop-blur-xl               | Lunaris: opaque only          |
| `.glass-panel-light`               | backdrop-blur-md               | Lunaris: opaque only          |
| `.glass-button`                    | backdrop-blur-sm               | Lunaris: opaque only          |
| `.glass-input`                     | backdrop-blur-sm               | Lunaris: opaque only          |
| `.shadow-red-glow`                 | box-shadow glow                | Lunaris: no glows             |
| `.shadow-mono-glow`                | box-shadow glow                | Lunaris: no glows             |
| `.accent-glow`                     | box-shadow glow                | Lunaris: no glows             |
| `.accent-glow-strong`              | box-shadow glow                | Lunaris: no glows             |
| Signal indicator box-shadows       | colored glow per signal        | Lunaris: flat fills           |
| Status dot box-shadows             | colored glow per status        | Lunaris: flat fills           |

## Palette System Change

### Before (7 shadcn palettes)

```
default | blue | green | orange | red | rose | violet | yellow
```

Each has `:root[data-palette]` + `.dark[data-palette]` blocks (2 CSS rules per palette, 14 total).

### After (13 Lunaris themes)

```
ash | blue | blush | iron | iris | khaki | mauve | pewter | plum | rose | sand | silver | violet
```

Each has ONE `[data-palette]` rule (dark-only, 13 total). Only `--primary` changes.

## Font Stack Change

### Before

```css
--font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
--font-mono: 'SF Mono', 'Fira Code', 'Cascadia Code', 'JetBrains Mono', monospace;
body:
	'Inter',
	system-ui,
	-apple-system,
	sans-serif;
```

### After

```css
--font-sans: 'Geist', system-ui, sans-serif;
--font-mono: 'Fira Code', 'JetBrains Mono', monospace;
--font-primary: var(--font-mono);
--font-secondary: var(--font-sans);
body: 'Geist', system-ui, sans-serif;
```

## Layout Dimension Change

| Dimension                 | Before  | After              |
| ------------------------- | ------- | ------------------ |
| `--panel-width`           | `320px` | `280px`            |
| `--top-bar-height`        | `48px`  | `40px`             |
| `--icon-rail-width`       | `48px`  | `48px` (no change) |
| `.tactical-sidebar` width | `320px` | `280px`            |
