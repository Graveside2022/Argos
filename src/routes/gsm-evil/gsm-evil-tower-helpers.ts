/**
 * GSM Evil tower detection helpers — cell field extraction and metadata resolution
 * for scan results displayed in the tower table.
 */

import { mccToCountry, mncToCarrier } from '$lib/data/carrier-mappings';
import type { TowerLocation } from '$lib/stores/gsm-evil-store';

const UNKNOWN_COUNTRY = { name: 'Unknown', flag: '', code: '??' };

interface ScanResultWithCell {
	frequency: string;
	frameCount?: number;
	strength?: string;
	mcc?: string;
	mnc?: string;
	lac?: string;
	ci?: string;
}

/** Extract cell ID fields with defaults from a scan result. */
function extractCellFields(r: ScanResultWithCell) {
	const mcc = r.mcc || '';
	const mnc = r.mnc || '';
	const lac = r.lac || '';
	const ci = r.ci || '';
	const mccMnc = `${mcc}-${mnc.padStart(2, '0')}`;
	return { mcc, mnc, lac, ci, mccMnc, towerId: `${mccMnc}-${lac}-${ci}` };
}

/** Resolve tower metadata lookups (country, carrier, location). */
function resolveTowerMeta(
	mcc: string,
	mccMnc: string,
	towerId: string,
	locations: Record<string, TowerLocation>
) {
	return {
		country: mccToCountry[mcc] || UNKNOWN_COUNTRY,
		carrier: mncToCarrier[mccMnc] || 'Unknown',
		location: locations[towerId] || null
	};
}

/** Map a scan result with cell info to a detected tower record. */
export function toDetectedTower(r: ScanResultWithCell, locations: Record<string, TowerLocation>) {
	const cell = extractCellFields(r);
	const meta = resolveTowerMeta(cell.mcc, cell.mccMnc, cell.towerId, locations);
	return {
		frequency: r.frequency,
		...cell,
		...meta,
		frameCount: r.frameCount || 0,
		strength: r.strength
	};
}

/** Whether a scan result has cell identification fields. */
export function hasCellInfo(r: ScanResultWithCell): boolean {
	return !!(r.mcc && r.lac && r.ci);
}
