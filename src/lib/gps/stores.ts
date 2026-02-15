/**
 * GPS Stores
 * Reactive state management for GPS data
 *
 * Note: GPS state is currently managed server-side via circuit breaker pattern.
 * Client-side stores may be added in future for real-time position tracking.
 */

import { writable } from 'svelte/store';

import type { GPSPosition } from './types';

export const gpsPosition = writable<GPSPosition | null>(null);
export const gpsError = writable<string | null>(null);
