# Data Model: Lunaris CSS Token System

**Feature**: 017-lunaris-ui-unification
**Date**: 2026-02-24

This document defines the complete CSS token model for the Lunaris design system. Every token, its value, and its purpose are listed below. This is the single source of truth for CSS custom properties in Argos after the unification.

## Token Architecture

```
:root (app.css)                     ← Layer 1: Base tokens (Lunaris hex values)
  ├── Surface: --background, --card, --border, --secondary, --muted, etc.
  ├── Accent:  --primary, --primary-foreground, --ring
  ├── Text:    --foreground, --text-secondary, --text-tertiary, --muted-foreground, --text-inactive
  ├── Semantic: --success, --warning, --destructive, --error-desat, --inactive
  ├── Status BG: --success-bg, --warning-bg, --error-bg, --info-bg
  ├── Signal:  --signal-very-strong, --signal-strong, etc.
  ├── Font:    --font-mono, --font-sans, --font-primary, --font-secondary
  ├── Type:    --text-hero, --text-brand, --text-sm, --text-xs, --text-status, --text-section
  └── Layout:  --panel-width, --top-bar-height, --icon-rail-width

[data-palette='...'] (app.css)      ← Layer 1a: Accent overrides (only --primary changes)

@theme inline (app.css)             ← Layer 1b: Tailwind bridge (--color-X: var(--X))

palantir-design-system.css          ← Layer 2: Alias layer (--palantir-* → base tokens)
  └── Spacing, radius, component classes

dashboard.css                       ← Layer 3: Layout layout classes
```

## Layer 1: Base Tokens (`:root` in app.css)

### Surface Tokens

| Token                          | Value                       | Purpose                              |
| ------------------------------ | --------------------------- | ------------------------------------ |
| `--background`                 | `#111111`                   | App background (deepest black)       |
| `--card`                       | `#1A1A1A`                   | Card/panel surfaces                  |
| `--card-foreground`            | `#FFFFFF`                   | Text on card surfaces                |
| `--popover`                    | `#1A1A1A`                   | Popover/dropdown background          |
| `--popover-foreground`         | `#FFFFFF`                   | Text in popovers                     |
| `--border`                     | `#2E2E2E`                   | Borders and dividers (solid, opaque) |
| `--input`                      | `#2E2E2E`                   | Input field borders/backgrounds      |
| `--secondary`                  | `#2E2E2E`                   | Secondary backgrounds                |
| `--secondary-foreground`       | `#FFFFFF`                   | Text on secondary backgrounds        |
| `--muted`                      | `#2E2E2E`                   | Muted backgrounds                    |
| `--muted-foreground`           | `#666666`                   | Muted text (placeholders, hints)     |
| `--accent`                     | `#2E2E2E`                   | Accent background (neutral)          |
| `--accent-foreground`          | `#FFFFFF`                   | Text on accent background            |
| `--sidebar`                    | `#18181b`                   | Sidebar/icon rail background         |
| `--sidebar-foreground`         | `#FFFFFF`                   | Sidebar text                         |
| `--sidebar-primary`            | `var(--primary)`            | Sidebar active item                  |
| `--sidebar-primary-foreground` | `var(--primary-foreground)` | Sidebar active text                  |
| `--sidebar-accent`             | `#2E2E2E`                   | Sidebar hover                        |
| `--sidebar-accent-foreground`  | `#FFFFFF`                   | Sidebar hover text                   |
| `--sidebar-border`             | `#2E2E2E`                   | Sidebar border                       |
| `--sidebar-ring`               | `#666666`                   | Sidebar focus ring                   |
| `--widget-bg`                  | `#151515`                   | Widget card backgrounds              |
| `--hover-tint`                 | `#ffffff14`                 | Hover/active state tint (white 8%)   |
| `--separator`                  | `#ffffff1a`                 | Fine separators (white 10%)          |
| `--bar-track`                  | `#1E1E1E`                   | Progress bar track background        |
| `--switch-off`                 | `#2A2A2A`                   | Toggle switch off state              |

### Accent Tokens

