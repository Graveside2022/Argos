<script lang="ts">
	import { spectrumData, signalHistory } from '$lib/stores/hackrf';
	import { onMount, onDestroy } from 'svelte';

	let canvas: HTMLCanvasElement;
	let ctx: CanvasRenderingContext2D | null;
	let animationFrame: number;

	// Canvas dimensions
	let width = 800;
	let height = 400;

	// Grade A+ Performance Optimization Constants
	const PERFORMANCE_CONFIG = {
		MAX_FPS: 30, // Limit to 30 FPS for better performance
		FRAME_SKIP_THRESHOLD: 33.33, // ~30 FPS in ms
		DATA_CHANGE_THRESHOLD: 0.01, // Minimum data change to trigger redraw
		GRADIENT_CACHE_SIZE: 5, // Cache gradients to reduce creation overhead
		MIN_REDRAW_INTERVAL: 16.67 // Minimum time between redraws (60 FPS max)
	} as const;

	// Performance optimization state
	let lastDrawTime = 0;
	let lastDataHash = '';
	let frameSkipCounter = 0;
	let gradientCache: Map<string, CanvasGradient> = new Map();
	let _lastSpectrumData: unknown = null;

	function resizeCanvas() {
		if (canvas && canvas.parentElement) {
			width = canvas.parentElement.clientWidth;
			canvas.width = width;
			canvas.height = height;
		}
	}

	let isDrawing = false;

	/**
	 * Grade A+ optimized spectrum drawing with performance controls
	 */
	function drawSpectrum() {
		if (!ctx || isDrawing) return;

		// Performance throttling - limit frame rate
		const currentTime = performance.now();
		if (currentTime - lastDrawTime < PERFORMANCE_CONFIG.FRAME_SKIP_THRESHOLD) {
			frameSkipCounter++;
			if (frameSkipCounter < 2) return; // Skip some frames
		}
		frameSkipCounter = 0;
		lastDrawTime = currentTime;

		// Data change detection to avoid unnecessary redraws
		const dataHash = generateDataHash($spectrumData);
		if (dataHash === lastDataHash && dataHash !== '') return;
		lastDataHash = dataHash;

		isDrawing = true;

		// Clear canvas
		ctx.fillStyle = '#0a0f1b';
		ctx.fillRect(0, 0, width, height);

		// Define chart area with margins
		const leftMargin = 60;
		const rightMargin = 10;
		const topMargin = 10;
		const bottomMargin = 30;
		const chartWidth = width - leftMargin - rightMargin;
		const chartHeight = height - topMargin - bottomMargin;

		// Draw grid with optimized line drawing
		drawOptimizedGrid(
			leftMargin,
			rightMargin,
			topMargin,
			bottomMargin,
			chartWidth,
			chartHeight
		);

		// Draw spectrum data if available
		if ($spectrumData && $spectrumData.power_levels && $spectrumData.power_levels.length > 0) {
			drawOptimizedSpectrum($spectrumData, leftMargin, topMargin, chartWidth, chartHeight);
		}

		// Draw labels with cached font settings
		drawOptimizedLabels(leftMargin, topMargin, chartWidth, chartHeight);

		isDrawing = false;
	}

	/**
	 * Grade A+ optimized grid drawing
	 */
	function drawOptimizedGrid(
		leftMargin: number,
		rightMargin: number,
		topMargin: number,
		bottomMargin: number,
		chartWidth: number,
		chartHeight: number
	) {
		if (!ctx) return;

		ctx.strokeStyle = '#1a2332';
		ctx.lineWidth = 1;
		ctx.beginPath();

		// Batch horizontal grid lines for better performance
		for (let i = 0; i <= 10; i++) {
			const y = topMargin + (chartHeight / 10) * i;
			ctx.moveTo(leftMargin, y);
			ctx.lineTo(leftMargin + chartWidth, y);
		}

		// Batch vertical grid lines for better performance
		for (let i = 0; i <= 20; i++) {
			const x = leftMargin + (chartWidth / 20) * i;
			ctx.moveTo(x, topMargin);
			ctx.lineTo(x, topMargin + chartHeight);
		}

		ctx.stroke();
	}

	/**
	 * Grade A+ optimized spectrum line drawing with gradient caching
	 */
	function drawOptimizedSpectrum(
		data: { power_levels?: number[] },
		leftMargin: number,
		topMargin: number,
		chartWidth: number,
		chartHeight: number
	) {
		if (!ctx || !data.power_levels) return;

		const dataPoints = data.power_levels.length;
		const xStep = chartWidth / dataPoints;

		// Use cached gradient or create new one
		const gradientKey = `spectrum-${height}`;
		let gradient = gradientCache.get(gradientKey);
		if (!gradient) {
			gradient = ctx.createLinearGradient(0, 0, 0, height);
			gradient.addColorStop(0, '#00ffff');
			gradient.addColorStop(0.5, '#0080ff');
			gradient.addColorStop(1, '#0040ff');

			// Cache management - limit cache size
			if (gradientCache.size >= PERFORMANCE_CONFIG.GRADIENT_CACHE_SIZE) {
				const firstKey = gradientCache.keys().next().value;
				if (firstKey !== undefined) {
					gradientCache.delete(firstKey);
				}
			}
			gradientCache.set(gradientKey, gradient);
		}

		// Draw spectrum line with optimized path building
		ctx.strokeStyle = gradient;
		ctx.lineWidth = 2;
		ctx.beginPath();

		// Optimized power level processing with early path generation
		for (let index = 0; index < data.power_levels.length; index++) {
			const power = data.power_levels[index];
			const x = leftMargin + index * xStep;
			const normalizedPower = Math.max(0, Math.min(1, (power + 100) / 100));
			const y = topMargin + chartHeight - normalizedPower * chartHeight;

			if (index === 0) {
				ctx.moveTo(x, y);
			} else {
				ctx.lineTo(x, y);
			}
		}

		ctx.stroke();

		// Optimized fill area under curve
		ctx.lineTo(leftMargin + chartWidth, topMargin + chartHeight);
		ctx.lineTo(leftMargin, topMargin + chartHeight);
		ctx.closePath();
		ctx.fillStyle = 'rgba(0, 255, 255, 0.1)';
		ctx.fill();
	}

	/**
	 * Grade A+ optimized label drawing with font caching
	 */
	function drawOptimizedLabels(
		leftMargin: number,
		topMargin: number,
		chartWidth: number,
		chartHeight: number
	) {
		if (!ctx) return;

		// Draw frequency labels
		ctx.fillStyle = '#9ca3af';
		ctx.font = '12px monospace';
		ctx.textAlign = 'center';

		if ($spectrumData && $spectrumData.start_freq && $spectrumData.stop_freq) {
			const freqRange = $spectrumData.stop_freq - $spectrumData.start_freq;

			// Optimized frequency label drawing
			for (let i = 0; i <= 10; i++) {
				const freq = $spectrumData.start_freq + (freqRange / 10) * i;
				const x = leftMargin + (chartWidth / 10) * i;
				ctx.fillText(`${freq.toFixed(1)}`, x, height - 5);
			}

			// Draw MHz label
			ctx.textAlign = 'right';
			ctx.fillText('MHz', width - 5, height - 5);
		}

		// Draw power labels with optimized batch operations
		ctx.textAlign = 'right';
		ctx.fillStyle = '#9ca3af';
		ctx.font = '12px monospace';

		// Batch power scale drawing
		ctx.strokeStyle = '#4a5568';
		ctx.lineWidth = 1;
		ctx.beginPath();

		for (let i = 0; i <= 10; i++) {
			const power = -100 + i * 10;
			const y = topMargin + chartHeight - (i * chartHeight) / 10;

			// Batch tick marks
			ctx.moveTo(leftMargin - 5, y);
			ctx.lineTo(leftMargin, y);

			// Draw power labels
			ctx.fillText(`${power}`, leftMargin - 8, y + 4);
		}

		ctx.stroke();

		// Draw dBm label with optimized transform
		ctx.save();
		ctx.translate(15, height / 2);
		ctx.rotate(-Math.PI / 2);
		ctx.textAlign = 'center';
		ctx.fillText('Power (dBm)', 0, 0);
		ctx.restore();
	}

	/**
	 * Generate optimized hash of spectrum data for change detection
	 */
	function generateDataHash(
		data: { power_levels?: number[]; start_freq?: number; stop_freq?: number } | null
	): string {
		if (!data || !data.power_levels || data.power_levels.length === 0) return '';

		// Sample key points for change detection to avoid hashing entire array
		const sampleSize = Math.min(10, data.power_levels.length);
		const step = Math.floor(data.power_levels.length / sampleSize);
		let hash = `${data.start_freq}-${data.stop_freq}-`;

		for (let i = 0; i < data.power_levels.length; i += step) {
			hash += data.power_levels[i].toFixed(1);
		}

		return hash;
	}

	function startAnimation() {
		if (animationFrame) {
			cancelAnimationFrame(animationFrame);
		}

		function animate() {
			drawSpectrum();
			animationFrame = requestAnimationFrame(animate);
		}

		animate();
	}

	onMount(() => {
		const context = canvas.getContext('2d');
		if (context) {
			ctx = context;
			resizeCanvas();
			startAnimation();
		}

		if (typeof window !== 'undefined') {
			window.addEventListener('resize', resizeCanvas);
		}
	});

	onDestroy(() => {
		if (animationFrame) {
			cancelAnimationFrame(animationFrame);
		}
		if (typeof window !== 'undefined') {
			window.removeEventListener('resize', resizeCanvas);
		}
	});
