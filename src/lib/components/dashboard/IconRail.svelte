<!-- @constitutional-exemption Article-IV-4.3 issue:#11 — Component state handling (loading/error/empty UI) deferred to UX improvement phase -->
<!-- @constitutional-exemption Article-IV-4.2 issue:#12 — Button pattern extraction deferred to component library refactor -->
<script lang="ts">
	import { House, Layers, List, Settings, Waypoints, Zap } from '@lucide/svelte';

	import {
		activeBottomTab,
		activePanel,
		toggleBottomTab,
		togglePanel
	} from '$lib/stores/dashboard/dashboard-store';
	import { themeStore } from '$lib/stores/theme-store.svelte';

	function handleClick(id: string) {
		if (id === 'devices') {
			toggleBottomTab('devices');
		} else {
			togglePanel(id);
		}
	}
</script>

<nav class="icon-rail" data-position={themeStore.railPosition} aria-label="Dashboard navigation">
	<div class="rail-top">
		<!-- Overview (house) -->
		<button
			class="rail-btn"
			class:active={$activePanel === 'overview'}
			title="Overview"
			aria-label="Overview"
			aria-pressed={$activePanel === 'overview'}
			onclick={() => handleClick('overview')}
		>
			<House size={18} />
		</button>
		<!-- Devices (list) -->
		<button
			class="rail-btn"
			class:active={$activeBottomTab === 'devices'}
			title="Devices"
			aria-label="Devices"
			aria-pressed={$activeBottomTab === 'devices'}
			onclick={() => handleClick('devices')}
		>
			<List size={18} />
		</button>
		<!-- Tools (zap) -->
		<button
			class="rail-btn"
			class:active={$activePanel === 'tools'}
			title="Tools"
			aria-label="Tools"
			aria-pressed={$activePanel === 'tools'}
			onclick={() => handleClick('tools')}
		>
			<Zap size={18} />
		</button>
	</div>

	<div class="rail-spacer"></div>

	<div class="rail-bottom">
		<!-- Logo (waypoints) — brand mark, always white -->
		<button
			class="rail-btn rail-logo"
			title="Argos"
			aria-label="Argos"
			onclick={() => handleClick('overview')}
		>
			<Waypoints size={20} />
		</button>
		<!-- Layers -->
		<button
			class="rail-btn"
			class:active={$activePanel === 'layers'}
			title="Layers"
			aria-label="Layers"
			aria-pressed={$activePanel === 'layers'}
			onclick={() => handleClick('layers')}
		>
			<Layers size={18} />
		</button>
		<!-- Separator -->
		<div class="rail-separator"></div>
		<!-- Settings -->
		<button
			class="rail-btn"
			class:active={$activePanel === 'settings'}
			title="Settings"
			aria-label="Settings"
			aria-pressed={$activePanel === 'settings'}
			onclick={() => handleClick('settings')}
		>
			<Settings size={18} />
		</button>
	</div>
</nav>

<style>
	.icon-rail {
		width: var(--icon-rail-width);
		min-width: var(--icon-rail-width);
		flex-shrink: 0;
		background: var(--sidebar);
		border-right: 1px solid var(--border);
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 10px 0;
		position: relative;
		z-index: 10;
	}

	.rail-top {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
	}

	.rail-spacer {
		flex: 1;
	}

	.rail-bottom {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
	}

	.rail-btn {
		width: 48px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: none;
		background: transparent;
		color: #808080;
		cursor: pointer;
		border-radius: 4px;
		position: relative;
		padding: 0;
		margin: 0;
		outline: none;
		transition:
			color 0.15s ease,
			background-color 0.15s ease;
	}

	.rail-btn:hover {
		background-color: var(--surface-hover);
		color: var(--foreground-muted);
	}

	.rail-btn.active {
		color: var(--primary);
		background-color: #ffffff14;
	}

	/* Logo icon — always white, no active state */
	.rail-logo {
		color: #ffffff;
	}

	.rail-logo:hover {
		color: #ffffff;
	}

	/* Separator line between Layers and Settings */
	.rail-separator {
		width: 24px;
		height: 1px;
		background: #ffffff1a;
		margin: 2px 0;
	}

	@import './icon-rail.css';
</style>
