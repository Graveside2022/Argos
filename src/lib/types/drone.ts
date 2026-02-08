/**
 * Canonical drone mission type definitions.
 * Used by stores/drone and services/drone.
 */

import type { SignalMarker } from './signals';

export interface AreaOfInterest {
	id: string;
	name: string;
	type: 'polygon' | 'circle' | 'rectangle';
	coordinates: [number, number][]; // [lat, lon]
	center?: { lat: number; lon: number };
	radius?: number; // for circle type
	scanPattern?: 'grid' | 'spiral' | 'random';
	flightAltitude: number;
	overlap?: number; // percentage for grid patterns
}

export interface FlightPoint {
	timestamp: number;
	lat: number;
	lon: number;
	altitude: number;
	heading: number;
	speed: number;
	signalStrength?: number; // aggregate signal strength at this point
	battery?: number;
}

export interface SignalCapture {
	id: string;
	timestamp: number;
	position: { lat: number; lon: number; altitude: number };
	signals: SignalMarker[];
	strongestSignal?: SignalMarker;
	averagePower: number;
	signalCount: number;
}
