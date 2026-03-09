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

/** Result from a single ping target in /api/system/network-latency */
export interface PingResult {
	target: string;
	label: string;
	latencyMs: number | null;
	packetLoss: number;
	jitterMs: number | null;
	status: 'ok' | 'timeout' | 'error';
}

/** Tailscale peer from /api/system/mesh-status */
export interface TailscalePeer {
	name: string;
	ipv4: string;
	online: boolean;
	lastSeen: string;
	os: string;
}

/** TAK server entry from /api/system/mesh-status */
export interface TakServer {
	name: string;
	host: string;
	port: string;
	connected: boolean;
	uptime?: number;
	messageCount?: number;
	connectionHealth?: string;
	tls: boolean;
}
