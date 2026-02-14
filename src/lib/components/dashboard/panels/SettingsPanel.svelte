<!-- @constitutional-exemption Article-IV-4.3 issue:#TBD — Component state handling (loading/error/empty UI) deferred to UX improvement phase -->
<script lang="ts">
</script>

<div class="settings-panel">
	<header class="panel-header">
		<span class="panel-title">SETTINGS</span>
	</header>

	<section class="panel-section">
		<div class="no-data">Settings options coming soon.</div>
	</section>
</div>

<style>
	.settings-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
	}

	.panel-header {
		padding: var(--space-4);
		border-bottom: 1px solid var(--palantir-border-subtle);
	}

	.panel-title {
		font-size: var(--text-xs);
		font-weight: var(--font-weight-semibold);
		letter-spacing: var(--letter-spacing-widest);
		color: var(--palantir-text-secondary);
	}

	.panel-section {
		padding: var(--space-4);
		border-bottom: 1px solid var(--palantir-border-subtle);
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.no-data {
		font-size: var(--text-sm);
		color: var(--palantir-text-tertiary);
		font-style: italic;
	}
</style>
