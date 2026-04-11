<script lang="ts">
	import { activeView } from '$lib/stores/dashboard/dashboard-store';

	import ToolViewWrapper from './ToolViewWrapper.svelte';

	function goBack() {
		activeView.set('map');
	}
</script>

<ToolViewWrapper title="WebTAK — Team Awareness Kit" onBack={goBack}>
	<iframe
		src="/webtak/index.html"
		title="WebTAK Team Awareness Kit"
		class="webtak-iframe"
		sandbox="allow-scripts allow-same-origin allow-forms"
	/>
</ToolViewWrapper>

<style>
	.webtak-iframe {
		width: 100%;
		height: 100%;
		border: none;
		background: var(--background);
	}
</style>
