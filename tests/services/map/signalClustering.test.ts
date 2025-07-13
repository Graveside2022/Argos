import { describe, it, expect } from 'vitest';
import {
	clusterSignals,
	createClusterPopupContent,
	getClusterIcon
} from '$lib/services/map/signalClustering';
import type { SignalMarker } from '$lib/stores/map/signals';
import { SignalSource } from '$lib/types/enums';

describe('signalClustering', () => {
	const createMockSignal = (
		id: string,
		lat: number,
		lon: number,
		power: number = -70,
		frequency: number = 2400
	): SignalMarker => ({
		id,
		lat,
		lon,
		power,
		frequency,
		timestamp: Date.now(),
		source: SignalSource.HackRF,
		metadata: { signalType: 'wifi' }
	});

	describe('clusterSignals', () => {
		it('should cluster signals within radius', () => {
			const signals: SignalMarker[] = [
				createMockSignal('1', 40.7128, -74.006, -60),
				createMockSignal('2', 40.7129, -74.0061, -65), // ~15m away
				createMockSignal('3', 40.713, -74.0062, -70), // ~30m away
				createMockSignal('4', 40.72, -74.01, -55) // ~8km away
			];

			const clusters = clusterSignals(signals, 50); // 50m radius

			expect(clusters).toHaveLength(2);

			// First cluster should have 3 signals
			const mainCluster = clusters.find((c) => c.stats.count === 3);
			expect(mainCluster).toBeDefined();
			if (mainCluster) {
				expect(mainCluster.stats.avgPower).toBeCloseTo(-65, 1);
				expect(mainCluster.stats.minPower).toBe(-70);
				expect(mainCluster.stats.maxPower).toBe(-60);
			}

			// Second cluster should have 1 signal
			const singleCluster = clusters.find((c) => c.stats.count === 1);
			expect(singleCluster).toBeDefined();
			if (singleCluster) {
				expect(singleCluster.stats.avgPower).toBe(-55);
			}
		});

		it('should not cluster if below minimum cluster size', () => {
			const signals: SignalMarker[] = [
				createMockSignal('1', 40.7128, -74.006),
				createMockSignal('2', 40.72, -74.01) // Far away
			];

			const clusters = clusterSignals(signals, 50, 3); // Min size 3

			expect(clusters).toHaveLength(2);
			expect(clusters.every((c) => c.stats.count === 1)).toBe(true);
		});

		it('should calculate weighted center position', () => {
			const signals: SignalMarker[] = [
				createMockSignal('1', 40.7128, -74.006, -50), // Strong signal
				createMockSignal('2', 40.7129, -74.0061, -90) // Weak signal
			];

			const clusters = clusterSignals(signals, 100);
			const cluster = clusters[0];

			// Center should be weighted towards stronger signal
			expect(cluster).toBeDefined();
			if (cluster) {
				expect(cluster.lat).toBeCloseTo(40.7128, 4);
				expect(cluster.lon).toBeCloseTo(-74.006, 4);
			}
		});

		it('should track signal types and frequencies', () => {
			const signals: SignalMarker[] = [
				createMockSignal('1', 40.7128, -74.006, -60, 2412),
				createMockSignal('2', 40.7128, -74.006, -65, 2437),
				createMockSignal('3', 40.7128, -74.006, -70, 5180)
			];
			signals[2].metadata = { signalType: 'bluetooth' };

			const clusters = clusterSignals(signals, 100);
			const cluster = clusters[0];

			expect(cluster.stats.signalTypes.get('wifi')).toBe(2);
			expect(cluster.stats.signalTypes.get('bluetooth')).toBe(1);
			expect(cluster.stats.dominantFreq).toBe(2400); // 2.4GHz band
		});
	});

	describe('createClusterPopupContent', () => {
		it('should generate proper HTML content', () => {
			const cluster = {
				id: 'test-cluster',
				lat: 40.7128,
				lon: -74.006,
				position: { lat: 40.7128, lon: -74.006 },
				signals: [],
				bounds: [40.7128, -74.006, 40.7129, -74.0061] as [number, number, number, number],
				stats: {
					count: 5,
					avgPower: -65,
					maxPower: -50,
					minPower: -80,
					dominantFreq: 2400,
					signalTypes: new Map([
						['wifi', 3],
						['bluetooth', 2]
					]),
					timeRange: { start: Date.now() - 30000, end: Date.now() }
				}
			};

			const html = createClusterPopupContent(cluster);

			expect(html).toContain('Signal Cluster');
			expect(html).toContain('Signals:</strong></div>');
			expect(html).toContain('<div>5</div>');
			expect(html).toContain('-65.0 dBm');
			expect(html).toContain('2.4 GHz');
			expect(html).toContain('wifi: 3, bluetooth: 2');
			expect(html).toContain('30s');
		});
	});

	describe('getClusterIcon', () => {
		it('should return appropriate icon based on signal strength', () => {
			const strongCluster = {
				id: 'strong',
				lat: 0,
				lon: 0,
				position: { lat: 0, lon: 0 },
				signals: [],
				bounds: [0, 0, 0, 0] as [number, number, number, number],
				stats: {
					count: 10,
					avgPower: -45,
					maxPower: -40,
					minPower: -50,
					dominantFreq: 2400,
					signalTypes: new Map([['wifi', 10]]),
					timeRange: { start: 0, end: 0 }
				}
			};

			const icon = getClusterIcon(strongCluster);

			expect(icon.html).toContain('#ff0000'); // Red for strong
			expect(icon.html).toContain('10'); // Count
			expect(icon.html).toContain('📶'); // WiFi icon
			expect(icon.iconSize[0]).toBeGreaterThan(40);
		});

		it('should scale icon size with signal count', () => {
			const smallCluster = {
				id: 'small',
				lat: 0,
				lon: 0,
				position: { lat: 0, lon: 0 },
				signals: [],
				bounds: [0, 0, 0, 0] as [number, number, number, number],
				stats: {
					count: 2,
					avgPower: -70,
					maxPower: -65,
					minPower: -75,
					dominantFreq: 2400,
					signalTypes: new Map([['unknown', 2]]),
					timeRange: { start: 0, end: 0 }
				}
			};

			const largeCluster = { ...smallCluster, stats: { ...smallCluster.stats, count: 100 } };

			const smallIcon = getClusterIcon(smallCluster);
			const largeIcon = getClusterIcon(largeCluster);

			expect(largeIcon.iconSize[0]).toBeGreaterThan(smallIcon.iconSize[0]);
			expect(largeIcon.iconSize[0]).toBeLessThanOrEqual(80); // Max size
		});
	});
});
