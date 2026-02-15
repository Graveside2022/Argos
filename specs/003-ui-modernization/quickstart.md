# Quickstart: UI Modernization to Tailwind CSS v4 + shadcn

**Feature**: 003-ui-modernization
**Date**: 2026-02-15

---

## Prerequisites

- Node.js 20.x
- Working Argos dev environment (`npm run dev` succeeds)
- Pre-migration screenshots of all routes (`/dashboard`, `/gsm-evil`)

## Phase 1: Tailwind v4 Migration (P1)

### Step 1: Install dependencies

```bash
npm install -D tailwindcss@4.1.18 @tailwindcss/vite@4.1.18 tw-animate-css@1.4.0
npm uninstall autoprefixer postcss
```

### Step 2: Run the upgrade tool

```bash
npx @tailwindcss/upgrade
git diff  # Review ALL changes before committing
```

### Step 3: Update vite.config.ts

```typescript
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { terminalPlugin } from './config/vite-plugin-terminal';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit(), terminalPlugin()]
	// ... rest unchanged
});
```

### Step 4: Delete PostCSS config

```bash
rm postcss.config.js           # symlink
rm config/postcss.config.js    # target
rm tailwind.config.js          # replaced by CSS-first config
```

### Step 5: Verify

```bash
npm run dev          # Must start without errors
npm run build        # Must build successfully
npm run typecheck    # Must pass
```

---

## Phase 2: Color Consolidation (P1)

### Step 1: Add `class="dark"` to app.html

```html
<html lang="en" class="dark"></html>
```

### Step 2: Rewrite app.css with unified variables

See `plan.md` for the complete app.css structure with `:root`, `.dark`, `@theme inline`, `@layer base`, and `@layer components` blocks.

### Step 3: Slim app.html

Remove all inline CSS except FOUC-prevention essentials (body bg/color, font declarations).

### Step 4: Update shadowing palantir classes

Replace all usages of `.text-primary` → Tailwind `text-foreground`, `.text-secondary` → `text-muted-foreground`, `.bg-panel` → `bg-card`, `.border-default` → `border-border` in all Svelte files.

### Step 5: Remove dead palantir classes

Delete `.section-header`, `.metric-*`, `.saasfly-*`, `.glass-*` (from app.html), `.status-panel` definitions.

### Step 6: Verify

```bash
npm run dev          # Visual inspection of all routes
npm run build
npm run typecheck
npm run test:unit
```

---

## Phase 3: shadcn Installation (P2)

### Step 1: Install shadcn dependencies

```bash
npm install bits-ui@2.15.5 @internationalized/date@3.11.0 tailwind-variants@3.2.2 @lucide/svelte@0.564.0 svelte-sonner@1.0.7
```

### Step 2: Initialize shadcn

```bash
npx shadcn-svelte@latest init
# Select: base-color=zinc (no style selection in TW v4 — new-york is default)
# Verify components.json was created
# Verify src/lib/utils.ts was created with cn() + type helpers
```

### Step 3: Map Argos theme to shadcn variables

Ensure `.dark {}` block in app.css has Argos colors (not default zinc). This should already be done from Phase 2.

### Step 4: Add AlertDialog component

```bash
npx shadcn add alert-dialog
```

### Step 5: Replace alert() calls

Update `src/routes/gsm-evil/+page.svelte` to use shadcn AlertDialog instead of `alert()`.

### Step 6: Verify

```bash
npm run dev          # Test AlertDialog on gsm-evil page
npm run build
npm run typecheck
npm run test:unit
```

---

## Phase 4: Theme Color Bridge (P3)

### Step 1: Create resolveThemeColor utility

Create `src/lib/utils/theme-colors.ts` with `resolveThemeColor()` function.

### Step 2: Update hardcoded hex values

Replace hex colors in:

- `src/lib/utils/signal-utils.ts` (6 values)
- `src/lib/hackrf/spectrum.ts` (4 values)
- `src/lib/tactical-map/utils/map-utils.ts` (7 values)
- `src/lib/tactical-map/map-service.ts` (2 values)

### Step 3: Verify

```bash
npm run dev          # Visual check: map markers, spectrum, signal indicators
npm run typecheck
npm run test:unit
```

---

## Verification Checklist (After All Phases)

```bash
# 1. Type Safety
npm run typecheck              # 0 errors

# 2. Code Quality
npm run lint                   # 0 warnings, 0 errors

# 3. Unit Tests
npm run test:unit              # All tests passed

# 4. Security Tests
npm run test:security          # All tests passed

# 5. Build Verification
npm run build                  # built successfully

# 6. Visual Verification
npm run dev                    # Compare every route against pre-migration screenshots
```

## Rollback

Each phase has its own commit. If a phase breaks:

```bash
git revert <phase-commit-hash>
```
