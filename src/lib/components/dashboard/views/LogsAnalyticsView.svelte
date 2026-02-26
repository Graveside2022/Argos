<script lang="ts">
	import { activeView } from '$lib/stores/dashboard/dashboard-store';

	import ToolViewWrapper from './ToolViewWrapper.svelte';
</script>

<ToolViewWrapper title="Logs & Analytics" onBack={() => activeView.set('map')}>
	<div class="logs-analytics-placeholder">
		<p class="placeholder-text">Logs & Analytics integration coming soon.</p>
	</div>
</ToolViewWrapper>

<style>
	.logs-analytics-placeholder {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.placeholder-text {
		font-size: var(--text-sm);
		color: var(--foreground-secondary);
	}
</style>
