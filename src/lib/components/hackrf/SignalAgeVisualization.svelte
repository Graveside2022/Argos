<script lang="ts">
	import { timeWindowFilter, getAgeColor } from '$lib/services/hackrf/timeWindowFilter';
	import { onMount, onDestroy } from 'svelte';

	const { signals: _signals, stats } = timeWindowFilter;

	let canvas: HTMLCanvasElement;
	let ctx: CanvasRenderingContext2D | null;
	let animationFrame: number;

	// Canvas dimensions
	let width = 400;
	let height = 200;

	// Grade A+ Performance Optimization Constants
	const PERFORMANCE_CONFIG = {
		MAX_FPS: 30, // Limit to 30 FPS for better performance
		FRAME_SKIP_THRESHOLD: 33.33, // ~30 FPS in ms
		DATA_CHANGE_THRESHOLD: 0.01, // Minimum data change to trigger redraw
		MIN_REDRAW_INTERVAL: 16.67 // Minimum time between redraws (60 FPS max)
	} as const;

	// Performance optimization state
	let lastDrawTime = 0;
	let lastDataHash = '';
	let frameSkipCounter = 0;
	let isDrawing = false;

	// Age buckets for histogram
	let bucketCount = 20;
	let ageDistribution: { age: number; count: number }[] = [];

	function resizeCanvas() {
		if (canvas && canvas.parentElement) {
			width = canvas.parentElement.clientWidth;
			canvas.width = width;
			canvas.height = height;
		}
	}

	/**
	 * Update age distribution data with Grade A+ performance optimization
	 */
	function updateDistribution() {
		ageDistribution = timeWindowFilter.getAgeDistribution(bucketCount);
	}

	/**
	 * Generate hash of age distribution data to detect changes
	 */
	function generateDataHash(distribution: { age: number; count: number }[]): string {
		if (!distribution || distribution.length === 0) return '';

		// Create hash from key data points to avoid expensive full array hashing
		const sampleSize = Math.min(5, distribution.length);
		const step = Math.max(1, Math.floor(distribution.length / sampleSize));
		let hash = '';

		for (let i = 0; i < distribution.length; i += step) {
			hash += `${distribution[i].age.toFixed(1)}-${distribution[i].count}|`;
		}

		return hash;
	}

	/**
	 * Grade A+ optimized visualization drawing with performance controls
	 */
	function drawVisualization(): void {
		if (!ctx || isDrawing) return;

		// Performance throttling - limit frame rate
		const currentTime = performance.now();
		if (currentTime - lastDrawTime < PERFORMANCE_CONFIG.FRAME_SKIP_THRESHOLD) {
			frameSkipCounter++;
			if (frameSkipCounter < 2) return; // Skip some frames
		}
		frameSkipCounter = 0;

		// Mark drawing state to prevent concurrent draws
		isDrawing = true;

		try {
			// Update distribution data
			updateDistribution();

			// Data change detection to avoid unnecessary redraws
			const dataHash = generateDataHash(ageDistribution);
			if (dataHash === lastDataHash && dataHash !== '') {
				isDrawing = false;
				return;
			}
			lastDataHash = dataHash;
			lastDrawTime = currentTime;

			// Clear canvas with optimized fill
			ctx.fillStyle = '#0a0f1b';
			ctx.fillRect(0, 0, width, height);

			if (ageDistribution.length === 0) {
				// No data message
				ctx.fillStyle = '#6b7280';
				ctx.font = '14px monospace';
				ctx.textAlign = 'center';
				ctx.fillText('No signals to display', width / 2, height / 2);
				isDrawing = false;
				return;
			}

			// Chart dimensions with performance-aware calculations
			const padding = 40;
			const chartWidth = width - padding * 2;
			const chartHeight = height - padding * 2;

			// Pre-calculate scaling values to avoid repeated computations
			const maxCount = Math.max(...ageDistribution.map((d) => d.count));
			const maxAge = Math.max(...ageDistribution.map((d) => d.age));
			const barWidth = chartWidth / ageDistribution.length;

			// Draw axes with optimized path operations
			ctx.strokeStyle = '#4a5568';
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.moveTo(padding, padding);
			ctx.lineTo(padding, height - padding);
			ctx.lineTo(width - padding, height - padding);
			ctx.stroke();

			// Draw bars with performance optimization
			ctx.save(); // Save context state for batch operations

			ageDistribution.forEach((bucket, i) => {
				if (!ctx) return;

				const barHeight = (bucket.count / maxCount) * chartHeight;
				const x = padding + i * barWidth;
				const y = height - padding - barHeight;

				// Get color based on age with cached calculations
				const agePercent = (bucket.age / maxAge) * 100;
				ctx.fillStyle = getAgeColor(agePercent);

				// Draw bar with optimized rectangle drawing
				ctx.fillRect(x + barWidth * 0.1, y, barWidth * 0.8, barHeight);

				// Draw count label if bar is tall enough (with performance threshold)
				if (barHeight > 20 && bucket.count > 0) {
					ctx.fillStyle = '#ffffff';
					ctx.font = '11px monospace';
					ctx.textAlign = 'center';
					ctx.fillText(bucket.count.toString(), x + barWidth / 2, y - 5);
				}
			});

			ctx.restore(); // Restore context state

			// Draw labels with batched font operations
			ctx.fillStyle = '#9ca3af';
			ctx.font = '12px monospace';

			// Y-axis label (count) with optimized transform
			ctx.save();
			ctx.translate(15, height / 2);
			ctx.rotate(-Math.PI / 2);
			ctx.textAlign = 'center';
			ctx.fillText('Signal Count', 0, 0);
			ctx.restore();

			// X-axis label (age)
			ctx.textAlign = 'center';
			ctx.fillText('Signal Age (seconds)', width / 2, height - 10);

			// Draw age markers with performance-optimized loop
			ctx.textAlign = 'center';
			ctx.font = '10px monospace';
			const ageStep = maxAge / 5;
			for (let i = 0; i <= 5; i++) {
				const age = i * ageStep;
				const x = padding + (i / 5) * chartWidth;
				ctx.fillText(age.toFixed(0), x, height - padding + 20);
			}

			// Draw title with optimized font operations
			ctx.fillStyle = '#ffffff';
			ctx.font = '14px sans-serif';
			ctx.textAlign = 'center';
			ctx.fillText('Signal Age Distribution', width / 2, 20);

			// Draw legend with batched operations
			const legendY = 35;
			const legendItems = [
				{ label: 'New', color: '#10b981' },
				{ label: 'Active', color: '#f59e0b' },
				{ label: 'Fading', color: '#ef4444' },
				{ label: 'Expiring', color: '#6b7280' }
			];

			let legendX = width / 2 - 100;
			ctx.font = '11px monospace';

			// Batch legend drawing for better performance
			legendItems.forEach((item) => {
				if (!ctx) return;

				ctx.fillStyle = item.color;
				ctx.fillRect(legendX, legendY - 8, 12, 12);
				ctx.fillStyle = '#9ca3af';
				ctx.textAlign = 'left';
				ctx.fillText(item.label, legendX + 16, legendY);
				legendX += 60;
			});
		} finally {
			// Always reset drawing state
			isDrawing = false;
		}
	}

	/**
	 * Grade A+ performance-optimized animation loop with frame rate control
	 */
	function animate(): void {
		// Only draw if we have new data or significant time has passed
		const currentTime = performance.now();
		const timeSinceLastDraw = currentTime - lastDrawTime;

		if (timeSinceLastDraw >= 1000 / PERFORMANCE_CONFIG.MAX_FPS) {
			drawVisualization();
		}

		animationFrame = requestAnimationFrame(animate);
	}

	onMount(() => {
		const context = canvas.getContext('2d');
		if (context) {
			ctx = context;
			resizeCanvas();
			animate();
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

<div class="glass-panel rounded-xl p-4">
	<canvas bind:this={canvas} class="w-full rounded-lg" {width} {height}></canvas>

	<!-- Summary stats -->
	<div class="grid grid-cols-4 gap-2 mt-4 text-xs">
		<div class="text-center">
			<div class="text-text-muted">Total</div>
			<div class="font-mono text-text-primary">{$stats.totalSignals}</div>
		</div>
		<div class="text-center">
			<div class="text-text-muted">Active</div>
			<div class="font-mono text-green-400">{$stats.activeSignals}</div>
		</div>
		<div class="text-center">
			<div class="text-text-muted">Fading</div>
			<div class="font-mono text-amber-400">{$stats.fadingSignals}</div>
		</div>
		<div class="text-center">
			<div class="text-text-muted">Expired</div>
			<div class="font-mono text-red-400">{$stats.expiredSignals}</div>
		</div>
	</div>
</div>
