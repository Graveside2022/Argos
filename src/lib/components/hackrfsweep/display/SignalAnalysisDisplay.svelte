<script lang="ts">
	import { displayStore } from '$lib/stores/hackrfsweep/displayStore';

	$: signalState = $displayStore.signalAnalysis;
</script>

<!-- Signal Analysis Card -->
<div
	class="saasfly-dashboard-card group rounded-2xl p-8 bg-gradient-to-br from-bg-card/90 via-bg-card/70 to-bg-card/50 border border-border-primary/50 backdrop-blur-xl shadow-xl hover:shadow-2xl hover:border-border-hover/50 hover:bg-gradient-to-br hover:from-bg-card/95 hover:via-bg-card/75 hover:to-bg-card/55 transition-all duration-300"
>
	<div class="flex items-center mb-8">
		<div
			class="p-3 rounded-xl mr-4 transition-all duration-300"
			style="background: linear-gradient(135deg, rgba(250, 204, 21, 0.2) 0%, rgba(250, 204, 21, 0.1) 100%) !important; border: 1px solid rgba(250, 204, 21, 0.2) !important; box-shadow: 0 8px 25px rgba(250, 204, 21, 0.2), 0 0 15px rgba(250, 204, 21, 0.15) !important;"
		>
			<svg
				class="w-6 h-6 group-hover:scale-110 transition-transform duration-300"
				fill="currentColor"
				viewBox="0 0 20 20"
				style="color: #facc15 !important;"
			>
				<path
					d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"
				/>
			</svg>
		</div>
		<div>
			<h3
				class="font-heading text-2xl font-semibold text-white mb-1 group-hover:text-yellow-400 transition-colors duration-300"
			>
				Signal Analysis
			</h3>
			<p
				class="text-text-muted group-hover:text-text-secondary transition-colors duration-300"
			>
				Real-time signal strength monitoring and frequency analysis
			</p>
		</div>
	</div>

	<!-- Signal Metrics Grid -->
	<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
		<div
			class="saasfly-metric-card p-6 bg-gradient-to-br from-orange-500/10 to-orange-500/5 rounded-xl border border-orange-400/20 hover:border-border-hover/50 hover:bg-gradient-to-br hover:from-orange-500/15 hover:to-orange-500/8 hover:shadow-lg hover:shadow-orange-400/20 transition-all duration-300"
		>
			<div class="text-sm text-text-muted font-medium uppercase tracking-wide mb-2">
				dB Level
			</div>
			<div class="font-mono text-2xl font-bold text-orange-400">
				{signalState.dbLevelValue}
			</div>
		</div>
		<div
			class="saasfly-metric-card p-6 bg-gradient-to-br from-signal-strong/10 to-signal-strong/5 rounded-xl border border-signal-strong/20 hover:border-border-hover/50 hover:bg-gradient-to-br hover:from-signal-strong/15 hover:to-signal-strong/8 hover:shadow-lg hover:shadow-signal-strong/20 transition-all duration-300"
		>
			<div class="text-sm text-text-muted font-medium uppercase tracking-wide mb-2">
				Signal Strength
			</div>
			<div class="text-2xl font-bold text-signal-none">
				{signalState.signalStrengthText}
			</div>
		</div>
		<div
			class="saasfly-metric-card p-6 bg-gradient-to-br from-neon-cyan/10 to-neon-cyan/5 rounded-xl border border-neon-cyan/20 hover:border-border-hover/50 hover:bg-gradient-to-br hover:from-neon-cyan/15 hover:to-neon-cyan/8 hover:shadow-lg hover:shadow-neon-cyan/20 transition-all duration-300"
		>
			<div class="text-sm text-text-muted font-medium uppercase tracking-wide mb-2">
				Target
			</div>
			<div class="font-mono text-2xl font-bold text-neon-cyan">
				{signalState.targetFrequency}
			</div>
		</div>
		<div
			class="saasfly-metric-card p-6 bg-gradient-to-br from-accent-primary/10 to-accent-primary/5 rounded-xl border border-accent-primary/20 hover:border-border-hover/50 hover:bg-gradient-to-br hover:from-accent-primary/15 hover:to-accent-primary/8 hover:shadow-lg hover:shadow-accent-primary/20 transition-all duration-300"
		>
			<div class="text-sm text-text-muted font-medium uppercase tracking-wide mb-2">
				Detected
			</div>
			<div class="font-mono text-2xl font-bold text-accent-primary">
				{signalState.detectedFrequency}
			</div>
		</div>
		<div
			class="saasfly-metric-card p-6 bg-gradient-to-br from-purple-400/10 to-purple-400/5 rounded-xl border border-purple-400/20 hover:border-border-hover/50 hover:bg-gradient-to-br hover:from-purple-400/15 hover:to-purple-400/8 hover:shadow-lg hover:shadow-purple-400/20 transition-all duration-300"
		>
			<div class="text-sm text-text-muted font-medium uppercase tracking-wide mb-2">
				Offset
			</div>
			<div class="font-mono text-2xl font-bold text-purple-400">
				{signalState.frequencyOffset}
			</div>
		</div>
	</div>

	<!-- Signal Visualization -->
	<div class="relative pb-20">
		<div class="text-sm text-text-muted uppercase tracking-wide mb-8 text-center font-medium">
			Signal Strength Scale
		</div>
		<div
			class="signal-indicator h-8 bg-bg-input rounded-lg relative border border-border-primary shadow-inner hover:cursor-crosshair"
		>
			<div
				class="signal-indicator-fill h-full transition-[width] duration-300 ease-in-out relative z-[1] rounded-md"
				id="signalIndicatorFill"
				style="width: {signalState.signalFillWidth}"
			></div>
			<div
				class="absolute top-[-8px] w-[2px] h-[calc(100%+16px)] bg-accent-primary shadow-lg transition-[left] duration-300 ease-in-out z-[3] before:content-[''] before:absolute before:top-[-4px] before:left-1/2 before:-translate-x-1/2 before:w-0 before:h-0 before:border-l-[6px] before:border-l-transparent before:border-r-[6px] before:border-r-transparent before:border-t-[6px] before:border-t-accent-primary"
				id="dbCurrentIndicator"
				style="left: {signalState.dbIndicatorPosition}"
			>
				<span
					class="font-mono absolute top-[-32px] left-1/2 -translate-x-1/2 bg-bg-card border border-accent-primary rounded px-2 py-1 text-xs font-semibold text-accent-primary whitespace-nowrap pointer-events-none"
					id="dbCurrentValue">{signalState.dbCurrentValue}</span
				>
			</div>
			<div
				class="absolute top-0 left-0 right-0 h-full flex justify-between items-center pointer-events-none z-[2]"
			>
				<!-- All markers with dB values prominently displayed -->
				<div class="absolute h-full w-px bg-white/50 top-0 left-0 hover:bg-white/40" data-db="-90">
					<span
						class="font-mono absolute top-full mt-2 text-sm text-signal-weak -translate-x-1/4 whitespace-nowrap font-bold"
						>-90</span
					>
				</div>
				<div
					class="absolute h-1/2 w-px bg-white/20 top-1/4 left-[12.5%] hover:bg-white/30"
					data-db="-80"
				>
					<span
						class="font-mono absolute top-full mt-2 text-sm text-signal-weak -translate-x-1/2 whitespace-nowrap font-bold"
						>-80</span
					>
				</div>
				<div
					class="absolute h-full w-px bg-white/50 top-0 left-1/4 hover:bg-white/40"
					data-db="-70"
				>
					<span
						class="font-mono absolute top-full mt-2 text-sm text-blue-400 -translate-x-1/2 whitespace-nowrap font-bold"
						>-70</span
					>
				</div>
				<div
					class="absolute h-1/2 w-px bg-white/20 top-1/4 left-[37.5%] hover:bg-white/30"
					data-db="-60"
				>
					<span
						class="font-mono absolute top-full mt-2 text-sm text-signal-moderate -translate-x-1/2 whitespace-nowrap font-bold"
						>-60</span
					>
				</div>
				<div
					class="absolute h-full w-px bg-white/50 top-0 left-1/2 hover:bg-white/40"
					data-db="-50"
				>
					<span
						class="font-mono absolute top-full mt-2 text-sm text-signal-moderate -translate-x-1/2 whitespace-nowrap font-bold"
						>-50</span
					>
				</div>
				<div
					class="absolute h-1/2 w-px bg-white/20 top-1/4 left-[62.5%] hover:bg-white/30"
					data-db="-40"
				>
					<span
						class="font-mono absolute top-full mt-2 text-sm text-signal-strong -translate-x-1/2 whitespace-nowrap font-bold"
						>-40</span
					>
				</div>
				<div
					class="absolute h-full w-px bg-white/50 top-0 left-3/4 hover:bg-white/40"
					data-db="-30"
				>
					<span
						class="font-mono absolute top-full mt-2 text-sm text-signal-strong -translate-x-1/2 whitespace-nowrap font-bold"
						>-30</span
					>
				</div>
				<div
					class="absolute h-1/2 w-px bg-white/20 top-1/4 left-[87.5%] hover:bg-white/30"
					data-db="-20"
				>
					<span
						class="font-mono absolute top-full mt-2 text-sm text-signal-very-strong -translate-x-1/2 whitespace-nowrap font-bold"
						>-20</span
					>
				</div>
				<div
					class="absolute h-full w-px bg-white/50 top-0 left-full hover:bg-white/40"
					data-db="-10"
				>
					<span
						class="font-mono absolute top-full mt-2 text-sm text-signal-very-strong -translate-x-3/4 whitespace-nowrap font-bold"
						>-10</span
					>
				</div>
			</div>
		</div>
		<div class="flex justify-between mt-16 px-2 absolute w-full bottom-0">
			<span class="text-xs text-signal-weak uppercase tracking-widest font-semibold"
				>← WEAK</span
			>
			<span class="text-xs text-signal-very-strong uppercase tracking-widest font-semibold"
				>STRONG →</span
			>
		</div>
	</div>
</div>

<style>
	/* Signal indicator styles */
	.signal-indicator {
		background-image: repeating-linear-gradient(
			90deg,
			transparent,
			transparent 12.4%,
			rgba(255, 255, 255, 0.05) 12.5%,
			rgba(255, 255, 255, 0.05) 12.6%
		);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
	}

	.signal-indicator-fill {
		background: linear-gradient(
			90deg,
			rgba(239, 68, 68, 0.8) 0%,
			rgba(251, 146, 60, 0.8) 25%,
			rgba(251, 191, 36, 0.8) 50%,
			rgba(34, 197, 94, 0.8) 75%,
			rgba(34, 197, 94, 1) 100%
		);
		box-shadow: 0 0 10px rgba(34, 197, 94, 0.3);
	}

	.saasfly-metric-card {
		transition: all 0.3s ease;
	}
</style>