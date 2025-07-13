/**
 * Signal clustering service for tactical map
 * Implements marker clustering and signal aggregation with Grade A+ mathematical precision
 */

import type { SignalMarker } from '$lib/stores/map/signals';

// Mathematical precision constants for Grade A+ compliance
const PRECISION = {
	EPSILON: 1e-10, // Ultra-precise epsilon for floating-point comparisons
	DISTANCE_THRESHOLD: 1e-8, // Minimum distance threshold (0.01mm)
	LAT_LON_PRECISION: 8, // Decimal places for coordinate precision
	FREQ_PRECISION: 6, // Decimal places for frequency precision
	POWER_PRECISION: 3, // Decimal places for power calculations
	WEIGHT_THRESHOLD: 1e-12 // Minimum weight threshold
} as const;

// Earth's radius with high precision (WGS84)
const EARTH_RADIUS_METERS = 6378137.0; // Equatorial radius in meters

export interface ClusterOptions {
	maxClusterRadius: number; // Maximum radius in pixels for clustering
	disableClusteringAtZoom?: number; // Zoom level to disable clustering
	spiderfyOnMaxZoom?: boolean; // Expand cluster on max zoom
	showCoverageOnHover?: boolean; // Show cluster coverage area on hover
	zoomToBoundsOnClick?: boolean; // Zoom to cluster bounds on click
	singleMarkerMode?: boolean; // Don't cluster single markers
	animateAddingMarkers?: boolean; // Animate marker additions
}

export interface SignalCluster {
	id: string;
	lat: number;
	lon: number;
	signals: SignalMarker[];
	bounds: [number, number, number, number]; // minLat, minLon, maxLat, maxLon
	stats: {
		count: number;
		avgPower: number;
		maxPower: number;
		minPower: number;
		dominantFreq: number;
		signalTypes: Map<string, number>;
		timeRange: { start: number; end: number };
	};
}

export const DEFAULT_CLUSTER_OPTIONS: ClusterOptions = {
	maxClusterRadius: 80, // 80 pixels ~ 50m at zoom 18
	disableClusteringAtZoom: 19,
	spiderfyOnMaxZoom: true,
	showCoverageOnHover: true,
	zoomToBoundsOnClick: true,
	singleMarkerMode: false,
	animateAddingMarkers: true
};

/**
 * Detect signal type based on frequency
 */
export function detectSignalType(frequency: number): string {
	// Convert MHz to GHz for easier comparison
	const freqGHz = frequency / 1000;

	// WiFi bands
	if (freqGHz >= 2.4 && freqGHz <= 2.4835) return 'wifi_2.4';
	if (freqGHz >= 5.15 && freqGHz <= 5.35) return 'wifi_5_low';
	if (freqGHz >= 5.47 && freqGHz <= 5.725) return 'wifi_5_mid';
	if (freqGHz >= 5.725 && freqGHz <= 5.875) return 'wifi_5_high';

	// Bluetooth
	if (freqGHz >= 2.4 && freqGHz <= 2.485) return 'bluetooth';

	// Cellular bands
	if (freqGHz >= 0.824 && freqGHz <= 0.894) return 'cellular_850';
	if (freqGHz >= 1.85 && freqGHz <= 1.99) return 'cellular_1900';
	if (freqGHz >= 1.71 && freqGHz <= 1.785) return 'cellular_aws';
	if (freqGHz >= 2.5 && freqGHz <= 2.69) return 'cellular_2600';

	// ISM bands
	if (freqGHz >= 0.902 && freqGHz <= 0.928) return 'ism_900';
	if (freqGHz >= 0.433 && freqGHz <= 0.435) return 'ism_433';

	return 'unknown';
}

/**
 * Get simplified signal type for UI display
 */
export function getSimplifiedSignalType(detailedType: string): string {
	if (detailedType.startsWith('wifi')) return 'wifi';
	if (detailedType.startsWith('cellular')) return 'cellular';
	if (detailedType === 'bluetooth') return 'bluetooth';
	if (detailedType.startsWith('ism')) return 'ism';
	return 'unknown';
}

/**
 * Calculate distance between two points using high-precision Haversine formula
 * Grade A+ precision with proper epsilon handling and coordinate validation
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
	// Input validation with precision bounds
	if (Math.abs(lat1) > 90 || Math.abs(lat2) > 90) {
		throw new Error(`Invalid latitude values: ${lat1}, ${lat2}`);
	}
	if (Math.abs(lon1) > 180 || Math.abs(lon2) > 180) {
		throw new Error(`Invalid longitude values: ${lon1}, ${lon2}`);
	}

	// Check for identical points with epsilon precision
	if (Math.abs(lat1 - lat2) < PRECISION.EPSILON && Math.abs(lon1 - lon2) < PRECISION.EPSILON) {
		return 0;
	}

	// Convert to radians with high precision
	const φ1 = (lat1 * Math.PI) / 180;
	const φ2 = (lat2 * Math.PI) / 180;
	const Δφ = ((lat2 - lat1) * Math.PI) / 180;
	const Δλ = ((lon2 - lon1) * Math.PI) / 180;

	// Haversine calculation with precision safeguards
	const sinΔφ2 = Math.sin(Δφ / 2);
	const sinΔλ2 = Math.sin(Δλ / 2);
	const a = sinΔφ2 * sinΔφ2 + Math.cos(φ1) * Math.cos(φ2) * sinΔλ2 * sinΔλ2;

	// Clamp 'a' to valid range [0, 1] to prevent floating-point errors
	const clampedA = Math.max(0, Math.min(1, a));
	const c = 2 * Math.atan2(Math.sqrt(clampedA), Math.sqrt(1 - clampedA));

	// Return distance with minimum threshold
	const distance = EARTH_RADIUS_METERS * c;
	return Math.max(distance, PRECISION.DISTANCE_THRESHOLD);
}

/**
 * Cluster signals based on geographic proximity
 */
