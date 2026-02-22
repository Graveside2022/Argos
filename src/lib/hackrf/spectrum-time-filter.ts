/** TimeWindowFilter: signal age management and time-based filtering. */
import { derived, get, type Readable, type Writable, writable } from 'svelte/store';

import type { SignalDetection } from '$lib/api/hackrf';

import type { TimedSignal, TimeWindowConfig, TimeWindowState, TimeWindowStats } from './spectrum';
import {
	buildExportState,
	computeTurnoverRate,
	generateSignalId,
	getSignalAgeDistribution,
	recalculateTimeWindowState
} from './spectrum-time-helpers';

export class TimeWindowFilter {
	private config: TimeWindowConfig = {
		windowDuration: 30,
		fadeStartPercent: 60,
		updateInterval: 100,
		maxSignalAge: 45
	};

	private state: Writable<TimeWindowState> = writable({
		signals: new Map(),
		activeCount: 0,
		expiringCount: 0,
		oldestSignal: Date.now(),
		newestSignal: Date.now(),
		windowStart: Date.now() - this.config.windowDuration * 1000,
		windowEnd: Date.now()
	});

	private updateTimer: ReturnType<typeof setTimeout> | null = null;
	private signalHistory: TimedSignal[] = [];
	private turnoverRate = 0;
	private lastTurnoverCheck = Date.now();

	public readonly signals: Readable<TimedSignal[]>;
	public readonly activeSignals: Readable<TimedSignal[]>;
	public readonly fadingSignals: Readable<TimedSignal[]>;
	public readonly stats: Readable<TimeWindowStats>;

	constructor() {
		this.signals = derived(this.state, ($state) =>
			Array.from($state.signals.values()).sort((a, b) => b.power - a.power)
		);

		this.activeSignals = derived(this.state, ($state) =>
			Array.from($state.signals.values())
				.filter((s) => s.opacity === 1 && !s.isExpiring)
				.sort((a, b) => b.power - a.power)
		);

		this.fadingSignals = derived(this.state, ($state) =>
			Array.from($state.signals.values())
				.filter((s) => s.isExpiring || s.opacity < 1)
				.sort((a, b) => b.age - a.age)
		);

		this.stats = derived(this.state, ($state) => {
			const signals = Array.from($state.signals.values());
			const totalAge = signals.reduce((sum, s) => sum + s.age, 0);
			return {
				totalSignals: signals.length,
				activeSignals: signals.filter((s) => !s.isExpiring).length,
				fadingSignals: signals.filter((s) => s.isExpiring).length,
				expiredSignals: this.signalHistory.length,
				averageAge: signals.length > 0 ? totalAge / signals.length : 0,
				signalTurnover: this.turnoverRate
			};
		});

		this.startUpdateTimer();
	}

	setConfig(config: Partial<TimeWindowConfig>): void {
		this.config = { ...this.config, ...config };
		if (config.updateInterval !== undefined) {
			this.stopUpdateTimer();
			this.startUpdateTimer();
		}
		this.state.update((s) => {
			const now = Date.now();
			s.windowEnd = now;
			s.windowStart = now - this.config.windowDuration * 1000;
			return s;
		});
	}

	addSignal(signal: SignalDetection): TimedSignal {
		const now = Date.now();
		const id = generateSignalId(signal);

		this.state.update((state) => {
			const existing = state.signals.get(id);
			const timedSignal: TimedSignal = existing
				? { ...existing, ...signal, lastSeen: now, age: (now - existing.firstSeen) / 1000 }
				: {
						...signal,
						id,
						firstSeen: now,
						lastSeen: now,
						age: 0,
						opacity: 1,
						relevance: 1,
						isExpiring: false,
						timeToLive: this.config.maxSignalAge
					};

			state.signals.set(id, timedSignal);
			state.newestSignal = now;
			if (!existing) {
				this.applyTurnoverRate(1);
			}
			return recalculateTimeWindowState(state);
		});

		const storedSignal = get(this.state).signals.get(id);
		if (!storedSignal) throw new Error(`Signal ${id} not found`);
		return storedSignal;
	}

