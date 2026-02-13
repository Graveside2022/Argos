<script lang="ts">
	import ToolsNavigationView from './ToolsNavigationView.svelte';
	import ToolsPanelHeader from './ToolsPanelHeader.svelte';
</script>

<div class="tools-panel">
	<ToolsPanelHeader />
	<ToolsNavigationView />
</div>

<style>
	.tools-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
	}
</style>
