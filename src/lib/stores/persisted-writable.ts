/**
 * Persisted writable store — wraps Svelte's writable with automatic localStorage sync.
 * Eliminates manual .subscribe() calls for persistence.
 */
import { type Writable, writable } from 'svelte/store';

import { browser } from '$app/environment';

interface PersistedWritableOptions<T> {
	/** Custom serializer (default: JSON.stringify) */
	serialize?: (value: T) => string;
	/** Custom deserializer (default: JSON.parse) */
	deserialize?: (raw: string) => T;
	/** Validate/transform the deserialized value; return null to use defaultValue */
	validate?: (value: T) => T | null;
}

/**
 * Creates a writable store that persists to localStorage.
 *
 * - Reads initial value from localStorage (falling back to defaultValue on parse error)
 * - Writes every change back to localStorage
 * - SSR-safe: returns defaultValue on server
 *
 * @param key - localStorage key
 * @param defaultValue - fallback when nothing is stored or parse fails
 * @param options - custom serialize/deserialize/validate
 */
export function persistedWritable<T>(
	key: string,
	defaultValue: T,
	options?: PersistedWritableOptions<T>
): Writable<T> {
	const serialize = options?.serialize ?? JSON.stringify;
	const deserialize = options?.deserialize ?? JSON.parse;
	const validate = options?.validate;

	function load(): T {
		if (!browser) return defaultValue;
		try {
			const raw = localStorage.getItem(key);
			if (raw === null) return defaultValue;
			const parsed = deserialize(raw) as T;
			if (validate) {
				const validated = validate(parsed);
				return validated !== null ? validated : defaultValue;
			}
			return parsed;
		} catch {
			// Corrupted data — use default
			return defaultValue;
		}
	}

	const store = writable<T>(load());

	if (browser) {
		store.subscribe((value) => {
			try {
				if (serialize(value) === 'null') {
					localStorage.removeItem(key);
				} else {
					localStorage.setItem(key, serialize(value));
				}
			} catch {
				// localStorage full or unavailable — silently ignore
			}
		});
	}

	return store;
}
