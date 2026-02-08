/**
 * Canonical network graph type definitions.
 * Used by server/db, services/map, services/db, and API routes.
 */

import type { SignalMarker } from './signals';

export interface NetworkNode {
	id: string;
	signal: SignalMarker;
	type: 'ap' | 'client' | 'peer' | 'unknown';
	connections: string[]; // IDs of connected nodes
	metadata: {
		ssid?: string;
		manufacturer?: string;
		protocol?: string;
		channel?: number;
	};
}

export interface NetworkEdge {
	id: string;
	source: string;
	target: string;
	type: 'wifi' | 'bluetooth' | 'direct' | 'inferred';
	strength: number; // 0-1 normalized
	metadata: {
		frequency?: number;
		distance?: number;
		lastSeen: number;
	};
}
