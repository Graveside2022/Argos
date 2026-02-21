# Token API Contract: Lunaris Design System

**Feature**: 012-lunaris-ui-redesign | **Date**: 2026-02-21

## Naming Conventions

| Category            | Prefix      | Example                                        |
| ------------------- | ----------- | ---------------------------------------------- |
| Background surfaces | `--bg-`     | `--bg-base`, `--bg-card`, `--bg-elevated`      |
| Borders             | `--border-` | `--border-default`, `--border-strong`          |
| Text colors         | `--text-`   | `--text-primary`, `--text-secondary`           |
| Accent colors       | `--accent`  | `--accent`, `--accent-light`, `--accent-muted` |
| Semantic status     | `--status-` | `--status-healthy`, `--status-warning`         |
| Fonts               | `--font-`   | `--font-mono`, `--font-sans`                   |
| Typography sizes    | `--text-`   | `--text-hero`, `--text-row`, `--text-label`    |
| Font weights        | `--weight-` | `--weight-normal`, `--weight-bold`             |
| Layout dimensions   | descriptive | `--rail-width`, `--panel-width`                |
| Spacing             | `--space-`  | `--space-1` through `--space-12`               |

## Usage Rules

1. **Never hard-code colors** — all color values must reference a token via `var()` or Tailwind arbitrary value
2. **Accent vs Semantic**: Use `--accent` for brand/identity. Use `--status-*` for operational health. Never use accent for status.
3. **Font assignment**: Data/metrics/code → `--font-mono`. Navigation/labels/buttons → `--font-sans`.
4. **Status text rule**: Every colored status indicator MUST have an adjacent text label. Color alone is insufficient.
5. **No new tokens without review**: Adding a new token requires updating `lunaris-tokens.css` and this contract.

## Tailwind Integration

Tokens are exposed via `@theme inline` in `app.css`:

```css
@theme inline {
	--color-bg-base: var(--bg-base);
	--color-accent: var(--accent);
	--color-status-healthy: var(--status-healthy);
	/* etc. */
}
```

This enables Tailwind utilities like `bg-bg-base`, `text-accent`, `text-status-healthy`.

For tokens not mapped to `@theme`, use arbitrary values: `bg-[var(--bg-card)]`.
