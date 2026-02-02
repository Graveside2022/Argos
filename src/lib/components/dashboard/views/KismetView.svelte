<script lang="ts">
	import { activeView } from '$lib/stores/dashboard/dashboardStore';
	import ToolViewWrapper from './ToolViewWrapper.svelte';

	function goBack() {
		activeView.set('map');
	}
</script>

<ToolViewWrapper title="Kismet WiFi Scanner" onBack={goBack}>
	<iframe src="http://localhost:2501" title="Kismet Web Interface" class="kismet-iframe" />
</ToolViewWrapper>

<style>
	.kismet-iframe {
		width: 100%;
		height: 100%;
		border: none;
		background: var(--palantir-bg-app);
	}
</style>