| Token                  | Value     | Purpose                    |
| ---------------------- | --------- | -------------------------- |
| `--primary`            | `#A8B8E0` | Default accent (Blue ★)    |
| `--primary-foreground` | `#111111` | Text on accent backgrounds |
| `--ring`               | `#666666` | Focus ring                 |

### Text Hierarchy

| Token              | Value     | Purpose                    |
| ------------------ | --------- | -------------------------- |
| `--foreground`     | `#FFFFFF` | Primary text               |
| `--text-secondary` | `#BBBBBB` | Secondary text             |
| `--text-tertiary`  | `#888888` | Tertiary text (timestamps) |
| `--text-inactive`  | `#555555` | Inactive/disabled text     |

### Semantic Status

| Token                      | Value     | Purpose                       |
| -------------------------- | --------- | ----------------------------- |
| `--success`                | `#8BBFA0` | Healthy (muted sage green)    |
| `--success-foreground`     | `#111111` | Text on success background    |
| `--warning`                | `#D4A054` | Warning (warm gold)           |
| `--warning-foreground`     | `#111111` | Text on warning background    |
| `--destructive`            | `#FF5C33` | Error high-visibility         |
| `--destructive-foreground` | `#FFFFFF` | Text on error background      |
| `--error-desat`            | `#C45B4A` | Error desaturated (panel use) |
| `--inactive`               | `#555555` | Inactive/offline              |
| `--info`                   | `#A8B8E0` | Info (reuses accent blue)     |
| `--info-foreground`        | `#111111` | Text on info background       |

### Status Backgrounds

| Token          | Value     | Purpose                   |
| -------------- | --------- | ------------------------- |
| `--success-bg` | `#222924` | Success tinted background |
| `--warning-bg` | `#291C0F` | Warning tinted background |
| `--error-bg`   | `#24100B` | Error tinted background   |
| `--info-bg`    | `#222229` | Info tinted background    |

### Signal Strength

| Token                  | Value     | Purpose                            |
| ---------------------- | --------- | ---------------------------------- |
| `--signal-very-strong` | `#C45B4A` | Closest tower (reuses error-desat) |
| `--signal-strong`      | `#D4A054` | Strong (reuses warning)            |
| `--signal-good`        | `#C4A84A` | Good (unique warm yellow-green)    |
| `--signal-fair`        | `#8BBFA0` | Fair (reuses success)              |
| `--signal-weak`        | `#809AD0` | Weak (accent blue variant)         |
| `--signal-none`        | `#555555` | No RSSI (reuses inactive)          |

### Chart Colors

| Token       | Value     | Purpose                        |
| ----------- | --------- | ------------------------------ |
| `--chart-1` | `#A8B8E0` | Chart series 1 (accent blue)   |
| `--chart-2` | `#8BBFA0` | Chart series 2 (success green) |
| `--chart-3` | `#D4A054` | Chart series 3 (warning gold)  |
| `--chart-4` | `#BDB2D4` | Chart series 4 (violet)        |
| `--chart-5` | `#C45B4A` | Chart series 5 (error desat)   |

### Font Stacks

| Token              | Value                                      | Purpose                       |
| ------------------ | ------------------------------------------ | ----------------------------- |
| `--font-mono`      | `'Fira Code', 'JetBrains Mono', monospace` | Monospace: data, metrics, IPs |
| `--font-sans`      | `'Geist', system-ui, sans-serif`           | Sans-serif: nav chrome, tabs  |
| `--font-primary`   | `var(--font-mono)`                         | Alias for data font           |
| `--font-secondary` | `var(--font-sans)`                         | Alias for UI chrome font      |

### Typography Scale

| Token            | Value              | Purpose                                            |
| ---------------- | ------------------ | -------------------------------------------------- |
| `--text-hero`    | `1.5rem` (24px)    | Hero metrics                                       |
| `--text-brand`   | `0.8125rem` (13px) | Brand text                                         |
| `--text-sm`      | `0.75rem` (12px)   | Secondary data                                     |
| `--text-xs`      | `0.6875rem` (11px) | Primary data rows                                  |
| `--text-status`  | `0.625rem` (10px)  | Status text                                        |
| `--text-section` | `0.5625rem` (9px)  | Section headers (UPPERCASE, letter-spacing 1.2px+) |
| `--text-base`    | `0.875rem` (14px)  | Body/brand mark (utility, not in 6-step)           |
| `--text-lg`      | `1rem` (16px)      | Large text (utility)                               |

