/**
 * Flight path analyzer for drone signal intelligence
 * Provides 3D visualization and signal correlation analysis
 */

import type { FlightPoint, SignalCapture, AreaOfInterest } from '$lib/stores/drone';

export interface FlightAnalysis {
	coverageMap: CoverageCell[];
	signalHotspots: SignalHotspot[];
	flightEfficiency: FlightEfficiency;
	recommendations: string[];
	anomalies: FlightAnomaly[];
}

export interface CoverageCell {
	bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number };
	center: { lat: number; lon: number };
	altitudes: number[];
	signalCount: number;
	averagePower: number;
	coverageQuality: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface SignalHotspot {
	position: { lat: number; lon: number; altitude: number };
	radius: number;
	intensity: number; // 0-1
	dominantFrequency: number;
	deviceCount: number;
	recommendedAltitude: number;
}

export interface FlightEfficiency {
	coverageRatio: number; // area covered vs total area
	signalDetectionRate: number; // signals/minute
	optimalAltitude: number;
	redundantPathPercentage: number;
	energyEfficiency: number; // distance/battery%
}

export interface FlightAnomaly {
	timestamp: number;
	position: { lat: number; lon: number; altitude: number };
	type: 'signal_spike' | 'coverage_gap' | 'altitude_deviation' | 'speed_anomaly';
	severity: 'low' | 'medium' | 'high';
	description: string;
}

export class FlightPathAnalyzer {
	private gridSize = 50; // meters

	/**
	 * Analyze flight path and signal captures
	 */
	analyze(
		flightPath: FlightPoint[],
		signalCaptures: SignalCapture[],
		areaOfInterest?: AreaOfInterest
	): FlightAnalysis {
		const coverageMap = this.generateCoverageMap(flightPath, signalCaptures);
		const signalHotspots = this.identifySignalHotspots(signalCaptures);
		const flightEfficiency = this.calculateEfficiency(
			flightPath,
			signalCaptures,
			areaOfInterest
		);
		const anomalies = this.detectAnomalies(flightPath, signalCaptures);
		const recommendations = this.generateRecommendations(
			coverageMap,
			signalHotspots,
			flightEfficiency,
			anomalies
		);

		return {
			coverageMap,
			signalHotspots,
			flightEfficiency,
			recommendations,
			anomalies
		};
	}

	/**
	 * Generate coverage map from flight path
	 */
	private generateCoverageMap(
		flightPath: FlightPoint[],
		signalCaptures: SignalCapture[]
	): CoverageCell[] {
		const cells = new Map<string, CoverageCell>();

		// Create cells from flight path
		flightPath.forEach((point) => {
			const cellKey = this.getCellKey(point.lat, point.lon);

			if (!cells.has(cellKey)) {
				const bounds = this.getCellBounds(point.lat, point.lon);
				cells.set(cellKey, {
					bounds,
					center: {
						lat: (bounds.minLat + bounds.maxLat) / 2,
						lon: (bounds.minLon + bounds.maxLon) / 2
					},
					altitudes: [],
					signalCount: 0,
					averagePower: 0,
					coverageQuality: 'poor'
				});
			}

			const cell = cells.get(cellKey);
			if (cell) {
				cell.altitudes.push(point.altitude);
			}
		});

		// Add signal data to cells
		signalCaptures.forEach((capture) => {
			const cellKey = this.getCellKey(capture.position.lat, capture.position.lon);
			const cell = cells.get(cellKey);

			if (cell) {
				cell.signalCount += capture.signalCount;
				cell.averagePower = capture.averagePower;

				// Update coverage quality
				if (cell.signalCount > 20) {
					cell.coverageQuality = 'excellent';
				} else if (cell.signalCount > 10) {
					cell.coverageQuality = 'good';
				} else if (cell.signalCount > 5) {
					cell.coverageQuality = 'fair';
				}
			}
		});

		return Array.from(cells.values());
	}