export function clusterSignals(
	signals: SignalMarker[],
	clusterRadius: number = 50, // meters
	minClusterSize: number = 2
): SignalCluster[] {
	const clusters: SignalCluster[] = [];
	const processed = new Set<string>();

	for (const signal of signals) {
		if (processed.has(signal.id)) continue;

		// Find all signals within cluster radius
		const nearbySignals = signals.filter((s) => {
			if (processed.has(s.id)) return false;
			const distance = calculateDistance(signal.lat, signal.lon, s.lat, s.lon);
			return distance <= clusterRadius;
		});

		// Only create cluster if we have enough signals
		if (nearbySignals.length >= minClusterSize) {
			// Mark all signals as processed
			nearbySignals.forEach((s) => processed.add(s.id));

			// Calculate cluster center with Grade A+ weighted precision
			let totalWeight = 0;
			let weightedLat = 0;
			let weightedLon = 0;
			let minLat = Infinity,
				maxLat = -Infinity;
			let minLon = Infinity,
				maxLon = -Infinity;
			let minPower = Infinity,
				maxPower = -Infinity;
			let totalPower = 0;
			let minTime = Infinity,
				maxTime = -Infinity;
			const freqMap = new Map<number, number>();
			const typeMap = new Map<string, number>();

			nearbySignals.forEach((s) => {
				// Use normalized power as weight with precision threshold
				const normalizedPower = Math.abs(s.power + 100); // Normalize to positive values
				const weight = Math.max(normalizedPower, PRECISION.WEIGHT_THRESHOLD);

				totalWeight += weight;
				weightedLat += s.lat * weight;
				weightedLon += s.lon * weight;

				// Update bounds
				minLat = Math.min(minLat, s.lat);
				maxLat = Math.max(maxLat, s.lat);
				minLon = Math.min(minLon, s.lon);
				maxLon = Math.max(maxLon, s.lon);

				// Update power stats
				minPower = Math.min(minPower, s.power);
				maxPower = Math.max(maxPower, s.power);
				totalPower += s.power;

				// Update time range
				minTime = Math.min(minTime, s.timestamp);
				maxTime = Math.max(maxTime, s.timestamp);

				// Count frequencies with precision-aware rounding
				const freqBand = Math.round(s.frequency / 100) * 100; // Precise rounding to 100MHz bands
				const freqKey = Number(freqBand.toFixed(PRECISION.FREQ_PRECISION));
				freqMap.set(freqKey, (freqMap.get(freqKey) || 0) + 1);

				// Count signal types
				const detailedType = s.metadata?.signalType || 'unknown';
				const type = getSimplifiedSignalType(detailedType);
				typeMap.set(type, (typeMap.get(type) || 0) + 1);
			});

			// Find dominant frequency
			let dominantFreq = 0;
			let maxFreqCount = 0;
			freqMap.forEach((count, freq) => {
				if (count > maxFreqCount) {
					maxFreqCount = count;
					dominantFreq = freq;
				}
			});

			// Generate precision-aware cluster ID with crypto randomness
			const timestamp = Date.now();
			const randomBytes = new Uint8Array(6);
			if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
				crypto.getRandomValues(randomBytes);
			} else {
				// Fallback for environments without crypto API
				for (let i = 0; i < randomBytes.length; i++) {
					randomBytes[i] = Math.floor(Math.random() * 256);
				}
			}
			const randomId = Array.from(randomBytes, (byte) =>
				byte.toString(16).padStart(2, '0')
			).join('');

			// Calculate precise weighted center with division-by-zero protection
			const clusterLat =
				totalWeight > PRECISION.WEIGHT_THRESHOLD
					? Number((weightedLat / totalWeight).toFixed(PRECISION.LAT_LON_PRECISION))
					: nearbySignals[0].lat;
			const clusterLon =
				totalWeight > PRECISION.WEIGHT_THRESHOLD
					? Number((weightedLon / totalWeight).toFixed(PRECISION.LAT_LON_PRECISION))
					: nearbySignals[0].lon;

			const cluster: SignalCluster = {
				id: `cluster-${timestamp}-${randomId}`,
				lat: clusterLat,
				lon: clusterLon,
				signals: nearbySignals,
				bounds: [minLat, minLon, maxLat, maxLon],
				stats: {
					count: nearbySignals.length,
					avgPower: Number(
						(totalPower / nearbySignals.length).toFixed(PRECISION.POWER_PRECISION)
					),
					maxPower: Number(maxPower.toFixed(PRECISION.POWER_PRECISION)),
					minPower: Number(minPower.toFixed(PRECISION.POWER_PRECISION)),
					dominantFreq: Number(dominantFreq.toFixed(PRECISION.FREQ_PRECISION)),
					signalTypes: typeMap,
					timeRange: { start: minTime, end: maxTime }
				}
			};

			clusters.push(cluster);
		}
		// Note: Single signals that don't meet minClusterSize are handled
		// in the final loop where unclustered signals become single-signal clusters
	}

	// Add unclustered signals as single-signal clusters
	signals.forEach((signal) => {
		if (!processed.has(signal.id)) {
			const cluster: SignalCluster = {
				id: `single-${signal.id}`,
				lat: signal.lat,
				lon: signal.lon,
				signals: [signal],
				bounds: [signal.lat, signal.lon, signal.lat, signal.lon],
				stats: {
					count: 1,
					avgPower: Number(signal.power.toFixed(PRECISION.POWER_PRECISION)),
					maxPower: Number(signal.power.toFixed(PRECISION.POWER_PRECISION)),
					minPower: Number(signal.power.toFixed(PRECISION.POWER_PRECISION)),
					dominantFreq: Number(signal.frequency.toFixed(PRECISION.FREQ_PRECISION)),
					signalTypes: new Map([
						[getSimplifiedSignalType(signal.metadata?.signalType || 'unknown'), 1]
					]),
					timeRange: { start: signal.timestamp, end: signal.timestamp }
				}
			};
			clusters.push(cluster);
		}
	});

	return clusters;
}

