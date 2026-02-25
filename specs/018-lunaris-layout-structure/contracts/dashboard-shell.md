# Contract: DashboardShell

**Component**: `src/lib/components/dashboard/DashboardShell.svelte`
**Type**: Layout wrapper (no data fetching)

## Interface

```typescript
// Props
interface DashboardShellProps {
	mode: 'sidebar' | 'full-width';
	sidebarOpen?: boolean; // default: true
}

// Svelte 5 Snippet Slots
// {#snippet sidebar()}...{/snippet}     — 280px left panel (sidebar mode only)
// {#snippet content()}...{/snippet}     — Main content area (sidebar mode only)
// {#snippet fullWidth()}...{/snippet}   — Full-width content (full-width mode only)
// {#snippet bottomPanel()}...{/snippet} — Bottom panel (always rendered)
```

## DOM Structure

```html
<div class="dashboard-shell">
	<IconRail />
	<div class="shell-right">
		<TopStatusBar />
		<div class="content-area">
			{#if mode === 'sidebar'}
			<div class="left-panel">{@render sidebar()}</div>
			<div class="main-content">{@render content()}</div>
			{:else}
			<div class="full-width">{@render fullWidth()}</div>
			{/if}
		</div>
		<div class="bottom-area">{@render bottomPanel()}</div>
	</div>
</div>
```

## CSS Contract

| Element            | Width   | Height  | Overflow | Notes                                    |
| ------------------ | ------- | ------- | -------- | ---------------------------------------- |
| `.dashboard-shell` | 100vw   | 100vh   | hidden   | flex row                                 |
| `IconRail`         | 48px    | 100%    | —        | flex: 0 0 48px                           |
| `.shell-right`     | flex: 1 | 100%    | hidden   | flex column                              |
| `TopStatusBar`     | 100%    | 40px    | —        | flex: 0 0 40px                           |
| `.content-area`    | 100%    | flex: 1 | hidden   | flex row (sidebar) or block (full-width) |
| `.left-panel`      | 280px   | 100%    | auto (y) | flex: 0 0 280px, independent scroll      |
| `.main-content`    | flex: 1 | 100%    | hidden   | Map + overlays                           |
| `.full-width`      | 100%    | 100%    | auto     | Scrollable form/table                    |
| `.bottom-area`     | 100%    | auto    | —        | flex: 0 0 auto                           |

## Behavioral Contract

1. Mode switching is **immediate** — no animation between sidebar/full-width.
2. The left panel scrolls **independently** (overflow-y: auto) without affecting map or bottom panel.
3. The bottom panel is always present regardless of mode.
4. IconRail and TopStatusBar are always rendered regardless of mode.
5. The shell passes NO data — it is purely structural.
