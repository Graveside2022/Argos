<script lang="ts">
	import { browser } from '$app/environment';
	import { activeView } from '$lib/stores/dashboard/dashboard-store';

	import ToolViewWrapper from './ToolViewWrapper.svelte';

	function goBack() {
		activeView.set('map');
	}

	// Build the OpenWebRX URL using the current page protocol + hostname so the
	// iframe inherits http/https correctly and avoids mixed-content blocking
	// when the dashboard is served over HTTPS.
	const openwebrxUrl = browser
		? `${window.location.protocol}//${window.location.hostname}:8073`
		: 'http://localhost:8073';
</script>

<ToolViewWrapper title="OpenWebRX Spectrum Analyzer" onBack={goBack}>
	<iframe src={openwebrxUrl} title="OpenWebRX Web Interface" class="openwebrx-iframe"></iframe>
</ToolViewWrapper>

<style>
	.openwebrx-iframe {
		width: 100%;
		height: 100%;
		border: none;
		background: var(--background);
	}
</style>
