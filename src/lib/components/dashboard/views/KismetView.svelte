<script lang="ts">
	import { onMount } from 'svelte';

	import { activeView } from '$lib/stores/dashboard/dashboard-store';

	import ToolViewWrapper from './ToolViewWrapper.svelte';

	let iframeUrl = '';

	onMount(() => {
		const host = window.location.hostname;
		iframeUrl = `http://${host}:2501/`;
	});

	function goBack() {
		activeView.set('map');
	}
</script>

<ToolViewWrapper title="Kismet WiFi Scanner" onBack={goBack}>
	{#if iframeUrl}
		<iframe src={iframeUrl} title="Kismet Web Interface" class="kismet-iframe"></iframe>
	{/if}
</ToolViewWrapper>

<style>
	.kismet-iframe {
		width: 100%;
		height: 100%;
		border: none;
		background: var(--background);
	}
</style>
