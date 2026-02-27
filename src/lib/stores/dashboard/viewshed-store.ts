/**
 * Persisted viewshed overlay configuration store.
 *
 * Holds ONLY viewshed-specific fields (height, radius, opacity, adjustTogether).
 * Preset and frequency stay in rfRangeStore — no duplication.
 * State persists to localStorage via persistedWritable.
 */
import { writable } from 'svelte/store';
import { z } from 'zod';

import {
	type HeightAglMode,
	VIEWSHED_DEFAULTS,
	VIEWSHED_LIMITS,
	type ViewshedStoreState
} from '$lib/types/viewshed';

import { persistedWritable } from '../persisted-writable';

/** Transient computing state — NOT persisted. Written by viewshed-derived, read by panels. */
export const viewshedComputing = writable(false);

/** Transient computed AGL — NOT persisted. Written by viewshed-derived when in auto mode. */
export const viewshedComputedAgl = writable<number | null>(null);

// ── Zod schema for localStorage validation ───────────────────────────

const ViewshedStoreSchema = z.object({
	isEnabled: z.boolean(),
	heightAglM: z
		.number()
		.min(VIEWSHED_LIMITS.HEIGHT_AGL_MIN_M)
		.max(VIEWSHED_LIMITS.HEIGHT_AGL_MAX_M),
	heightAglMode: z.enum(['auto', 'custom']).default('auto'),
	radiusM: z.number().min(VIEWSHED_LIMITS.RADIUS_MIN_M).max(VIEWSHED_LIMITS.RADIUS_MAX_M),
	greenOpacity: z.number().min(VIEWSHED_LIMITS.OPACITY_MIN).max(VIEWSHED_LIMITS.OPACITY_MAX),
	redOpacity: z.number().min(VIEWSHED_LIMITS.OPACITY_MIN).max(VIEWSHED_LIMITS.OPACITY_MAX),
	adjustTogether: z.boolean()
});

// ── Store ────────────────────────────────────────────────────────────

export const viewshedStore = persistedWritable<ViewshedStoreState>(
	'argos-viewshed-settings',
	{ ...VIEWSHED_DEFAULTS },
	{
		validate: (value) => {
			const result = ViewshedStoreSchema.safeParse(value);
			return result.success ? result.data : null;
		}
	}
);

// ── Convenience setters with clamping ────────────────────────────────

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

export function setViewshedEnabled(enabled: boolean): void {
	viewshedStore.update((s) => ({ ...s, isEnabled: enabled }));
}

export function setHeightAgl(meters: number): void {
	const clamped = clamp(
		meters,
		VIEWSHED_LIMITS.HEIGHT_AGL_MIN_M,
		VIEWSHED_LIMITS.HEIGHT_AGL_MAX_M
	);
	viewshedStore.update((s) => ({ ...s, heightAglM: clamped }));
}

export function setViewshedRadius(meters: number): void {
	const clamped = clamp(meters, VIEWSHED_LIMITS.RADIUS_MIN_M, VIEWSHED_LIMITS.RADIUS_MAX_M);
	viewshedStore.update((s) => ({ ...s, radiusM: clamped }));
}

export function setGreenOpacity(value: number): void {
	const clamped = clamp(value, VIEWSHED_LIMITS.OPACITY_MIN, VIEWSHED_LIMITS.OPACITY_MAX);
	viewshedStore.update((s) => {
		if (!s.adjustTogether) return { ...s, greenOpacity: clamped };
		const ratio = s.greenOpacity > 0 ? clamped / s.greenOpacity : 1;
		const linkedRed = clamp(
			s.redOpacity * ratio,
			VIEWSHED_LIMITS.OPACITY_MIN,
			VIEWSHED_LIMITS.OPACITY_MAX
		);
		return { ...s, greenOpacity: clamped, redOpacity: linkedRed };
	});
}

export function setRedOpacity(value: number): void {
	const clamped = clamp(value, VIEWSHED_LIMITS.OPACITY_MIN, VIEWSHED_LIMITS.OPACITY_MAX);
	viewshedStore.update((s) => {
		if (!s.adjustTogether) return { ...s, redOpacity: clamped };
		const ratio = s.redOpacity > 0 ? clamped / s.redOpacity : 1;
		const linkedGreen = clamp(
			s.greenOpacity * ratio,
			VIEWSHED_LIMITS.OPACITY_MIN,
			VIEWSHED_LIMITS.OPACITY_MAX
		);
		return { ...s, redOpacity: clamped, greenOpacity: linkedGreen };
	});
}

export function setAdjustTogether(linked: boolean): void {
	viewshedStore.update((s) => ({ ...s, adjustTogether: linked }));
}

export function setHeightAglMode(mode: HeightAglMode): void {
	viewshedStore.update((s) => ({ ...s, heightAglMode: mode }));
}
