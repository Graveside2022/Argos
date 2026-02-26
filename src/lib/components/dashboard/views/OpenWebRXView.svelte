<script lang="ts">
	import { browser } from '$app/environment';
	import { activeView } from '$lib/stores/dashboard/dashboard-store';

	import ToolViewWrapper from './ToolViewWrapper.svelte';

	function goBack() {
		activeView.set('map');
	}

	// Build the OpenWebRX URL using the current hostname
	let openwebrxUrl = 'http://localhost:8073';
	if (browser) {
		const hostname = window.location.hostname;
		openwebrxUrl = `http://${hostname}:8073`;
	}
</script>

<ToolViewWrapper title="OpenWebRX Spectrum Analyzer" onBack={goBack}>
	<iframe src={openwebrxUrl} title="OpenWebRX Web Interface" class="openwebrx-iframe" />
</ToolViewWrapper>

<style>
	.openwebrx-iframe {
		width: 100%;
		height: 100%;
		border: none;
		background: var(--background);
	}
</style>
