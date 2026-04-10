<script lang="ts">
	import { activeView } from '$lib/stores/dashboard/dashboard-store';

	import ToolViewWrapper from './ToolViewWrapper.svelte';

	function goBack() {
		activeView.set('map');
	}

	const spiderfootUrl = '/api/spiderfoot/proxy';
</script>

<ToolViewWrapper title="SpiderFoot — OSINT Automation" onBack={goBack}>
	<iframe src={spiderfootUrl} title="SpiderFoot OSINT Automation" class="spiderfoot-iframe" />
</ToolViewWrapper>

<style>
	.spiderfoot-iframe {
		width: 100%;
		height: 100%;
		border: none;
		background: var(--background);
	}
</style>
