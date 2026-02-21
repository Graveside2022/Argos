# Quickstart: Lunaris Design Tokens

**Feature**: 012-lunaris-ui-redesign | **Date**: 2026-02-21

## Using Lunaris Tokens in Components

### Colors

```svelte
<!-- Backgrounds -->
<div class="bg-[var(--bg-base)]">Deepest background</div>
<div class="bg-[var(--bg-card)]">Card surface</div>
<div class="border border-[var(--border-default)]">Standard border</div>

<!-- Text hierarchy -->
<span class="text-[var(--text-primary)]">Primary text</span>
<span class="text-[var(--text-secondary)]">Secondary text</span>
<span class="text-[var(--text-label)] uppercase tracking-[1.2px]">SECTION LABEL</span>

<!-- Accent -->
<span class="text-[var(--accent)]">Brand / highlight text</span>

<!-- Status (always pair with text label) -->
<span class="text-[var(--status-healthy)]">connected</span>
<span class="text-[var(--status-warning)]">idle</span>
<span class="text-[var(--status-error)]">stopped</span>
<span class="text-[var(--status-inactive)]">disabled</span>
```

### Typography

```svelte
<!-- Data values (monospace) — default for dashboard -->
<span style="font-family: var(--font-mono); font-size: var(--text-hero);">47%</span>
<span style="font-family: var(--font-mono); font-size: var(--text-row);">wlan0</span>

<!-- UI chrome (sans-serif) — tabs, navigation, buttons -->
<span style="font-family: var(--font-sans); font-size: var(--text-base);">Terminal</span>
```

### Status Indicators (NO dots)

```svelte
<!-- CORRECT: Text label carries the status color -->
<div class="flex justify-between">
	<span class="text-[var(--text-secondary)]">kismet</span>
	<span class="text-[var(--status-healthy)]">connected</span>
</div>

<!-- WRONG: Colored dot as status indicator -->
<div class="w-2 h-2 rounded-full bg-green-500"></div>
```

### Spacing

Use `var(--space-N)` for custom spacing or Tailwind utilities (`p-2`, `gap-3`) for standard spacing. Both are valid.

## Token Reference

See [data-model.md](./data-model.md) for the complete token schema with values and WCAG contrast ratios.
