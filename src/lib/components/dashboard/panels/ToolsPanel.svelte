<script lang="ts">
	import ToolsPanelHeader from './ToolsPanelHeader.svelte';
	import ToolsNavigationView from './ToolsNavigationView.svelte';
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
