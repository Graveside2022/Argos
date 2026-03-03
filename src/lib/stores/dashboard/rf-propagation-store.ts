/**
 * RF Propagation parameter store — persisted user settings for CloudRF computations.
 *
 * Stores the user's preferred frequency, antenna heights, polarization,
 * colormap, radius, resolution, and computation mode. Persists to localStorage.
 *
 * @module
 */

import { derived, writable } from 'svelte/store';

import { persistedWritable } from '$lib/stores/persisted-writable';
import type { CloudRFColormapName, PropagationMode } from '$lib/types/rf-propagation';

// ── Persisted parameters ────────────────────────────────────────────

export interface RFPropagationParams {
	mode: PropagationMode;
	frequency: number;
	polarization: number;
	txHeight: number;
	rxHeight: number;
	radius: number;
	resolution: number;
	colormap: CloudRFColormapName;
}

const DEFAULT_PARAMS: RFPropagationParams = {
	mode: 'coverage',
	frequency: 500,
	polarization: 1,
	txHeight: 5,
	rxHeight: 2,
	radius: 5,
	resolution: 10,
	colormap: 'RAINBOW45.dBm'
};

export const rfParams = persistedWritable<RFPropagationParams>(
	'rfPropagationParams',
	DEFAULT_PARAMS
);

/** Update a single parameter */
export function updateRFParam<K extends keyof RFPropagationParams>(
	key: K,
	value: RFPropagationParams[K]
): void {
	rfParams.update((p) => ({ ...p, [key]: value }));
}

// ── Computation state ───────────────────────────────────────────────

export type ComputeState = 'idle' | 'computing' | 'error' | 'done';

export const computeState = writable<ComputeState>('idle');
export const computeError = writable<string | null>(null);
export const computeProgress = writable<string>('');

export const isComputing = derived(computeState, ($s) => $s === 'computing');

/** Mark computation as in-progress */
export function startCompute(message: string): void {
	computeState.set('computing');
	computeError.set(null);
	computeProgress.set(message);
}

/** Mark computation as completed */
export function completeCompute(): void {
	computeState.set('done');
	computeProgress.set('');
}

/** Mark computation as failed */
export function failCompute(error: string): void {
	computeState.set('error');
	computeError.set(error);
	computeProgress.set('');
}

/** Reset to idle state */
export function resetCompute(): void {
	computeState.set('idle');
	computeError.set(null);
	computeProgress.set('');
}
