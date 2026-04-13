/**
 * EMCON diff engine.
 *
 * Compares a baseline capture snapshot against a posture capture snapshot and
 * produces a classification of emitter deltas: NEW, MISSING, UNCHANGED,
 * NOTABLE (>=6 dB absolute power change), CRITICAL (>=15 dB).
 *
 * Matching strategy (see tests/unit/emcon-diff.test.ts):
 *   - wifi-ap: match by BSSID; fall back to SSID (MAC randomization).
 *   - wifi-client: fingerprint_key (client MAC + assoc AP).
 *   - gsm / bluetooth: fingerprint_key (trusted upstream-canonicalized).
 *   - rf: bucket by floor(freq_hz / FREQ_BIN_HZ) + modulation.
 *
 * Loadout handling: if baseline and posture loadouts hash-match, we diff every
 * emitter. If not, we compute the sensor intersection and strip both captures
 * to only emitters whose `sensor_tool` is in the intersection — otherwise a
 * sensor that was only present in one capture would spuriously report its
 * emitters as missing/new.
 */

import { EMCON_THRESHOLDS } from './emcon-config';
import { type CaptureLoadout, type LoadoutIntersection, loadoutIntersection } from './loadout-hash';

export type EmitterSignalType = 'wifi-ap' | 'wifi-client' | 'gsm' | 'bluetooth' | 'rf';

export type EmitterRow = {
	fingerprint_key: string;
	signal_type: EmitterSignalType;
	identifier: string | null;
	freq_hz: number | null;
	power_dbm: number | null;
	modulation: string | null;
	mgrs: string | null;
	classification: string | null;
	source_table: string;
	source_id: string;
	bssid?: string | null;
	ssid?: string | null;
	sensor_tool?: string;
};

export type EmitterDelta = {
	baseline: EmitterRow;
	posture: EmitterRow;
	delta_db: number;
};

export type Capture = {
	id: string;
	loadout: CaptureLoadout;
	emitters: EmitterRow[];
};

export type DiffResult = {
	new: EmitterRow[];
	missing: EmitterRow[];
	unchanged: EmitterRow[];
	notable: EmitterDelta[];
	critical: EmitterDelta[];
	loadout: LoadoutIntersection;
};

function rfBucketKey(row: EmitterRow): string {
	const freq = row.freq_hz ?? 0;
	const bin = Math.round(freq / EMCON_THRESHOLDS.FREQ_BIN_HZ);
	const mod = row.modulation ?? '';
	return `rf:${bin}:${mod}`;
}

function wifiApPrimaryKey(row: EmitterRow): string {
	return row.bssid
		? `wifi-ap:bssid:${row.bssid.toLowerCase()}`
		: `wifi-ap:fp:${row.fingerprint_key}`;
}

const PRIMARY_KEY_BUILDERS: Record<EmitterSignalType, (row: EmitterRow) => string> = {
	'wifi-ap': wifiApPrimaryKey,
	'wifi-client': (row) => `wifi-client:${row.fingerprint_key}`,
	gsm: (row) => `gsm:${row.fingerprint_key}`,
	bluetooth: (row) => `bt:${row.fingerprint_key}`,
	rf: rfBucketKey
};

function primaryMatchKey(row: EmitterRow): string {
	const builder = PRIMARY_KEY_BUILDERS[row.signal_type];
	return builder ? builder(row) : row.fingerprint_key;
}

function wifiApSsidKey(row: EmitterRow): string | null {
	if (row.signal_type !== 'wifi-ap') return null;
	if (!row.ssid) return null;
	return `wifi-ap:ssid:${row.ssid}`;
}

function filterByLoadout(emitters: EmitterRow[], allowed: Set<string>): EmitterRow[] {
	return emitters.filter((e) => {
		if (!e.sensor_tool) return true;
		return allowed.has(e.sensor_tool);
	});
}

function classifyDelta(delta_db: number): 'unchanged' | 'notable' | 'critical' {
	const abs = Math.abs(delta_db);
	if (abs >= EMCON_THRESHOLDS.CRITICAL_DB) return 'critical';
	if (abs >= EMCON_THRESHOLDS.NOTABLE_DB) return 'notable';
	return 'unchanged';
}