	/**
	 * Identify signal hotspots from captures
	 */
	private identifySignalHotspots(signalCaptures: SignalCapture[]): SignalHotspot[] {
		const hotspots: SignalHotspot[] = [];

		// Group captures by proximity
		const clusters = this.clusterCaptures(signalCaptures, 100); // 100m radius

		clusters.forEach((cluster) => {
			if (cluster.length < 3) return; // Need at least 3 captures

			// Calculate cluster center
			const center = {
				lat: cluster.reduce((sum, c) => sum + c.position.lat, 0) / cluster.length,
				lon: cluster.reduce((sum, c) => sum + c.position.lon, 0) / cluster.length,
				altitude: cluster.reduce((sum, c) => sum + c.position.altitude, 0) / cluster.length
			};

			// Calculate signal intensity
			const totalSignals = cluster.reduce((sum, c) => sum + c.signalCount, 0);
			const avgPower = cluster.reduce((sum, c) => sum + c.averagePower, 0) / cluster.length;
			const intensity = Math.min(1, ((totalSignals / 100) * (avgPower + 100)) / 100);

			// Find dominant frequency
			const freqMap = new Map<number, number>();
			cluster.forEach((capture) => {
				capture.signals.forEach((signal) => {
					const freqBand = Math.floor(signal.frequency / 100) * 100;
					freqMap.set(freqBand, (freqMap.get(freqBand) || 0) + 1);
				});
			});

			const dominantFreq =
				Array.from(freqMap.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 0;

			// Calculate optimal altitude based on signal strength at different altitudes
			const altitudeSignals = new Map<number, number[]>();
			cluster.forEach((capture) => {
				const altBand = Math.floor(capture.position.altitude / 10) * 10;
				if (!altitudeSignals.has(altBand)) {
					altitudeSignals.set(altBand, []);
				}
				const altSignals = altitudeSignals.get(altBand);
				if (altSignals) {
					altSignals.push(capture.averagePower);
				}
			});

			let optimalAlt = center.altitude;
			let maxAvgPower = -Infinity;
			altitudeSignals.forEach((powers, alt) => {
				const avg = powers.reduce((a, b) => a + b, 0) / powers.length;
				if (avg > maxAvgPower) {
					maxAvgPower = avg;
					optimalAlt = alt;
				}
			});

			hotspots.push({
				position: center,
				radius: this.calculateClusterRadius(cluster),
				intensity,
				dominantFrequency: dominantFreq,
				deviceCount: new Set(cluster.flatMap((c) => c.signals.map((s) => s.id))).size,
				recommendedAltitude: optimalAlt
			});
		});

		return hotspots.sort((a, b) => b.intensity - a.intensity);
	}

	/**
	 * Calculate flight efficiency metrics
	 */
	private calculateEfficiency(
		flightPath: FlightPoint[],
		signalCaptures: SignalCapture[],
		aoi?: AreaOfInterest
	): FlightEfficiency {
		if (flightPath.length < 2) {
			return {
				coverageRatio: 0,
				signalDetectionRate: 0,
				optimalAltitude: 0,
				redundantPathPercentage: 0,
				energyEfficiency: 0
			};
		}

		// Calculate total distance
		let totalDistance = 0;
		for (let i = 1; i < flightPath.length; i++) {
			totalDistance += this.calculateDistance(
				flightPath[i - 1].lat,
				flightPath[i - 1].lon,
				flightPath[i].lat,
				flightPath[i].lon
			);
		}

		// Calculate coverage ratio
		const coveredCells = new Set<string>();
		flightPath.forEach((point) => {
			coveredCells.add(this.getCellKey(point.lat, point.lon));
		});

		let coverageRatio = 1;
		if (aoi) {
			const totalCells = this.estimateTotalCells(aoi);
			coverageRatio = coveredCells.size / totalCells;
		}

		// Calculate signal detection rate
		const duration =
			(flightPath[flightPath.length - 1].timestamp - flightPath[0].timestamp) / 60000;
		const totalSignals = signalCaptures.reduce((sum, c) => sum + c.signalCount, 0);
		const signalDetectionRate = totalSignals / duration;

		// Find optimal altitude
		const altitudeStats = new Map<number, { count: number; avgPower: number }>();
		signalCaptures.forEach((capture) => {
			const altBand = Math.floor(capture.position.altitude / 20) * 20;
			if (!altitudeStats.has(altBand)) {
				altitudeStats.set(altBand, { count: 0, avgPower: 0 });
			}
			const stats = altitudeStats.get(altBand);
			if (!stats) throw new Error(`Altitude stats not found for band ${altBand}`);
			stats.count += capture.signalCount;
			stats.avgPower += capture.averagePower;
		});

		let optimalAltitude = 50;
		let maxScore = 0;
		altitudeStats.forEach((stats, alt) => {
			const score = stats.count * (stats.avgPower + 100);
			if (score > maxScore) {
				maxScore = score;
				optimalAltitude = alt;
			}
		});

		// Calculate redundant path percentage
		const pathSegments = new Map<string, number>();
		for (let i = 1; i < flightPath.length; i++) {
			const segmentKey = `${this.getCellKey(flightPath[i - 1].lat, flightPath[i - 1].lon)}-${this.getCellKey(flightPath[i].lat, flightPath[i].lon)}`;
			pathSegments.set(segmentKey, (pathSegments.get(segmentKey) || 0) + 1);
		}
		const redundantSegments = Array.from(pathSegments.values()).filter(
			(count) => count > 1
		).length;
		const redundantPathPercentage = (redundantSegments / pathSegments.size) * 100;

		// Calculate energy efficiency
		const batteryUsed =
			(flightPath[0].battery || 100) - (flightPath[flightPath.length - 1].battery || 0);
		const energyEfficiency = batteryUsed > 0 ? totalDistance / batteryUsed : 0;

		return {
			coverageRatio,
			signalDetectionRate,
			optimalAltitude,
			redundantPathPercentage,
			energyEfficiency
		};
	}

	/**
	 * Detect anomalies in flight path
	 */
	private detectAnomalies(
		flightPath: FlightPoint[],
		signalCaptures: SignalCapture[]
	): FlightAnomaly[] {
		const anomalies: FlightAnomaly[] = [];

		// Detect signal spikes
		const avgSignalCount =
			signalCaptures.reduce((sum, c) => sum + c.signalCount, 0) / signalCaptures.length;
		signalCaptures.forEach((capture) => {
			if (capture.signalCount > avgSignalCount * 3) {
				anomalies.push({
					timestamp: capture.timestamp,
					position: capture.position,
					type: 'signal_spike',
					severity: capture.signalCount > avgSignalCount * 5 ? 'high' : 'medium',
					description: `Unusual signal concentration: ${capture.signalCount} signals detected`
				});
			}
		});

		// Detect coverage gaps
		for (let i = 1; i < flightPath.length; i++) {
			const distance = this.calculateDistance(
				flightPath[i - 1].lat,
				flightPath[i - 1].lon,
				flightPath[i].lat,
				flightPath[i].lon
			);

			if (distance > 200) {
				// More than 200m gap
				anomalies.push({
					timestamp: flightPath[i].timestamp,
					position: {
						lat: (flightPath[i - 1].lat + flightPath[i].lat) / 2,
						lon: (flightPath[i - 1].lon + flightPath[i].lon) / 2,
						altitude: (flightPath[i - 1].altitude + flightPath[i].altitude) / 2
					},
					type: 'coverage_gap',
					severity: distance > 500 ? 'high' : 'medium',
					description: `Coverage gap of ${distance.toFixed(0)}m detected`
				});
			}
		}

		// Detect altitude deviations
		const plannedAltitudes = flightPath.map((p) => p.altitude);
		const avgAltitude = plannedAltitudes.reduce((a, b) => a + b, 0) / plannedAltitudes.length;
		const stdDev = Math.sqrt(
			plannedAltitudes.reduce((sum, alt) => sum + Math.pow(alt - avgAltitude, 2), 0) /
				plannedAltitudes.length
		);

		flightPath.forEach((point) => {
			const deviation = Math.abs(point.altitude - avgAltitude);
			if (deviation > stdDev * 2) {
				anomalies.push({
					timestamp: point.timestamp,
					position: { lat: point.lat, lon: point.lon, altitude: point.altitude },
					type: 'altitude_deviation',
					severity: deviation > stdDev * 3 ? 'high' : 'low',
					description: `Altitude deviation: ${point.altitude.toFixed(0)}m (expected ~${avgAltitude.toFixed(0)}m)`
				});
			}
		});

		return anomalies;
	}

	/**
	 * Generate recommendations based on analysis
	 */
	private generateRecommendations(
		coverageMap: CoverageCell[],
		hotspots: SignalHotspot[],
		efficiency: FlightEfficiency,
		anomalies: FlightAnomaly[]
	): string[] {
		const recommendations: string[] = [];

		// Coverage recommendations
		const poorCoverage = coverageMap.filter((c) => c.coverageQuality === 'poor').length;
		if (poorCoverage > coverageMap.length * 0.2) {
			recommendations.push(
				'Increase scan density or reduce flight speed for better coverage'
			);
		}

		// Altitude recommendations
		if (efficiency.optimalAltitude > 0) {
			recommendations.push(
				`Consider flying at ${efficiency.optimalAltitude}m for optimal signal detection`
			);
		}

		// Hotspot recommendations
		if (hotspots.length > 0) {
			const topHotspot = hotspots[0];
			recommendations.push(
				`Focus on area around ${topHotspot.position.lat.toFixed(6)}, ${topHotspot.position.lon.toFixed(6)} ` +
					`with ${topHotspot.deviceCount} devices detected`
			);

			if (topHotspot.recommendedAltitude !== efficiency.optimalAltitude) {
				recommendations.push(
					`Adjust altitude to ${topHotspot.recommendedAltitude}m when investigating hotspots`
				);
			}
		}

		// Efficiency recommendations
		if (efficiency.redundantPathPercentage > 20) {
			recommendations.push('Optimize flight path to reduce redundant coverage');
		}

		if (efficiency.signalDetectionRate < 10) {
			recommendations.push(
				'Consider slower flight speed or lower altitude for better signal detection'
			);
		}

		// Anomaly recommendations
		const highSeverityAnomalies = anomalies.filter((a) => a.severity === 'high');
		if (highSeverityAnomalies.length > 0) {
			recommendations.push(
				`Investigate ${highSeverityAnomalies.length} high-severity anomalies detected`
			);
		}

		return recommendations;
	}

	/**
	 * Helper functions
	 */
	private getCellKey(lat: number, lon: number): string {
		const latMetersPerDegree = 111320;
		const lonMetersPerDegree = 111320 * Math.cos((lat * Math.PI) / 180);

		const gridLat =
			(Math.floor((lat * latMetersPerDegree) / this.gridSize) * this.gridSize) /
			latMetersPerDegree;
		const gridLon =
			(Math.floor((lon * lonMetersPerDegree) / this.gridSize) * this.gridSize) /
			lonMetersPerDegree;

		return `${gridLat.toFixed(6)},${gridLon.toFixed(6)}`;
	}

	private getCellBounds(lat: number, lon: number): CoverageCell['bounds'] {
		const latMetersPerDegree = 111320;
		const lonMetersPerDegree = 111320 * Math.cos((lat * Math.PI) / 180);

		const latDelta = this.gridSize / latMetersPerDegree;
		const lonDelta = this.gridSize / lonMetersPerDegree;

		const gridLat =
			(Math.floor((lat * latMetersPerDegree) / this.gridSize) * this.gridSize) /
			latMetersPerDegree;
		const gridLon =
			(Math.floor((lon * lonMetersPerDegree) / this.gridSize) * this.gridSize) /
			lonMetersPerDegree;

		return {
			minLat: gridLat,
			maxLat: gridLat + latDelta,
			minLon: gridLon,
			maxLon: gridLon + lonDelta
		};
	}

	private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
		const R = 6371e3;
		const φ1 = (lat1 * Math.PI) / 180;
		const φ2 = (lat2 * Math.PI) / 180;
		const Δφ = ((lat2 - lat1) * Math.PI) / 180;
		const Δλ = ((lon2 - lon1) * Math.PI) / 180;

		const a =
			Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
			Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
		const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

		return R * c;
	}

