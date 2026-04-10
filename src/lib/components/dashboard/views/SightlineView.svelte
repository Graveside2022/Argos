<script lang="ts">
	import { browser } from '$app/environment';
	import { activeView } from '$lib/stores/dashboard/dashboard-store';

	import ToolViewWrapper from './ToolViewWrapper.svelte';

	function goBack() {
		activeView.set('map');
	}

	let sightlineUrl = 'http://localhost:3001';
	if (browser) {
		const hostname = window.location.hostname;
		sightlineUrl = `http://${hostname}:3001`;
	}
</script>

<ToolViewWrapper title="Sightline — Geospatial Intelligence" onBack={goBack}>
	<iframe src={sightlineUrl} title="Sightline Geospatial Intelligence" class="sightline-iframe" />
</ToolViewWrapper>

<style>
	.sightline-iframe {
		width: 100%;
		height: 100%;
		border: none;
		background: var(--background);
	}
</style>