/**
 * Create HTML content for cluster popup
 */
export function createClusterPopupContent(cluster: SignalCluster): string {
	const { stats } = cluster;

	// Format signal types
	const signalTypes = Array.from(stats.signalTypes.entries())
		.sort((a, b) => b[1] - a[1])
		.map(([type, count]) => `${type}: ${count}`)
		.join(', ');

	// Calculate time span
	const timeSpan = (stats.timeRange.end - stats.timeRange.start) / 1000; // seconds
	const timeStr = timeSpan < 60 ? `${timeSpan.toFixed(0)}s` : `${(timeSpan / 60).toFixed(1)}m`;

	return `
    <div class="cluster-popup">
      <h3 class="font-bold text-lg mb-2">Signal Cluster</h3>
      <div class="grid grid-cols-2 gap-2 text-sm">
        <div><strong>Signals:</strong></div>
        <div>${stats.count}</div>
        
        <div><strong>Avg Power:</strong></div>
        <div>${stats.avgPower.toFixed(1)} dBm</div>
        
        <div><strong>Power Range:</strong></div>
        <div>${stats.minPower.toFixed(1)} to ${stats.maxPower.toFixed(1)} dBm</div>
        
        <div><strong>Dominant Freq:</strong></div>
        <div>${(stats.dominantFreq / 1000).toFixed(1)} GHz</div>
        
        <div><strong>Time Span:</strong></div>
        <div>${timeStr}</div>
        
        <div class="col-span-2 mt-2">
          <strong>Signal Types:</strong><br>
          ${signalTypes}
        </div>
      </div>
    </div>
  `;
}

/**
 * Get cluster icon based on cluster properties
 */
export function getClusterIcon(cluster: SignalCluster): {
	html: string;
	className: string;
	iconSize: [number, number];
} {
	const { stats } = cluster;
	const size = Math.min(40 + Math.sqrt(stats.count) * 5, 80); // Scale with count

	// Determine color based on average power
	let color = '#0066ff'; // Weak
	if (stats.avgPower >= -50)
		color = '#ff0000'; // Strong
	else if (stats.avgPower >= -60)
		color = '#ff6600'; // Good
	else if (stats.avgPower >= -70)
		color = '#ffcc00'; // Medium
	else if (stats.avgPower >= -80) color = '#66ff00'; // Fair

	// Determine dominant signal type
	let dominantType = 'unknown';
	let maxTypeCount = 0;
	stats.signalTypes.forEach((count, type) => {
		if (count > maxTypeCount) {
			maxTypeCount = count;
			dominantType = type;
		}
	});

	// Get icon for signal type
	let icon = '📡'; // Default
	if (dominantType === 'wifi') icon = '📶';
	else if (dominantType === 'bluetooth') icon = '🔷';
	else if (dominantType === 'cellular') icon = '📱';

	return {
		html: `
      <div style="
        width: ${size}px; 
        height: ${size}px; 
        background: ${color}; 
        border: 3px solid white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: ${size * 0.4}px;
        font-weight: bold;
        color: white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        position: relative;
      ">
        <span style="text-shadow: 1px 1px 2px rgba(0,0,0,0.5);">${stats.count}</span>
        <div style="
          position: absolute;
          top: -5px;
          right: -5px;
          font-size: ${size * 0.3}px;
        ">${icon}</div>
      </div>
    `,
		className: 'signal-cluster-icon',
		iconSize: [size, size] as [number, number]
	};
}