	private clusterCaptures(captures: SignalCapture[], radius: number): SignalCapture[][] {
		const clusters: SignalCapture[][] = [];
		const used = new Set<number>();

		captures.forEach((capture, i) => {
			if (used.has(i)) return;

			const cluster = [capture];
			used.add(i);

			captures.forEach((other, j) => {
				if (i === j || used.has(j)) return;

				const distance = this.calculateDistance(
					capture.position.lat,
					capture.position.lon,
					other.position.lat,
					other.position.lon
				);

				if (distance <= radius) {
					cluster.push(other);
					used.add(j);
				}
			});

			clusters.push(cluster);
		});

		return clusters;
	}

	private calculateClusterRadius(cluster: SignalCapture[]): number {
		let maxDistance = 0;
		const center = {
			lat: cluster.reduce((sum, c) => sum + c.position.lat, 0) / cluster.length,
			lon: cluster.reduce((sum, c) => sum + c.position.lon, 0) / cluster.length
		};

		cluster.forEach((capture) => {
			const distance = this.calculateDistance(
				center.lat,
				center.lon,
				capture.position.lat,
				capture.position.lon
			);
			maxDistance = Math.max(maxDistance, distance);
		});

		return maxDistance;
	}

	private estimateTotalCells(aoi: AreaOfInterest): number {
		if (aoi.type === 'circle' && aoi.radius) {
			const area = Math.PI * aoi.radius * aoi.radius;
			return Math.ceil(area / (this.gridSize * this.gridSize));
		} else if (aoi.type === 'rectangle' && aoi.coordinates.length === 4) {
			const width = this.calculateDistance(
				aoi.coordinates[0][0],
				aoi.coordinates[0][1],
				aoi.coordinates[1][0],
				aoi.coordinates[1][1]
			);
			const height = this.calculateDistance(
				aoi.coordinates[0][0],
				aoi.coordinates[0][1],
				aoi.coordinates[3][0],
				aoi.coordinates[3][1]
			);
			return Math.ceil((width * height) / (this.gridSize * this.gridSize));
		}

		// Estimate for polygon
		return 100; // Default estimate
	}
}
