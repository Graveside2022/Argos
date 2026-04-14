/**
 * Capture loadout canonicalization + stable SHA-256 hashing.
 *
 * Two captures with the same set of sensors (same tools, same configs) must
 * produce the same loadout hash, regardless of insertion order. This lets the
 * diff engine compare a baseline capture with a posture capture only when
 * they were produced with identical sensor suites, and otherwise fall back to
 * the intersection of tools present in both captures.
 */

import { createHash } from 'node:crypto';

export type SensorLoadout = {
	tool: string;
	interface?: string;
	gain?: number;
	channels?: string[];
};

export type CaptureLoadout = {
	sensors: SensorLoadout[];
	spectrum_start_hz?: number;
	spectrum_end_hz?: number;
	spectrum_bin_hz?: number;
};

export type LoadoutIntersection = {
	matched: boolean;
	intersection: string[];
	baseline_only: string[];
	posture_only: string[];
};

function canonicalSensor(s: SensorLoadout): Record<string, unknown> {
	const out: Record<string, unknown> = { tool: s.tool };
	if (s.interface !== undefined) out.interface = s.interface;
	if (s.gain !== undefined) out.gain = s.gain;
	if (s.channels !== undefined) {
		out.channels = [...s.channels].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
	}
	return out;
}

function canonicalLoadout(loadout: CaptureLoadout): string {
	const sensors = [...loadout.sensors].map(canonicalSensor).sort((a, b) => {
		const ta = String(a.tool);
		const tb = String(b.tool);
		return ta < tb ? -1 : ta > tb ? 1 : 0;
	});
	return JSON.stringify({ sensors });
}

export function hashLoadout(loadout: CaptureLoadout): string {
	const canonical = canonicalLoadout(loadout);
	return createHash('sha256').update(canonical).digest('hex');
}

function partitionTools(
	aTools: Set<string>,
	bTools: Set<string>
): { intersection: string[]; baseline_only: string[] } {
	const intersection: string[] = [];
	const baseline_only: string[] = [];
	for (const t of aTools) {
		(bTools.has(t) ? intersection : baseline_only).push(t);
	}
	return { intersection, baseline_only };
}

function diffTools(aTools: Set<string>, bTools: Set<string>): string[] {
	const out: string[] = [];
	for (const t of bTools) if (!aTools.has(t)) out.push(t);
	return out;
}

export function loadoutIntersection(a: CaptureLoadout, b: CaptureLoadout): LoadoutIntersection {
	const aTools = new Set(a.sensors.map((s) => s.tool));
	const bTools = new Set(b.sensors.map((s) => s.tool));
	const { intersection, baseline_only } = partitionTools(aTools, bTools);
	const posture_only = diffTools(aTools, bTools);

	intersection.sort();
	baseline_only.sort();
	posture_only.sort();

	const matched = hashLoadout(a) === hashLoadout(b);
	return { matched, intersection, baseline_only, posture_only };
}
