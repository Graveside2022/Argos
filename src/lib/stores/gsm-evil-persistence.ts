/**
 * GSM Evil Store — Persistence Helpers
 * localStorage load/save with debounced writes and error handling.
 */

import { browser } from '$app/environment';
import { logger } from '$lib/utils/logger';

import type { GSMEvilState, StoreSet, StoreUpdate } from './gsm-evil-types';
import {
	DEBOUNCE_MS,
	defaultState,
	STORAGE_KEY,
	STORAGE_VERSION,
	TRANSIENT_KEYS
} from './gsm-evil-types';

export function loadFromStorage(set: StoreSet): void {
	try {
		const saved = localStorage.getItem(STORAGE_KEY);
		if (saved) {
			const parsedState = JSON.parse(saved) as Partial<GSMEvilState>;

			if (parsedState.storageVersion !== STORAGE_VERSION) {
				logger.warn('GSM Evil state version mismatch, resetting to default');
				localStorage.removeItem(STORAGE_KEY);
				return;
			}

			// CRITICAL: scanAbortController cannot survive JSON serialization
			const mergedState = { ...defaultState, ...parsedState, scanAbortController: null };
			set(mergedState);
		}
	} catch (error) {
		logger.error('Failed to load GSM Evil state from localStorage', { error });
		localStorage.removeItem(STORAGE_KEY);
	}
}

/** Build a saveable state object with transient keys removed. */
export function buildSaveableState(state: GSMEvilState): string {
	const stateToSave: Record<string, unknown> = {
		...state,
		lastScanTime: new Date().toISOString(),
		storageVersion: STORAGE_VERSION
	};
	for (const key of TRANSIENT_KEYS) delete stateToSave[key];
	return JSON.stringify(stateToSave);
}

/** Handle localStorage write errors. */
export function handlePersistError(error: unknown): void {
	if (error instanceof DOMException && error.name === 'QuotaExceededError') {
		logger.warn('localStorage quota exceeded, clearing old data');
		localStorage.removeItem(STORAGE_KEY);
	} else {
		logger.error('Failed to persist GSM Evil state to localStorage', { error });
	}
}

export function persistState(state: GSMEvilState): void {
	if (!browser) return;
	try {
		localStorage.setItem(STORAGE_KEY, buildSaveableState(state));
	} catch (error) {
		handlePersistError(error);
	}
}

/** Debounce timer for persistence — 2s trailing edge */
export let debounceTimer: ReturnType<typeof setTimeout> | null = null;

export function schedulePersist(state: GSMEvilState): void {
	if (debounceTimer) clearTimeout(debounceTimer);
	debounceTimer = setTimeout(() => {
		debounceTimer = null;
		persistState(state);
	}, DEBOUNCE_MS);
}

/** Update store and schedule debounced persistence */
export function updateAndPersist(
	update: StoreUpdate,
	updater: (state: GSMEvilState) => GSMEvilState
): void {
	update((state) => {
		const newState = updater(state);
		schedulePersist(newState);
		return newState;
	});
}

/** Update store without triggering persistence (for transient state) */
export function updateOnly(
	update: StoreUpdate,
	updater: (state: GSMEvilState) => GSMEvilState
): void {
	update((state) => updater(state));
}