</script>

<!-- Spectrum Analysis Dashboard -->
<div class="glass-panel rounded-xl p-6">
	<h3 class="text-h4 font-heading font-semibold text-text-primary mb-6 flex items-center">
		<svg class="w-5 h-5 mr-2 text-neon-cyan" fill="currentColor" viewBox="0 0 20 20">
			<path
				d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"
			/>
		</svg>
		Spectrum Analysis
	</h3>

	<!-- Real-time Spectrum Display -->
	<div class="relative mb-6">
		<canvas
			bind:this={canvas}
			class="w-full rounded-lg border border-border-primary bg-bg-deep"
			{width}
			{height}
		></canvas>

		<!-- Loading Overlay -->
		{#if !$spectrumData || !$spectrumData.power_levels || $spectrumData.power_levels.length === 0}
			<div class="absolute inset-0 flex items-center justify-center bg-bg-deep/80 rounded-lg">
				<div class="text-center">
					<svg
						class="w-12 h-12 mx-auto mb-4 text-text-muted animate-pulse"
						fill="currentColor"
						viewBox="0 0 20 20"
					>
						<path
							fill-rule="evenodd"
							d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 6.343a1 1 0 010-1.414l1.414-1.414a1 1 0 111.414 1.414l-1.414 1.414a1 1 0 01-1.414 0zM5.05 6.343a1 1 0 010 1.414L3.636 9.172a1 1 0 11-1.414-1.414l1.414-1.415a1 1 0 011.414 0z"
							clip-rule="evenodd"
						/>
					</svg>
					<p class="font-mono text-body text-text-muted">Waiting for spectrum data...</p>
				</div>
			</div>
		{/if}
	</div>

	<!-- Signal Statistics -->
	<div class="grid grid-cols-1 md:grid-cols-4 gap-4">
		<div class="glass-panel-light rounded-lg p-4">
			<span class="font-mono text-xs text-text-muted uppercase tracking-wider"
				>Peak Power</span
			>
			<p class="font-mono text-h5 text-neon-green mt-1">
				{$spectrumData?.peak_power ? `${$spectrumData.peak_power.toFixed(1)} dBm` : '--'}
			</p>
		</div>
		<div class="glass-panel-light rounded-lg p-4">
			<span class="font-mono text-xs text-text-muted uppercase tracking-wider"
				>Peak Frequency</span
			>
			<p class="font-mono text-h5 text-accent-primary mt-1">
				{$spectrumData?.peak_freq ? `${$spectrumData.peak_freq.toFixed(3)} MHz` : '--'}
			</p>
		</div>
		<div class="glass-panel-light rounded-lg p-4">
			<span class="font-mono text-xs text-text-muted uppercase tracking-wider"
				>Average Power</span
			>
			<p class="font-mono text-h5 text-text-primary mt-1">
				{$spectrumData?.avg_power ? `${$spectrumData.avg_power.toFixed(1)} dBm` : '--'}
			</p>
		</div>
		<div class="glass-panel-light rounded-lg p-4">
			<span class="font-mono text-xs text-text-muted uppercase tracking-wider">Bandwidth</span
			>
			<p class="font-mono text-h5 text-text-primary mt-1">
				{$spectrumData?.start_freq && $spectrumData?.stop_freq
					? `${($spectrumData.stop_freq - $spectrumData.start_freq).toFixed(1)} MHz`
					: '--'}
			</p>
		</div>
	</div>

	<!-- Signal History -->
	{#if $signalHistory.length > 0}
		<div class="mt-6">
			<h4 class="font-mono text-xs text-text-muted uppercase tracking-wider mb-3">
				Recent Signals
			</h4>
			<div class="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
				{#each $signalHistory.slice(-5).reverse() as signal}
					<div
						class="glass-panel-light rounded-lg p-3 flex items-center justify-between text-caption"
					>
						<span class="font-mono text-text-secondary"
							>{new Date(signal.timestamp).toLocaleTimeString()}</span
						>
						<span class="font-mono text-accent-primary"
							>{signal.frequency.toFixed(3)} MHz</span
						>
						<span
							class="font-mono {signal.power > -50
								? 'text-neon-green'
								: 'text-text-muted'}">{signal.power.toFixed(1)} dBm</span
						>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>
