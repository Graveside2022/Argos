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
/** Apply optional validation, returning defaultValue on null. */
function applyValidation<T>(
	parsed: T,
	validate: ((v: T) => T | null) | undefined,
	defaultValue: T
): T {
	if (!validate) return parsed;
	const validated = validate(parsed);
	return validated !== null ? validated : defaultValue;
}

/** Load a value from localStorage with deserialization and validation. */
function loadFromStorage<T>(
	key: string,
	defaultValue: T,
	deserialize: (raw: string) => T,
	validate?: (v: T) => T | null
): T {
	if (!browser) return defaultValue;
	try {
		const raw = localStorage.getItem(key);
		if (raw === null) return defaultValue;
		return applyValidation(deserialize(raw) as T, validate, defaultValue);
	} catch {
		return defaultValue;
	}
}

/** Persist a serialized value to localStorage. */
function saveToStorage<T>(key: string, value: T, serialize: (v: T) => string): void {
	try {
		const serialized = serialize(value);
		if (serialized === 'null') localStorage.removeItem(key);
		else localStorage.setItem(key, serialized);
	} catch {
		// localStorage full or unavailable — silently ignore
	}
}

/** Resolve serializer from options, defaulting to JSON.stringify. */
function resolveSerializer<T>(options?: PersistedWritableOptions<T>): (value: T) => string {
	return options?.serialize ?? JSON.stringify;
}

/** Resolve deserializer from options, defaulting to JSON.parse. */
function resolveDeserializer<T>(options?: PersistedWritableOptions<T>): (raw: string) => T {
	return options?.deserialize ?? JSON.parse;
}

export function persistedWritable<T>(
	key: string,
	defaultValue: T,
	options?: PersistedWritableOptions<T>
): Writable<T> {
	const serialize = resolveSerializer(options);
	const deserialize = resolveDeserializer(options);
	const store = writable<T>(loadFromStorage(key, defaultValue, deserialize, options?.validate));
	if (browser) store.subscribe((value) => saveToStorage(key, value, serialize));
	return store;
}