### Layout

| Token               | Value   | Purpose                     |
| ------------------- | ------- | --------------------------- |
| `--panel-width`     | `280px` | Overview panel width        |
| `--top-bar-height`  | `40px`  | Command bar height          |
| `--icon-rail-width` | `48px`  | Icon rail width (unchanged) |

### Radius

| Token      | Value     |
| ---------- | --------- |
| `--radius` | `0.65rem` |

## Layer 1a: Accent Themes (13 palettes)

Each palette only overrides `--primary`. All other tokens stay constant.

```css
/* No data-palette attribute = Blue ★ default (--primary: #A8B8E0) */
[data-palette='ash'] {
	--primary: #aeaeb4;
}
[data-palette='blue'] {
	--primary: #a8b8e0;
}
[data-palette='blush'] {
	--primary: #d8bdb4;
}
[data-palette='iron'] {
	--primary: #b4bbc4;
}
[data-palette='iris'] {
	--primary: #acafe0;
}
[data-palette='khaki'] {
	--primary: #ccbc9e;
}
[data-palette='mauve'] {
	--primary: #d0b0c0;
}
[data-palette='pewter'] {
	--primary: #c0c0c8;
}
[data-palette='plum'] {
	--primary: #c4b0c8;
}
[data-palette='rose'] {
	--primary: #d4b4bc;
}
[data-palette='sand'] {
	--primary: #e0d4bc;
}
[data-palette='silver'] {
	--primary: #b8b8c0;
}
[data-palette='violet'] {
	--primary: #bdb2d4;
}
```

## Layer 2: Alias Layer (palantir-design-system.css)

These `--palantir-*` tokens are consumed by dashboard components. After unification, they simply alias the base tokens:

| Alias                       | Maps To                          |
| --------------------------- | -------------------------------- |
| `--palantir-bg-app`         | `var(--background)`              |
| `--palantir-bg-chrome`      | `var(--background)`              |
| `--palantir-bg-surface`     | `var(--card)`                    |
| `--palantir-bg-panel`       | `var(--card)`                    |
| `--palantir-bg-elevated`    | `var(--secondary)`               |
| `--palantir-bg-input`       | `var(--input)`                   |
| `--palantir-bg-hover`       | `var(--hover-tint)`              |
| `--palantir-bg-button`      | `var(--secondary)`               |
| `--palantir-border-subtle`  | `var(--border)`                  |
| `--palantir-border-default` | `var(--border)`                  |
| `--palantir-border-strong`  | `var(--border)`                  |
| `--palantir-text-primary`   | `var(--foreground)`              |
| `--palantir-text-secondary` | `var(--text-secondary, #BBBBBB)` |
| `--palantir-text-tertiary`  | `var(--text-tertiary, #888888)`  |
| `--palantir-text-on-accent` | `var(--primary-foreground)`      |
| `--palantir-accent`         | `var(--primary)`                 |
| `--palantir-accent-hover`   | `var(--ring)`                    |
| `--palantir-success`        | `var(--success)`                 |
| `--palantir-warning`        | `var(--warning)`                 |
| `--palantir-error`          | `var(--destructive)`             |
| `--palantir-info`           | `var(--info)`                    |

## State Transitions

### Theme Selection

```
User selects accent in Settings
  → themeStore.setPalette('sand')
  → document.documentElement.dataset.palette = 'sand'
  → CSS [data-palette='sand'] activates
  → --primary becomes #E0D4BC
  → All --palantir-accent, Tailwind bg-primary, etc. update automatically
  → localStorage persists { palette: 'sand', railPosition: 'left' }
```

### Palette Fallback (migration)

```
Old localStorage: { palette: 'green', railPosition: 'left' }
  → validateParsed() checks VALID_PALETTES
  → 'green' not in new list
  → Falls back to DEFAULT_STATE.palette = 'blue'
  → User sees Blue ★ accent
```