	/** Batch add signals */
	addSignalBatch(signals: SignalDetection[]): void {
		this.state.update((state) => {
			const now = Date.now();
			let newCount = 0;

			for (const signal of signals) {
				const id = generateSignalId(signal);
				const existing = state.signals.get(id);
				const timedSignal: TimedSignal = existing
					? {
							...existing,
							...signal,
							lastSeen: now,
							age: (now - existing.firstSeen) / 1000
						}
					: {
							...signal,
							id,
							firstSeen: now,
							lastSeen: now,
							age: 0,
							opacity: 1,
							relevance: 1,
							isExpiring: false,
							timeToLive: this.config.maxSignalAge
						};
				state.signals.set(id, timedSignal);
				if (!existing) newCount++;
			}

			state.newestSignal = now;
			if (newCount > 0) this.applyTurnoverRate(newCount);
			return recalculateTimeWindowState(state);
		});
	}

	/** Get signals within a custom time range */
	getSignalsInRange(startTime: number, endTime: number): TimedSignal[] {
		const state = get(this.state);
		return Array.from(state.signals.values())
			.filter((s) => s.lastSeen >= startTime && s.lastSeen <= endTime)
			.sort((a, b) => b.lastSeen - a.lastSeen);
	}

	/** Get signal age distribution */
	getAgeDistribution(buckets: number = 10): { age: number; count: number }[] {
		return getSignalAgeDistribution(get(this.state), buckets);
	}

	/** Clear all signals */
	clear(): void {
		this.state.update((state) => {
			const expiredCount = state.signals.size;
			state.signals.forEach((signal) => this.signalHistory.push(signal));
			if (this.signalHistory.length > 1000) {
				this.signalHistory = this.signalHistory.slice(-500);
			}
			state.signals.clear();
			this.applyTurnoverRate(-expiredCount);
			return recalculateTimeWindowState(state);
		});
	}

	/** Clear signals older than specified age */
	clearOlderThan(ageSeconds: number): number {
		let removed = 0;
		this.state.update((state) => {
			const toRemove: string[] = [];
			state.signals.forEach((signal, id) => {
				if (signal.age > ageSeconds) {
					toRemove.push(id);
					this.signalHistory.push(signal);
				}
			});
			toRemove.forEach((id) => state.signals.delete(id));
			removed = toRemove.length;
			if (removed > 0) this.applyTurnoverRate(-removed);
			return recalculateTimeWindowState(state);
		});
		return removed;
	}

	/** Export current state for analysis */
	exportState() {
		return buildExportState(get(this.state), get(this.stats), this.config, this.turnoverRate);
	}

	/** Cleanup */
	destroy(): void {
		this.stopUpdateTimer();
		this.signalHistory = [];
	}

	// Private methods
	private startUpdateTimer(): void {
		this.updateTimer = setInterval(() => this.updateSignals(), this.config.updateInterval);
	}

	private stopUpdateTimer(): void {
		if (this.updateTimer) {
			clearInterval(this.updateTimer);
			this.updateTimer = null;
		}
	}

	private updateSignals(): void {
		this.state.update((state) => {
			const now = Date.now();
			const toRemove: string[] = [];

			state.signals.forEach((signal, id) => {
				signal.age = (now - signal.firstSeen) / 1000;
				signal.timeToLive = this.config.maxSignalAge - signal.age;
				const agePercent = (signal.age / this.config.windowDuration) * 100;

				if (signal.age > this.config.maxSignalAge) {
					toRemove.push(id);
					this.signalHistory.push(signal);
				} else if (agePercent >= this.config.fadeStartPercent) {
					signal.isExpiring = true;
					const fadePercent =
						(agePercent - this.config.fadeStartPercent) /
						(100 - this.config.fadeStartPercent);
					signal.opacity = Math.max(0.1, 1 - fadePercent);
					signal.relevance = signal.opacity;
				} else {
					signal.isExpiring = false;
					signal.opacity = 1;
					signal.relevance = 1;
				}
			});

			toRemove.forEach((id) => state.signals.delete(id));
			if (toRemove.length > 0) this.applyTurnoverRate(-toRemove.length);

			state.windowEnd = now;
			state.windowStart = now - this.config.windowDuration * 1000;
			return recalculateTimeWindowState(state);
		});
	}

	private applyTurnoverRate(change: number): void {
		const result = computeTurnoverRate(change, this.lastTurnoverCheck, this.turnoverRate);
		this.turnoverRate = result.rate;
		this.lastTurnoverCheck = result.timestamp;
	}
}
