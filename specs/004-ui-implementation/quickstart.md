# Quickstart: UI Modernization — Polished Components & Color Customization

**Branch**: `004-ui-implementation`
**Prerequisites**: Spec 003 complete (Tailwind v4, shadcn CLI, Button + AlertDialog installed)

## Setup

```bash
# 1. Switch to feature branch
git checkout 004-ui-implementation

# 2. Install mode-watcher (FOUC prevention library)
npm install mode-watcher

# 3. Install shadcn components (Table, Input, Badge, Select, Switch)
npx shadcn@latest add table input badge select switch

# 4. Verify everything compiles
npm run typecheck

# 5. Start dev server
npm run dev
```

## Verification Commands

Run after each task:

```bash
# File-scoped (during development)
npx tsc --noEmit                           # TypeScript check
npx eslint src/lib/stores/theme-store.ts   # Lint specific file

# Full project (before commit)
npm run typecheck    # 0 errors expected
npm run lint         # 0 errors expected
npm run test:unit    # All pass
npm run build        # Builds successfully
```

## Implementation Order

### Track A: Component Upgrades (US1, US2) — can run in parallel with Track B

1. **T-A1**: Install shadcn components (table, input, badge)
2. **T-A2**: Upgrade buttons in ToolsNavigationView (Start, Stop, Open)
3. **T-A3**: Upgrade button in ToolViewWrapper (Back, status badge)
4. **T-A4**: Upgrade table in DevicesPanel
5. **T-A5**: Upgrade inputs in DevicesPanel
6. **T-A6**: Upgrade badges across dashboard
7. **T-A7**: Remove replaced CSS from palantir-design-system.css

### Track B: Theme System (US3-US7) — depends on mode-watcher install

1. **T-B1**: Install mode-watcher, install select + switch components
2. **T-B2**: Create theme store (palette, mode, semantic state + localStorage)
3. **T-B3**: Define 8 palette CSS variable blocks in app.css
4. **T-B4**: Add FOUC prevention script to app.html
5. **T-B5**: Build Settings panel UI (palette dropdown, mode toggle, semantic toggle)
6. **T-B6**: Wire mode-watcher into +layout.svelte
7. **T-B7**: Add semantic colors toggle CSS (signal/status variable overrides)
8. **T-B8**: Update DashboardMap to re-resolve colors on theme change
9. **T-B9**: Final verification across all palettes and modes

## Key Files

| File                                                             | Purpose                                      |
| ---------------------------------------------------------------- | -------------------------------------------- |
| `src/lib/stores/theme-store.ts`                                  | Theme state management (NEW)                 |
| `src/lib/themes/palettes.ts`                                     | 8 palette CSS variable definitions (NEW)     |
| `src/app.css`                                                    | CSS variable definitions + palette overrides |
| `src/app.html`                                                   | FOUC prevention script                       |
| `src/lib/components/dashboard/panels/SettingsPanel.svelte`       | Theme settings UI                            |
| `src/lib/components/dashboard/panels/ToolsNavigationView.svelte` | Button upgrades                              |
| `src/lib/components/dashboard/panels/DevicesPanel.svelte`        | Table, input, badge upgrades                 |
| `src/lib/components/dashboard/views/ToolViewWrapper.svelte`      | Button + badge upgrades                      |
| `src/lib/components/dashboard/DashboardMap.svelte`               | Theme-aware map colors                       |

## Common Patterns

### Using shadcn Button

```svelte
<script>
	import { Button } from '$lib/components/ui/button';
</script>

<Button variant="default" size="sm">Start</Button>
<Button variant="destructive" size="sm">Stop</Button>
<Button variant="ghost" size="sm">Back</Button>
<Button variant="outline" size="sm">Open</Button>
```

### Using theme store

```svelte
<script>
	import { themeStore } from '$lib/stores/theme-store';
</script>

<!-- Read current palette -->
<p>Current: {$themeStore.palette}</p>

<!-- Change palette -->
<button onclick={() => themeStore.setPalette('blue')}>Blue</button>
```

### CSS palette override pattern

```css
[data-palette='blue'] {
	--primary: hsl(217.2 91.2% 59.8%);
	--primary-foreground: hsl(0 0% 100%);
	--ring: hsl(224.3 76.3% 48%);
}
```
