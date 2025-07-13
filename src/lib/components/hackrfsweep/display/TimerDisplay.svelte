<script lang="ts">
	import { displayStore } from '$lib/stores/hackrfsweep/displayStore';

	$: timerState = $displayStore.timer;
</script>

<!-- Cycle Status Card -->
<div
	class="saasfly-dashboard-card cycle-status-card group rounded-2xl p-8 bg-gradient-to-br from-bg-card/90 via-bg-card/70 to-bg-card/50 border border-border-primary/50 backdrop-blur-xl shadow-xl hover:shadow-2xl hover:border-border-hover/50 hover:bg-gradient-to-br hover:from-bg-card/95 hover:via-bg-card/75 hover:to-bg-card/55 transition-all duration-300"
>
	<div class="flex items-center mb-8">
		<div
			class="p-3 rounded-xl mr-4 transition-all duration-300"
			style="background: linear-gradient(135deg, rgba(251, 146, 60, 0.2) 0%, rgba(251, 146, 60, 0.1) 100%) !important; border: 1px solid rgba(251, 146, 60, 0.2) !important; box-shadow: 0 8px 25px rgba(251, 146, 60, 0.2), 0 0 15px rgba(251, 146, 60, 0.15) !important;"
		>
			<svg
				class="w-6 h-6 group-hover:scale-110 transition-transform duration-300"
				fill="currentColor"
				viewBox="0 0 20 20"
				style="color: #fb923c !important;"
			>
				<path
					fill-rule="evenodd"
					d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707L11 12.414V6z"
				/>
			</svg>
		</div>
		<div>
			<h3
				class="font-heading text-2xl font-semibold text-white mb-1 group-hover:text-blue-400 transition-colors duration-300"
			>
				Cycle Status
			</h3>
			<p
				class="text-text-muted group-hover:text-text-secondary transition-colors duration-300"
			>
				Real-time sweep monitoring
			</p>
		</div>
	</div>

	<div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
		<div
			class="saasfly-info-card p-6 bg-gradient-to-br from-accent-primary/10 to-accent-primary/5 rounded-xl border border-accent-primary/20 hover:border-border-hover/50 hover:bg-gradient-to-br hover:from-accent-primary/15 hover:to-accent-primary/8 hover:shadow-lg hover:shadow-accent-primary/20 transition-all duration-300"
		>
			<div
				class="text-sm font-medium uppercase tracking-wide mb-2"
				style="color: #525252 !important;"
			>
				Next Frequency
			</div>
			<div class="font-mono text-3xl font-bold text-accent-primary">
				{timerState.currentFrequencyDisplay}
			</div>
		</div>
		<div
			class="saasfly-info-card p-6 bg-gradient-to-br from-neon-cyan/10 to-neon-cyan/5 rounded-xl border border-neon-cyan/20 hover:border-border-hover/50 hover:bg-gradient-to-br hover:from-neon-cyan/15 hover:to-neon-cyan/8 hover:shadow-lg hover:shadow-neon-cyan/20 transition-all duration-300"
		>
			<div
				class="text-sm font-medium uppercase tracking-wide mb-2"
				style="color: #525252 !important;"
			>
				Next Switch In
			</div>
			<div class="font-mono text-3xl font-bold text-neon-cyan">
				{timerState.switchTimer}
			</div>
		</div>
	</div>

	<div class="h-2 bg-bg-secondary rounded-full overflow-hidden">
		<div
			id="timerProgressBar"
			class="h-full bg-gradient-to-r from-accent-primary to-accent-hover rounded-full transition-[width] duration-100 ease-linear"
			style="width: {timerState.timerProgress}%"
		></div>
	</div>
</div>

<style>
	.saasfly-dashboard-card {
		position: relative;
		overflow: hidden;
	}

	.saasfly-info-card {
		transition: all 0.3s ease;
	}
</style>