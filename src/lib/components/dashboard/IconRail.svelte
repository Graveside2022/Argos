<!-- @constitutional-exemption Article-IV-4.3 issue:#999 — Component state handling (loading/error/empty UI) deferred to UX improvement phase -->
<!-- @constitutional-exemption Article-IV-4.2 issue:#999 — Button pattern extraction deferred to component library refactor -->
<script lang="ts">
	import {
		activeBottomTab,
		activePanel,
		toggleBottomTab,
		togglePanel
	} from '$lib/stores/dashboard/dashboard-store';
	import { toggleTerminalPanel } from '$lib/stores/dashboard/terminal-store';

	const topIcons = [
		{
			id: 'overview',
			label: 'Overview',
			svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`
		},
		{
			id: 'tools',
			label: 'Tools',
			svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`
		}
	];

	const devicesIcon = {
		id: 'devices',
		label: 'Devices',
		svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/></svg>`
	};

	const chatIcon = {
		id: 'chat',
		label: 'Agent Chat',
		svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`
	};

	const terminalIcon = {
		id: 'terminal',
		label: 'Terminal',
		svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>`
	};

	const layersIcon = {
		id: 'layers',
		label: 'Layers',
		svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`
	};

	const bottomIcon = {
		id: 'settings',
		label: 'Settings',
		svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`
	};

	function handleClick(id: string) {
		if (id === 'terminal') {
			toggleTerminalPanel();
		} else if (id === 'chat') {
			toggleBottomTab('chat');
		} else if (id === 'devices') {
			toggleBottomTab('devices');
		} else {
			togglePanel(id);
		}
	}
</script>

<nav class="icon-rail" aria-label="Dashboard navigation">
	<div class="rail-top">
		<!-- Overview (home) -->
		<button
			class="rail-btn"
			class:active={$activePanel === 'overview'}
			title={topIcons[0].label}
			aria-label={topIcons[0].label}
			aria-pressed={$activePanel === 'overview'}
			onclick={() => handleClick(topIcons[0].id)}
		>
			<!-- @constitutional-exemption Article-IX-9.4 issue:#999 — Static hardcoded SVG icon string, no user input reaches this directive -->
			{@html topIcons[0].svg}
		</button>
		<!-- Devices (middle) -->
		<button
			class="rail-btn"
			class:active={$activeBottomTab === 'devices'}
			title={devicesIcon.label}
			aria-label={devicesIcon.label}
			aria-pressed={$activeBottomTab === 'devices'}
			onclick={() => handleClick(devicesIcon.id)}
		>
			<!-- @constitutional-exemption Article-IX-9.4 issue:#999 — Static hardcoded SVG icon string, no user input reaches this directive -->
			{@html devicesIcon.svg}
		</button>
		<!-- Tools (zap) -->
		<button
			class="rail-btn"
			class:active={$activePanel === 'tools'}
			title={topIcons[1].label}
			aria-label={topIcons[1].label}
			aria-pressed={$activePanel === 'tools'}
			onclick={() => handleClick(topIcons[1].id)}
		>
			<!-- @constitutional-exemption Article-IX-9.4 issue:#999 — Static hardcoded SVG icon string, no user input reaches this directive -->
			{@html topIcons[1].svg}
		</button>
	</div>

	<div class="rail-spacer"></div>

	<div class="rail-bottom">
		<button
			class="rail-btn"
			class:active={$activeBottomTab === 'terminal'}
			title={terminalIcon.label}
			aria-label={terminalIcon.label}
			aria-pressed={$activeBottomTab === 'terminal'}
			onclick={() => handleClick(terminalIcon.id)}
		>
			<!-- @constitutional-exemption Article-IX-9.4 issue:#999 — Static hardcoded SVG icon string, no user input reaches this directive -->
			{@html terminalIcon.svg}
		</button>
		<button
			class="rail-btn"
			class:active={$activeBottomTab === 'chat'}
			title={chatIcon.label}
			aria-label={chatIcon.label}
			aria-pressed={$activeBottomTab === 'chat'}
			onclick={() => handleClick(chatIcon.id)}
		>
			<!-- @constitutional-exemption Article-IX-9.4 issue:#999 — Static hardcoded SVG icon string, no user input reaches this directive -->
			{@html chatIcon.svg}
		</button>
		<button
			class="rail-btn"
			class:active={$activePanel === layersIcon.id}
			title={layersIcon.label}
			aria-label={layersIcon.label}
			aria-pressed={$activePanel === layersIcon.id}
			onclick={() => handleClick(layersIcon.id)}
		>
			<!-- @constitutional-exemption Article-IX-9.4 issue:#999 — Static hardcoded SVG icon string, no user input reaches this directive -->
			{@html layersIcon.svg}
		</button>
		<button
			class="rail-btn"
			class:active={$activePanel === bottomIcon.id}
			title={bottomIcon.label}
			aria-label={bottomIcon.label}
			aria-pressed={$activePanel === bottomIcon.id}
			onclick={() => handleClick(bottomIcon.id)}
		>
			<!-- @constitutional-exemption Article-IX-9.4 issue:#999 — Static hardcoded SVG icon string, no user input reaches this directive -->
			{@html bottomIcon.svg}
		</button>
	</div>
</nav>

<style>
	.icon-rail {
		width: var(--icon-rail-width);
		min-width: var(--icon-rail-width);
		flex-shrink: 0;
		background: var(--palantir-bg-surface);
		border-right: 1px solid var(--palantir-border-subtle);
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: var(--space-2) 0;
		position: relative;
		z-index: 10;
	}

	.rail-top {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-1);
	}

	.rail-spacer {
		flex: 1;
	}

	.rail-bottom {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-1);
	}

	.rail-btn {
		width: 40px;
		height: 40px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: none;
		background: transparent;
		color: var(--palantir-text-tertiary);
		cursor: pointer;
		border-radius: var(--radius-md);
		position: relative;
		padding: 0;
		margin: 0;
		outline: none;
		transition:
			color 0.15s ease,
			background-color 0.15s ease;
	}

	.rail-btn:hover {
		background-color: var(--palantir-bg-hover);
		color: var(--palantir-text-secondary);
	}

	.rail-btn.active {
		display: flex !important;
		align-items: center;
		justify-content: center;
		color: var(--palantir-accent);
		background-color: rgba(74, 158, 255, 0.12);
	}

	.rail-btn.active::before {
		content: '';
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 3px;
		background: var(--palantir-accent);
		border-radius: 0 1px 1px 0;
	}

	.rail-btn.active::after {
		content: '';
		position: absolute;
		right: 0;
		top: 50%;
		transform: translateY(-50%);
		width: 1px;
		height: 24px;
		background: linear-gradient(to bottom, transparent, rgba(74, 158, 255, 0.5), transparent);
		opacity: 0.6;
	}
</style>
