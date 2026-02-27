<script lang="ts">
	import { layerVisibility, toggleLayerVisibility } from '$lib/stores/dashboard/dashboard-store';
	import {
		setViewshedEnabled,
		viewshedComputing,
		viewshedStore
	} from '$lib/stores/dashboard/viewshed-store';

	import DTEDStatus from './viewshed/DTEDStatus.svelte';
	import OpacityControls from './viewshed/OpacityControls.svelte';
	import ViewshedControls from './viewshed/ViewshedControls.svelte';
</script>

<div class="los-view">
	<!-- Enable toggle -->
	<section class="panel-section">
		<label class="toggle-row">
			<span class="toggle-label">
				Enable Line of Sight
				{#if $viewshedComputing}
					<span class="computing-indicator" aria-label="Computing viewshed">
						<span class="spinner"></span>
					</span>
				{/if}
			</span>
			<button
				class="toggle-switch"
				class:on={$viewshedStore.isEnabled}
				onclick={() => {
					const next = !$viewshedStore.isEnabled;
					setViewshedEnabled(next);
					if (next) layerVisibility.update((v) => ({ ...v, viewshed: true }));
				}}
				role="switch"
				aria-checked={$viewshedStore.isEnabled}
			>
				<span class="toggle-knob"></span>
			</button>
		</label>
	</section>

	{#if $viewshedStore.isEnabled}
		<DTEDStatus />

		<ViewshedControls />

		<OpacityControls />

		<!-- Show on Map toggle -->
		<section class="panel-section">
			<label class="toggle-row">
				<span class="toggle-label">Show on Map</span>
				<button
					class="toggle-switch"
					class:on={$layerVisibility.viewshed}
					onclick={() => toggleLayerVisibility('viewshed')}
					role="switch"
					aria-checked={$layerVisibility.viewshed}
				>
					<span class="toggle-knob"></span>
				</button>
			</label>
		</section>
	{/if}
</div>

<style>
	@import './map-settings-shared.css';

	.los-view {
		display: flex;
		flex-direction: column;
	}
</style>
