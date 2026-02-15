# Data Model: UI Modernization — Polished Components & Color Customization

**Date**: 2026-02-15 | **Spec**: 004-ui-implementation

## Entities

### ThemeState

The core state object persisted to localStorage and managed by the theme store.

```typescript
interface ThemeState {
	palette: ThemePalette; // Which color scheme is active
	mode: ThemeMode; // Dark or light
	semanticColors: boolean; // Whether operational colors are fixed or harmonized
}

type ThemePalette = 'default' | 'blue' | 'green' | 'orange' | 'red' | 'rose' | 'violet' | 'yellow';
type ThemeMode = 'dark' | 'light';
```

| Field          | Type         | Default     | Validation                          | Persisted          |
| -------------- | ------------ | ----------- | ----------------------------------- | ------------------ |
| palette        | ThemePalette | `'default'` | Must be one of 8 valid palette keys | Yes (localStorage) |
| mode           | ThemeMode    | `'dark'`    | Must be `'dark'` or `'light'`       | Yes (localStorage) |
| semanticColors | boolean      | `true`      | Must be boolean                     | Yes (localStorage) |

**Storage key**: `'argos-theme'`
**Storage format**: JSON string `{"palette":"blue","mode":"dark","semanticColors":true}`

### PaletteDefinition

Definition of a single color palette. Not persisted — compiled into the application.

```typescript
interface PaletteDefinition {
	name: string; // Human-readable display name
	label: ThemePalette; // Machine key matching ThemePalette type
	cssVars: {
		light: Record<string, string>; // CSS variable overrides for light mode
		dark: Record<string, string>; // CSS variable overrides for dark mode
	};
}
```

**Instance count**: 8 (one per palette)
**Location**: `src/lib/themes/palettes.ts`
**Consumed by**: theme store (to apply CSS variables), Settings panel (to populate dropdown)

### SignalBand (existing, referenced)

Already defined in `src/lib/utils/signal-utils.ts`. Not modified, but the semantic colors toggle affects how these bands' colors are resolved.

```typescript
interface SignalBand {
	key: string; // 'critical' | 'strong' | 'good' | 'fair' | 'weak'
	label: string; // Display label
	name: string; // Band name
	dbm: string; // dBm range description
	min: number; // RSSI threshold
	cssVar: string; // CSS variable name (e.g., '--palantir-signal-critical')
	range: string; // Estimated distance
}
```

## State Transitions

### ThemeState Transitions

```
Initial State:
  { palette: 'default', mode: 'dark', semanticColors: true }

setPalette(palette: ThemePalette):
  Before: { palette: 'default', ... }
  After:  { palette: 'blue', ... }
  Side effects:
    1. Set data-palette attribute on <html> element
    2. Persist to localStorage
    3. Emit store change (triggers subscribers)

setMode(mode: ThemeMode):
  Before: { mode: 'dark', ... }
  After:  { mode: 'light', ... }
  Side effects:
    1. Toggle 'dark' class on <html> element
    2. Persist to localStorage
    3. Emit store change

setSemanticColors(enabled: boolean):
  Before: { semanticColors: true, ... }
  After:  { semanticColors: false, ... }
  Side effects:
    1. Toggle 'semantic-colors-off' class on <html> element
    2. Persist to localStorage
    3. Emit store change
```

### CSS Cascade on State Change

```
HTML element attributes after theme change:

<html class="dark" data-palette="blue">           ← Dark + Blue + Semantic ON
<html class="" data-palette="green">              ← Light + Green + Semantic ON
<html class="dark semantic-colors-off">           ← Dark + Default + Semantic OFF
<html class="dark semantic-colors-off" data-palette="rose">  ← Dark + Rose + Semantic OFF
```

## Relationships

```
ThemeStore ──owns──> ThemeState
ThemeStore ──reads──> PaletteDefinition[]
ThemeStore ──writes──> localStorage['argos-theme']
ThemeStore ──modifies──> document.documentElement (class, dataset)

SettingsPanel ──subscribes──> ThemeStore
SettingsPanel ──calls──> setPalette(), setMode(), setSemanticColors()

DashboardMap ──subscribes──> ThemeStore (for color re-resolution)
DashboardMap ──calls──> resolveThemeColor() (on theme change)

signal-utils ──reads──> CSS variables (via resolveThemeColor)
signal-utils ──affected-by──> semantic toggle (changes which CSS vars are active)

app.html FOUC script ──reads──> localStorage['argos-theme']
app.html FOUC script ──writes──> document.documentElement.className, dataset.palette
```

## No New API Endpoints

This feature is entirely client-side. No new API endpoints, database tables, or server-side state. All persistence is via browser localStorage.

## No New Database Tables

No database changes required. Theme preferences are per-browser, not per-user (Argos has no user accounts).
