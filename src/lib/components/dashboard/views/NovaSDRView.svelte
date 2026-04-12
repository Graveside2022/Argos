<script lang="ts">
	import { browser } from '$app/environment';
	import { activeView } from '$lib/stores/dashboard/dashboard-store';

	import ToolViewWrapper from './ToolViewWrapper.svelte';

	function goBack() {
		activeView.set('map');
	}

	// Build the NovaSDR URL using the current page protocol + hostname so the
	// iframe inherits http/https correctly and avoids mixed-content blocking
	// when the dashboard is served over HTTPS.
	const novasdrUrl = browser
		? `${window.location.protocol}//${window.location.hostname}:9002`
		: 'http://localhost:9002';
</script>

<ToolViewWrapper title="NovaSDR Spectrum Analyzer" onBack={goBack}>
	<iframe src={novasdrUrl} title="NovaSDR Web Interface" class="novasdr-iframe"></iframe>
</ToolViewWrapper>

<style>
	.novasdr-iframe {
		width: 100%;
		height: 100%;
		border: none;
		background: var(--background);
	}
</style>
