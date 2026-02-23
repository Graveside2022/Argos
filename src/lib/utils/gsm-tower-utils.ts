/**
 * GSM Tower Utilities
 *
 * Extracted from src/routes/gsm-evil/+page.svelte for testability
 * Phase 1.5 Part 2: Characterization test preparation
 */

import type { CapturedIMSI } from '$lib/types/gsm';

/**
 * Tower group data structure
 */
export interface TowerGroup {
	mcc: string;
	mnc: string;
	mccMnc: string;
	lac: string;
	ci: string;
	country: {
		name: string;
		flag: string;
		code: string;
	};
	carrier: string;
	devices: Array<{
		imsi: string;
		tmsi?: string;
		timestamp: string;
	}>;
	count: number;
	firstSeen: Date;
	lastSeen: Date;
	isNew: boolean;
	status: 'ok' | 'fake' | 'suspicious' | 'unknown';
	statusSymbol: string;
	location: { lat: number; lon: number } | null;
}

/**
 * Sort column types
 */
export type SortColumn =
	| 'carrier'
	| 'country'
	| 'location'
	| 'lac'
	| 'mccMnc'
	| 'devices'
	| 'lastSeen';

/**
 * Country lookup by MCC
 */
export interface CountryLookup {
	[mcc: string]: {
		name: string;
		flag: string;
		code: string;
	};
}

/** Fake/test MCCs that indicate a spoofed tower. */
const FAKE_MCCS = new Set(['000', '001', '999']);

/** Classify tower status based on MCC and carrier. */
function classifyTowerStatus(
	mcc: string,
	carrier: string,
	mccToCountry: CountryLookup
): { status: TowerGroup['status']; statusSymbol: string } {
	if (FAKE_MCCS.has(mcc)) return { status: 'fake', statusSymbol: '❌' };
	if (!mccToCountry[mcc]) return { status: 'suspicious', statusSymbol: '🚨' };
	if (carrier === 'Unknown') return { status: 'unknown', statusSymbol: '⚠️' };
	return { status: 'ok', statusSymbol: '✓' };
}

/** Resolve tower location from lookup or IMSI fallback. */
function resolveTowerLocation(
	towerId: string,
	imsi: CapturedIMSI,
	towerLocations: { [id: string]: { lat: number; lon: number } | null }
): { lat: number; lon: number } | null {
	return (
		towerLocations[towerId] || (imsi.lat && imsi.lon ? { lat: imsi.lat, lon: imsi.lon } : null)
	);
}

/** Coerce an optional number field to string. */
function fieldStr(value: string | number | undefined): string {
	return value?.toString() || '';
}

/** Tower identifier fields. */
interface TowerFields {
	mcc: string;
	mnc: string;
	lac: string;
	ci: string;
	mccMnc: string;
	towerId: string;
}

/** Extract IMSI tower fields, returning null if insufficient data. */
function extractTowerFields(imsi: CapturedIMSI): TowerFields | null {
	const mcc = fieldStr(imsi.mcc);
	const mnc = fieldStr(imsi.mnc);
	const lac = fieldStr(imsi.lac);
	const ci = fieldStr(imsi.ci);
	if (!mcc || !lac || !ci) return null;
	const mccMnc = `${mcc}-${mnc.padStart(2, '0')}`;
	return { mcc, mnc, lac, ci, mccMnc, towerId: `${mccMnc}-${lac}-${ci}` };
}

/** Create a new TowerGroup entry. */
function createTowerGroup(
	fields: { mcc: string; mnc: string; lac: string; ci: string; mccMnc: string; towerId: string },
	imsi: CapturedIMSI,
	mncToCarrier: { [key: string]: string },
	mccToCountry: CountryLookup,
	towerLocations: { [id: string]: { lat: number; lon: number } | null }
): TowerGroup {
	const carrier = mncToCarrier[fields.mccMnc] || 'Unknown';
	const { status, statusSymbol } = classifyTowerStatus(fields.mcc, carrier, mccToCountry);
	return {
		...fields,
		country: mccToCountry[fields.mcc] || { name: 'Unknown', flag: '🏳️', code: '??' },
		carrier,
		devices: [],
		count: 0,
		firstSeen: new Date('9999-12-31T23:59:59Z'),
		lastSeen: new Date(0),
		isNew: false,
		status,
		statusSymbol,
		location: resolveTowerLocation(fields.towerId, imsi, towerLocations)
	};
}

/** Add a device to an existing tower group. */
function addDeviceToGroup(group: TowerGroup, imsi: CapturedIMSI): void {
	group.devices.push({ imsi: imsi.imsi, tmsi: imsi.tmsi, timestamp: imsi.timestamp });
	group.count++;
	const deviceTime = new Date(imsi.timestamp);
	if (deviceTime > group.lastSeen) group.lastSeen = deviceTime;
}

/**
 * Groups captured IMSIs by tower (MCC-MNC-LAC-CI combination)
 */
export function groupIMSIsByTower(
	capturedIMSIs: CapturedIMSI[],
	mncToCarrier: { [key: string]: string },
	mccToCountry: CountryLookup,
	towerLocations: { [towerId: string]: { lat: number; lon: number } | null }
): TowerGroup[] {
	const groups: { [key: string]: TowerGroup } = {};

	for (const imsi of capturedIMSIs) {
		const fields = extractTowerFields(imsi);
		if (!fields) continue;
		groups[fields.towerId] ??= createTowerGroup(
			fields,
			imsi,
			mncToCarrier,
			mccToCountry,
			towerLocations
		);
		addDeviceToGroup(groups[fields.towerId], imsi);
	}

	return Object.values(groups);
}

/** Value extractors for each sort column. */
const SORT_EXTRACTORS: Record<SortColumn, (t: TowerGroup) => string | number> = {
	carrier: (t) => t.carrier.toLowerCase(),
	country: (t) => t.country.name.toLowerCase(),
	location: (t) => (t.location ? 1 : 0),
	lac: (t) => parseInt(t.lac) || 0,
	mccMnc: (t) => t.mccMnc,
	devices: (t) => t.count,
	lastSeen: (t) => t.lastSeen.getTime()
};

/** Compare two values ascending. */
function compareAsc(a: string | number, b: string | number): number {
	if (a < b) return -1;
	if (a > b) return 1;
	return 0;
}

/**
 * Sorts tower groups by specified column and direction
 */
export function sortTowers(
	towers: TowerGroup[],
	column: SortColumn,
	direction: 'asc' | 'desc'
): TowerGroup[] {
	const extract = SORT_EXTRACTORS[column];
	const mult = direction === 'asc' ? 1 : -1;
	return [...towers].sort((a, b) => compareAsc(extract(a), extract(b)) * mult);
}
