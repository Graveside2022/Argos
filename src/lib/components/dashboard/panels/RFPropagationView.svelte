<!-- RF Propagation view — orchestrates status, controls, colormap, compute, and overlay sections -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';

	import { layerVisibility } from '$lib/stores/dashboard/dashboard-store';
	import { addOverlay } from '$lib/stores/dashboard/rf-overlay-store';
	import {
		completeCompute,
		computeError,
		computeState,
		failCompute,
		isComputing,
		resetCompute,
		rfParams,
		startCompute,
		updateRFParam
	} from '$lib/stores/dashboard/rf-propagation-store';
	import { gpsStore } from '$lib/stores/tactical-map/gps-store';
	import type { CloudRFColormapName } from '$lib/types/rf-propagation';
	import { logger } from '$lib/utils/logger';

	import CloudRFColormapSelector from './rf-propagation/CloudRFColormapSelector.svelte';
	import OverlayControls from './rf-propagation/OverlayControls.svelte';
	import RFPropagationControls from './rf-propagation/RFPropagationControls.svelte';
	import RFPropagationStatus from './rf-propagation/RFPropagationStatus.svelte';

	/** Client-side timeout for compute requests (2 minutes — CloudRF is faster than local) */
	const COMPUTE_TIMEOUT_MS = 2 * 60 * 1000;

	/** Active abort controller — allows cancelling a pending fetch on unmount */
	let abortController: AbortController | null = null;

	/** Elapsed seconds counter — provides live feedback during compute */
	let elapsedSeconds = $state(0);
	let elapsedInterval: ReturnType<typeof setInterval> | null = null;

	function startElapsedTimer() {
		elapsedSeconds = 0;
		elapsedInterval = setInterval(() => {
			elapsedSeconds += 1;
		}, 1000);
	}

	function stopElapsedTimer() {
		if (elapsedInterval) {
			clearInterval(elapsedInterval);
			elapsedInterval = null;
		}
	}

	interface ComputeResponse {
		success: boolean;
		imageDataUri: string;
		bounds: { north: number; south: number; east: number; west: number };
		error?: string;
	}

	onMount(() => {
		// Reset stale "computing" state on mount (fixes HMR store desync)
		if (get(computeState) === 'computing') {
			logger.warn('RF compute state was stuck in "computing" — resetting to idle');
			resetCompute();
		}

		return () => {
			// Abort any pending fetch on unmount
			abortController?.abort();
			stopElapsedTimer();
		};
	});

	/** Fetch the compute endpoint and return parsed response; throws on error */
	async function fetchCompute(signal: AbortSignal): Promise<ComputeResponse> {
		const params = get(rfParams);
		const { position } = get(gpsStore);

		const res = await fetch('/api/rf-propagation/compute', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			signal,
			body: JSON.stringify({
				lat: position.lat,
				lon: position.lon,
				frequency: params.frequency,
				polarization: params.polarization,
				txHeight: params.txHeight,
				rxHeight: params.rxHeight,
				radius: params.radius,
				resolution: params.resolution,
				colormap: params.colormap
			})
		});

		if (!res.ok) {
			const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
			throw new Error(body.error ?? `Server error ${res.status}`);
		}

		const data: ComputeResponse = await res.json();
		if (!data.success) throw new Error(data.error ?? 'Computation failed');
		return data;
	}

	/** Apply a successful compute result to stores */
	function applyComputeResult(data: ComputeResponse): void {
		addOverlay({
			imageDataUri: data.imageDataUri,
			bounds: data.bounds,
			opacity: 0.7,
			visible: true,
			label: 'Coverage'
		});
		// Auto-enable the RF layer so the overlay is visible on the map
		layerVisibility.update((v) => ({ ...v, rfPropagation: true }));
		completeCompute();
	}

	/** Handle compute errors — distinguish abort from other failures */
	function handleComputeError(err: unknown): void {
		if (err instanceof DOMException && err.name === 'AbortError') {
			failCompute('Computation timed out or was cancelled');
			return;
		}
		const message = err instanceof Error ? err.message : 'Unknown error';
		logger.error(`RF compute failed: ${message}`);
		failCompute(message);
	}

	async function handleCompute(): Promise<void> {
		startCompute('Computing coverage...');
		startElapsedTimer();

		abortController = new AbortController();
		const timeoutId = setTimeout(() => abortController?.abort(), COMPUTE_TIMEOUT_MS);

		try {
			const data = await fetchCompute(abortController.signal);
			applyComputeResult(data);
		} catch (err: unknown) {
			handleComputeError(err);
		} finally {
			clearTimeout(timeoutId);
			abortController = null;
			stopElapsedTimer();
		}
	}
</script>

<div class="rf-propagation-view">
	<RFPropagationStatus />

	<RFPropagationControls />

	<section class="panel-section">
		<CloudRFColormapSelector
			value={$rfParams.colormap}
			onchange={(name) => updateRFParam('colormap', name as CloudRFColormapName)}
		/>
	</section>

	<section class="compute-section">
		<button
			class="compute-btn"
			disabled={$isComputing}
			class:computing={$isComputing}
			onclick={handleCompute}
		>
			{$isComputing ? 'COMPUTING...' : 'COMPUTE COVERAGE'}
		</button>
		{#if $isComputing}
			<div class="compute-elapsed">{elapsedSeconds}s elapsed</div>
			<div class="compute-hint">CloudRF cloud — typically &lt;10s</div>
		{:else if $computeError}
			<div class="compute-error">{$computeError}</div>
		{:else}
			<div class="compute-hint">
				{$rfParams.radius}km @ {$rfParams.resolution}m resolution
			</div>
		{/if}
	</section>

	<OverlayControls />
</div>

<style>
	.rf-propagation-view {
		display: flex;
		flex-direction: column;
		overflow-y: auto;
		height: 100%;
	}

	.panel-section {
		padding: 10px 14px;
		border-bottom: 1px solid var(--border);
	}

	.compute-section {
		padding: 10px 14px;
		border-bottom: 1px solid var(--border);
	}

	.compute-btn {
		width: 100%;
		height: 32px;
		background: var(--primary);
		color: var(--primary-foreground, #ffffff);
		border: none;
		border-radius: 4px;
		font-family: var(--font-mono, 'Fira Code', monospace);
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.8px;
		cursor: pointer;
		transition:
			opacity 0.15s,
			filter 0.15s;
	}

	.compute-btn:hover:not(:disabled) {
		filter: brightness(1.1);
	}

	.compute-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.compute-btn.computing {
		animation: pulse 1.2s ease-in-out infinite;
	}

	.compute-elapsed {
		margin-top: 6px;
		font-family: var(--font-mono, 'Fira Code', monospace);
		font-size: 13px;
		font-weight: 600;
		color: var(--primary);
		text-align: center;
		letter-spacing: 1px;
	}

	.compute-hint {
		margin-top: 4px;
		font-family: var(--font-mono, 'Fira Code', monospace);
		font-size: 9px;
		color: var(--foreground-secondary, #888888);
		text-align: center;
		letter-spacing: 0.5px;
	}

	.compute-error {
		margin-top: 8px;
		padding: 6px 10px;
		background: color-mix(in srgb, var(--error, #ff5c33) 15%, transparent);
		border: 1px solid color-mix(in srgb, var(--error, #ff5c33) 40%, transparent);
		border-radius: 4px;
		color: var(--error, #ff5c33);
		font-family: var(--font-mono, 'Fira Code', monospace);
		font-size: 10px;
		line-height: 1.4;
		word-break: break-word;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 0.5;
		}
		50% {
			opacity: 0.8;
		}
	}
</style>