type IndexedEmitters = {
	primary: Map<string, EmitterRow>;
	ssid: Map<string, EmitterRow>;
};

function addToMapIfAbsent<K, V>(map: Map<K, V>, key: K | null, value: V): void {
	if (key !== null && !map.has(key)) map.set(key, value);
}

function indexEmitters(rows: EmitterRow[]): IndexedEmitters {
	const primary = new Map<string, EmitterRow>();
	const ssid = new Map<string, EmitterRow>();
	for (const row of rows) {
		addToMapIfAbsent(primary, primaryMatchKey(row), row);
		addToMapIfAbsent(ssid, wifiApSsidKey(row), row);
	}
	return { primary, ssid };
}

function findMatch(row: EmitterRow, idx: IndexedEmitters): EmitterRow | undefined {
	const primaryKey = primaryMatchKey(row);
	const direct = idx.primary.get(primaryKey);
	if (direct) return direct;
	const ssidKey = wifiApSsidKey(row);
	if (ssidKey) return idx.ssid.get(ssidKey);
	return undefined;
}

function applyLoadoutFilter(
	baseline: Capture,
	posture: Capture,
	loadout: LoadoutIntersection
): { baselineEmitters: EmitterRow[]; postureEmitters: EmitterRow[] } {
	if (loadout.matched) {
		return { baselineEmitters: baseline.emitters, postureEmitters: posture.emitters };
	}
	const allowed = new Set(loadout.intersection);
	return {
		baselineEmitters: filterByLoadout(baseline.emitters, allowed),
		postureEmitters: filterByLoadout(posture.emitters, allowed)
	};
}

function emptyResult(loadout: LoadoutIntersection): DiffResult {
	return { new: [], missing: [], unchanged: [], notable: [], critical: [], loadout };
}

function recordMatched(b: EmitterRow, matchedKeys: Set<string>): void {
	matchedKeys.add(primaryMatchKey(b));
	const ssidKey = wifiApSsidKey(b);
	if (ssidKey) matchedKeys.add(`__ssid__${ssidKey}`);
}

function pushDelta(result: DiffResult, b: EmitterRow, p: EmitterRow): void {
	const delta_db = (p.power_dbm ?? 0) - (b.power_dbm ?? 0);
	const kind = classifyDelta(delta_db);
	if (kind === 'critical') result.critical.push({ baseline: b, posture: p, delta_db });
	else if (kind === 'notable') result.notable.push({ baseline: b, posture: p, delta_db });
	else result.unchanged.push(p);
}

function classifyPostureEmitters(
	postureEmitters: EmitterRow[],
	baselineIdx: IndexedEmitters,
	result: DiffResult,
	matchedKeys: Set<string>
): void {
	for (const p of postureEmitters) {
		const b = findMatch(p, baselineIdx);
		if (!b) {
			result.new.push(p);
			continue;
		}
		recordMatched(b, matchedKeys);
		pushDelta(result, b, p);
	}
}

function isBaselineMatched(
	b: EmitterRow,
	matchedKeys: Set<string>,
	postureIdx: IndexedEmitters
): boolean {
	if (matchedKeys.has(primaryMatchKey(b))) return true;
	const ssidKey = wifiApSsidKey(b);
	if (ssidKey && matchedKeys.has(`__ssid__${ssidKey}`)) return true;
	return Boolean(findMatch(b, postureIdx));
}

export function diffCaptures(baseline: Capture, posture: Capture): DiffResult {
	const loadout = loadoutIntersection(baseline.loadout, posture.loadout);
	const { baselineEmitters, postureEmitters } = applyLoadoutFilter(baseline, posture, loadout);

	const baselineIdx = indexEmitters(baselineEmitters);
	const postureIdx = indexEmitters(postureEmitters);
	const result = emptyResult(loadout);
	const matchedKeys = new Set<string>();

	classifyPostureEmitters(postureEmitters, baselineIdx, result, matchedKeys);

	for (const b of baselineEmitters) {
		if (!isBaselineMatched(b, matchedKeys, postureIdx)) result.missing.push(b);
	}

	return result;
}
