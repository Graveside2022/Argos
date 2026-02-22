/**
 * Time-based Signal Filtering Service
 * Manages sliding time windows for signal relevance in drone operations
 */

import type { SignalDetection } from '$lib/api/hackrf';
import { resolveThemeColor } from '$lib/utils/theme-colors';

import { TimeWindowFilter } from './spectrum-time-filter';

export interface TimeWindowConfig {
	windowDuration: number; // Duration in seconds
	fadeStartPercent: number; // When to start fading (0-100)
	updateInterval: number; // How often to update in ms
	maxSignalAge: number; // Maximum age before removal in seconds
}

export interface TimedSignal extends SignalDetection {
	id: string;
	firstSeen: number;
	lastSeen: number;
	age: number; // Age in seconds
	opacity: number; // 0-1 for fade effect
	relevance: number; // 0-1 relevance score
	isExpiring: boolean;
	timeToLive: number; // Seconds until removal
}

export interface TimeWindowState {
	signals: Map<string, TimedSignal>;
	activeCount: number;
	expiringCount: number;
	oldestSignal: number;
	newestSignal: number;
	windowStart: number;
	windowEnd: number;
}

export interface TimeWindowStats {
	totalSignals: number;
	activeSignals: number;
	fadingSignals: number;
	expiredSignals: number;
	averageAge: number;
	signalTurnover: number; // Signals per second
}

// Re-export the class for consumers that import from this module
export { TimeWindowFilter } from './spectrum-time-filter';

// Export singleton instance
export const timeWindowFilter = new TimeWindowFilter();

// Helper functions for UI
export function formatAge(seconds: number): string {
	if (seconds < 1) return 'now';
	if (seconds < 60) return `${Math.floor(seconds)}s`;
	return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
}

export function getAgeColor(agePercent: number): string {
	if (agePercent < 30) return resolveThemeColor('--success', '#10b981');
	if (agePercent < 60) return resolveThemeColor('--warning', '#f59e0b');
	if (agePercent < 80) return resolveThemeColor('--destructive', '#ef4444');
	return resolveThemeColor('--muted-foreground', '#6b7280');
}

export function getRelevanceIcon(relevance: number): string {
	if (relevance > 0.8) return '\u25CF'; // Full circle
	if (relevance > 0.6) return '\u25D0'; // Three-quarters
	if (relevance > 0.4) return '\u25D1'; // Half
	if (relevance > 0.2) return '\u25D2'; // Quarter
	return '\u25CB'; // Empty circle
}
