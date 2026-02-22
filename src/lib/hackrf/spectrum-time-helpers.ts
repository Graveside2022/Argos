/**
 * Utility functions for time-window signal processing.
 * Extracted from TimeWindowFilter class for constitutional compliance.
 */

import type { SignalDetection } from '$lib/api/hackrf';

import type { TimedSignal, TimeWindowConfig, TimeWindowState, TimeWindowStats } from './spectrum';

/** Recalculate derived counts and bounds from the signals map. */
export function recalculateTimeWindowState(state: TimeWindowState): TimeWindowState {
	const signals = Array.from(state.signals.values());
	state.activeCount = signals.filter((s: TimedSignal) => !s.isExpiring).length;
	state.expiringCount = signals.filter((s: TimedSignal) => s.isExpiring).length;
	if (signals.length > 0) {
		state.oldestSignal = Math.min(...signals.map((s: TimedSignal) => s.firstSeen));
		state.newestSignal = Math.max(...signals.map((s: TimedSignal) => s.lastSeen));
	}
	return state;
}

/** Generate a deterministic signal ID from frequency/power/time bins. */
export function generateSignalId(signal: SignalDetection): string {
	const freqBin = Math.floor(signal.frequency / 1e6);
	const powerBin = Math.floor(signal.power / 5) * 5;
	return `${freqBin}_${powerBin}_${signal.timestamp}`;
}

/** Compute signal age distribution across time buckets. */
export function getSignalAgeDistribution(
	state: TimeWindowState,
	buckets: number = 10
): { age: number; count: number }[] {
	const signals = Array.from(state.signals.values());
	if (signals.length === 0) return [];
	const maxAge = Math.max(...signals.map((s) => s.age));
	const bucketSize = maxAge / buckets;
	const distribution = new Array<number>(buckets).fill(0);
	signals.forEach((signal) => {
		const bucketIndex = Math.min(Math.floor(signal.age / bucketSize), buckets - 1);
		distribution[bucketIndex]++;
	});
	return distribution.map((count, i) => ({ age: (i + 0.5) * bucketSize, count }));
}

/** Build export state snapshot for analysis. */
export function buildExportState(
	state: TimeWindowState,
	stats: TimeWindowStats,
	config: TimeWindowConfig,
	turnoverRate: number
) {
	const signals = Array.from(state.signals.values());
	return {
		timestamp: Date.now(),
		config,
		stats,
		signals: signals.map((s) => ({
			id: s.id,
			frequency: s.frequency,
			power: s.power,
			age: s.age,
			opacity: s.opacity,
			relevance: s.relevance,
			firstSeen: s.firstSeen,
			lastSeen: s.lastSeen
		})),
		ageDistribution: getSignalAgeDistribution(state),
		turnoverRate
	};
}

/** Exponential moving average for signal turnover rate tracking. */
export function computeTurnoverRate(
	change: number,
	lastCheck: number,
	currentRate: number
): { rate: number; timestamp: number } {
	const now = Date.now();
	const timeDiff = (now - lastCheck) / 1000;
	if (timeDiff > 0) {
		const instantRate = Math.abs(change) / timeDiff;
		return { rate: currentRate * 0.9 + instantRate * 0.1, timestamp: now };
	}
	return { rate: currentRate, timestamp: lastCheck };
}
