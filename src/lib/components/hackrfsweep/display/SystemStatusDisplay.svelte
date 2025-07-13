<script lang="ts">
	import { displayStore } from '$lib/stores/hackrfsweep/displayStore';

	$: systemStatus = $displayStore.systemStatus;
</script>

<!-- System Status Card -->
<div
	class="saasfly-feature-card group rounded-2xl p-8 bg-gradient-to-br from-bg-card/80 via-bg-card/60 to-bg-card/40 border border-border-primary/40 backdrop-blur-xl shadow-lg hover:shadow-xl hover:border-border-hover/50 hover:bg-gradient-to-br hover:from-bg-card/90 hover:via-bg-card/70 hover:to-bg-card/50 transition-all duration-300"
>
	<div class="flex items-center mb-6">
		<div
			class="p-3 bg-gradient-to-br from-green-500/20 to-green-500/10 rounded-xl mr-4 border border-green-400/20 group-hover:border-border-hover/50 group-hover:shadow-lg group-hover:shadow-green-400/20 transition-all duration-300"
		>
			<svg
				class="w-6 h-6 text-green-400 group-hover:scale-110 transition-transform duration-300"
				fill="currentColor"
				viewBox="0 0 20 20"
			>
				{#if systemStatus.isReady}
					<path
						fill-rule="evenodd"
						d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
					/>
				{:else}
					<path
						fill-rule="evenodd"
						d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
					/>
				{/if}
			</svg>
		</div>
		<div>
			<h3
				class="font-heading text-xl font-semibold text-white mb-1 transition-colors duration-300"
			>
				System Status
			</h3>
			<p
				class="text-sm text-text-muted group-hover:text-text-secondary transition-colors duration-300"
			>
				Current system information
			</p>
		</div>
	</div>
	<div
		class="saasfly-status-card text-text-secondary min-h-[3rem] flex items-center px-4 py-3 bg-gradient-to-r from-bg-card/30 to-bg-card/20 rounded-xl border border-border-primary/30 hover:border-border-hover/50 hover:bg-gradient-to-r hover:from-bg-card/40 hover:to-bg-card/30 hover:shadow-lg hover:shadow-neon-cyan/10 transition-all duration-300"
		class:status-ready={systemStatus.isReady}
		class:status-error={!systemStatus.isReady}
	>
		{systemStatus.statusMessage || 'Ready to start monitoring'}
	</div>
</div>

<style>
	.saasfly-feature-card {
		position: relative;
		overflow: hidden;
	}

	.saasfly-feature-card::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 2px;
		background: linear-gradient(90deg, transparent, rgba(0, 212, 255, 0.4), transparent);
		opacity: 0;
		transition: opacity 0.3s ease;
	}

	.saasfly-feature-card:hover::before {
		opacity: 1;
	}

	.status-ready {
		@apply border-green-400/30 bg-gradient-to-r from-green-500/10 to-green-500/5;
	}

	.status-error {
		@apply border-red-400/30 bg-gradient-to-r from-red-500/10 to-red-500/5 text-red-400;
	}

	.saasfly-status-card {
		transition: all 0.3s ease;
	}
</style>