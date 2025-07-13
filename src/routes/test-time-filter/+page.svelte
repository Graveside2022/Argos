<script lang="ts">
	import TimeWindowControl from '$lib/components/hackrf/TimeWindowControl.svelte';
	import TimedSignalDisplay from '$lib/components/hackrf/TimedSignalDisplay.svelte';
	import SignalAgeVisualization from '$lib/components/hackrf/SignalAgeVisualization.svelte';
	import TimeFilterDemo from '$lib/components/hackrf/TimeFilterDemo.svelte';
	import { timeWindowFilter } from '$lib/services/hackrf/timeWindowFilter';
	
	const { stats } = timeWindowFilter;
</script>

<svelte:head>
	<title>Time-Based Signal Filtering Demo</title>
</svelte:head>

<div class="min-h-screen bg-bg-primary p-8">
	<div class="max-w-7xl mx-auto space-y-8">
		<!-- Header -->
		<div class="text-center">
			<h1 class="text-4xl font-heading font-bold text-text-primary mb-2">
				Time-Based Signal Filtering
			</h1>
			<p class="text-text-muted">
				Demonstration of sliding time window filtering for drone operations
			</p>
		</div>
		
		<!-- Stats Overview -->
		<div class="glass-panel rounded-xl p-6">
			<div class="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
				<div>
					<div class="text-3xl font-mono font-bold text-neon-green">{$stats.activeSignals}</div>
					<div class="text-sm text-text-muted uppercase">Active Signals</div>
				</div>
				<div>
					<div class="text-3xl font-mono font-bold text-amber-400">{$stats.fadingSignals}</div>
					<div class="text-sm text-text-muted uppercase">Fading Signals</div>
				</div>
				<div>
					<div class="text-3xl font-mono font-bold text-text-secondary">{$stats.totalSignals}</div>
					<div class="text-sm text-text-muted uppercase">Total Signals</div>
				</div>
				<div>
					<div class="text-3xl font-mono font-bold text-accent-primary">{$stats.signalTurnover.toFixed(1)}</div>
					<div class="text-sm text-text-muted uppercase">Signals/Second</div>
				</div>
			</div>
		</div>
		
		<!-- Main Grid -->
		<div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
			<!-- Left Column - Controls -->
			<div class="space-y-6">
				<TimeWindowControl />
				<TimeFilterDemo />
			</div>
			
			<!-- Middle Column - Signal Display -->
			<div>
				<TimedSignalDisplay />
			</div>
			
			<!-- Right Column - Visualization -->
			<div class="space-y-6">
				<SignalAgeVisualization />
				
				<!-- Feature Highlights -->
				<div class="glass-panel rounded-xl p-6 space-y-4">
					<h3 class="text-h5 font-heading font-semibold text-text-primary">Key Features</h3>
					<ul class="space-y-3 text-sm text-text-secondary">
						<li class="flex items-start gap-2">
							<svg class="w-5 h-5 text-green-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
								<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
							</svg>
							<span>Configurable sliding time windows (5s - 5min)</span>
						</li>
						<li class="flex items-start gap-2">
							<svg class="w-5 h-5 text-green-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
								<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
							</svg>
							<span>Visual fade-out effects for aging signals</span>
						</li>
						<li class="flex items-start gap-2">
							<svg class="w-5 h-5 text-green-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
								<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
							</svg>
							<span>Automatic signal expiration and cleanup</span>
						</li>
						<li class="flex items-start gap-2">
							<svg class="w-5 h-5 text-green-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
								<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
							</svg>
							<span>Real-time age distribution visualization</span>
						</li>
						<li class="flex items-start gap-2">
							<svg class="w-5 h-5 text-green-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
								<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
							</svg>
							<span>Preset configurations for different scenarios</span>
						</li>
						<li class="flex items-start gap-2">
							<svg class="w-5 h-5 text-green-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
								<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
							</svg>
							<span>Signal relevance scoring based on age</span>
						</li>
					</ul>
				</div>
				
				<!-- Use Cases -->
				<div class="glass-panel rounded-xl p-6 space-y-4">
					<h3 class="text-h5 font-heading font-semibold text-text-primary">Use Cases</h3>
					<div class="space-y-3 text-sm text-text-secondary">
						<div>
							<h4 class="font-semibold text-text-primary mb-1">Drone Operations</h4>
							<p>30-second windows ideal for moving platforms where old signals become irrelevant</p>
						</div>
						<div>
							<h4 class="font-semibold text-text-primary mb-1">Stationary Monitoring</h4>
							<p>2-5 minute windows for fixed installations tracking persistent signals</p>
						</div>
						<div>
							<h4 class="font-semibold text-text-primary mb-1">Rapid Scanning</h4>
							<p>10-second windows for high-speed surveys or quick area assessments</p>
						</div>
						<div>
							<h4 class="font-semibold text-text-primary mb-1">Pattern Detection</h4>
							<p>5+ minute windows for identifying patterns and signal relationships</p>
						</div>
					</div>
				</div>
			</div>
		</div>
		
		<!-- Footer -->
		<div class="text-center text-sm text-text-muted pt-8">
			<p>Time-based filtering system designed for real-time RF monitoring applications</p>
		</div>
	</div>
</div>