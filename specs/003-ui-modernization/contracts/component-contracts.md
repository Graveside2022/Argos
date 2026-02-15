# Component Contracts: UI Modernization

**Feature**: 003-ui-modernization
**Date**: 2026-02-15

---

## Overview

This feature has no REST API changes. All endpoints remain unchanged. The contracts defined here are **CSS/component interface contracts** — the agreements between the theme system, component library, and consuming code.

---

## Contract 1: CSS Variable Theme Contract

**Producer**: `src/app.css` (`:root` and `.dark` blocks)
**Consumers**: All Svelte components, shadcn components, `@theme inline` block

**Guarantee**: Every variable listed in `data-model.md` Entity 1 is defined in both `:root` and `.dark` blocks. Values are full `hsl()` wrapped color strings (e.g., `hsl(220 24% 7%)`).

**Breaking change criteria**: Removing or renaming any CSS variable is a breaking change. Adding new variables is non-breaking.

---

## Contract 2: cn() Utility Contract

**Producer**: `src/lib/utils.ts`
**Consumers**: All shadcn components in `src/lib/components/ui/`

**Signature**:

```typescript
export function cn(...inputs: ClassValue[]): string;
```

**Guarantee**: Accepts any number of class value arguments (strings, arrays, objects, undefined, null). Returns a merged, deduplicated class string with Tailwind conflict resolution.

**Dependencies**: `clsx`, `tailwind-merge`

---

## Contract 3: resolveThemeColor() Contract

**Producer**: `src/lib/utils/theme-colors.ts`
**Consumers**: `signal-utils.ts`, `spectrum.ts`, `map-utils.ts`, `map-service.ts`

**Signature**:

```typescript
export function resolveThemeColor(varName: string, fallback?: string): string;
```

**Guarantee**:

- Returns a hex color string (e.g., `#dc2626`)
- Safe in SSR context (returns fallback)
- Accepts `--signal-critical` or `signal-critical` (with or without `--` prefix)
- Default fallback: `#000000`

---

## Contract 4: shadcn Component Import Contract

**Producer**: shadcn CLI (`npx shadcn add <component>`)
**Consumers**: Application Svelte files

**Import pattern**:

```typescript
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger
} from '$lib/components/ui/alert-dialog';
```

**Guarantee**: Each component is self-contained in `src/lib/components/ui/{name}/`. Components use `cn()` from `$lib/utils` and bits-ui for headless behavior. Components consume CSS variables from the theme system and render with the active theme.

---

## Contract 5: Palantir CSS Coexistence Contract

**During migration period** (P2→P4):

**Guarantee**: Both palantir CSS classes (`.btn-*`, `.badge-*`, `.input-field`, `.data-table`) and shadcn components coexist without CSS conflicts. Neither system overrides the other's styles.

**After full adoption** (post-P4): Palantir CSS file is deleted entirely.
