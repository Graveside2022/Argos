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

/**
 * Groups captured IMSIs by tower (MCC-MNC-LAC-CI combination)
 *
 * @param capturedIMSIs - Array of captured IMSI records
 * @param mncToCarrier - Carrier lookup map (MCC-MNC -> carrier name)
 * @param mccToCountry - Country lookup map (MCC -> country data)
 * @param towerLocations - Tower location data (towerId -> {lat, lon})
 * @returns Array of tower groups with device counts and metadata
 */
export function groupIMSIsByTower(
	capturedIMSIs: CapturedIMSI[],
	mncToCarrier: { [key: string]: string },
	mccToCountry: CountryLookup,
	towerLocations: { [towerId: string]: { lat: number; lon: number } | null }
): TowerGroup[] {
	const towerGroups: { [key: string]: TowerGroup } = {};

	capturedIMSIs.forEach((imsi) => {
		const mcc = imsi.mcc?.toString() || '';
		const mnc = imsi.mnc?.toString() || '';
		const lac = imsi.lac?.toString() || '';
		const ci = imsi.ci?.toString() || '';

		if (mcc && lac && ci) {
			const mccMnc = `${mcc}-${mnc.padStart(2, '0')}`;
			const towerId = `${mccMnc}-${lac}-${ci}`;

			if (!towerGroups[towerId]) {
				const country = mccToCountry[mcc] || {
					name: 'Unknown',
					flag: '🏳️',
					code: '??'
				};
				const carrier = mncToCarrier[mccMnc] || 'Unknown';

				// Determine status based on carrier and MCC
				let status: TowerGroup['status'] = 'ok';
				let statusSymbol = '✓';

				if (mcc === '000' || mcc === '001' || mcc === '999') {
					// Fake/Test MCCs
					status = 'fake';
					statusSymbol = '❌';
				} else if (!mccToCountry[mcc]) {
					// Unknown country
					status = 'suspicious';
					statusSymbol = '🚨';
				} else if (carrier === 'Unknown') {
					// Unknown carrier
					status = 'unknown';
					statusSymbol = '⚠️';
				}

				// Check towerLocations for the latest location data
				const location =
					towerLocations[towerId] ||
					(imsi.lat && imsi.lon ? { lat: imsi.lat, lon: imsi.lon } : null);

				towerGroups[towerId] = {
					mcc: mcc,
					mnc: mnc,
					mccMnc: mccMnc,
					lac: lac,
					ci: ci,
					country: country,
					carrier: carrier,
					devices: [],
					count: 0,
					firstSeen: new Date('9999-12-31T23:59:59Z'),
					lastSeen: new Date(0), // Epoch so any real timestamp will be greater
					isNew: false,
					status: status,
					statusSymbol: statusSymbol,
					location: location
				};
			}

			// Store full device object with timestamp
			towerGroups[towerId].devices.push({
				imsi: imsi.imsi,
				tmsi: imsi.tmsi,
				timestamp: imsi.timestamp
			});
			towerGroups[towerId].count++;

			// Update lastSeen to most recent device timestamp
			const deviceTime = new Date(imsi.timestamp);
			if (!towerGroups[towerId].lastSeen || deviceTime > towerGroups[towerId].lastSeen) {
				towerGroups[towerId].lastSeen = deviceTime;
			}
		}
	});

	// Return unsorted - sorting will be handled by sortTowers()
	return Object.values(towerGroups);
}

/**
 * Sorts tower groups by specified column and direction
 *
 * @param towers - Array of tower groups to sort
 * @param column - Column to sort by
 * @param direction - Sort direction ('asc' or 'desc')
 * @returns Sorted array of tower groups
 */
export function sortTowers(
	towers: TowerGroup[],
	column: SortColumn,
	direction: 'asc' | 'desc'
): TowerGroup[] {
	const sorted = [...towers].sort((a, b) => {
		let aVal: string | number | Date;
		let bVal: string | number | Date;

		switch (column) {
			case 'carrier':
				aVal = a.carrier.toLowerCase();
				bVal = b.carrier.toLowerCase();
				break;
			case 'country':
				aVal = a.country.name.toLowerCase();
				bVal = b.country.name.toLowerCase();
				break;
			case 'location':
				// Sort by whether location exists, then by distance if both have locations
				aVal = a.location ? 1 : 0;
				bVal = b.location ? 1 : 0;
				break;
			case 'lac':
				aVal = parseInt(a.lac) || 0;
				bVal = parseInt(b.lac) || 0;
				break;
			case 'mccMnc':
				aVal = a.mccMnc;
				bVal = b.mccMnc;
				break;
			case 'devices':
				aVal = a.count;
				bVal = b.count;
				break;
			case 'lastSeen':
				aVal = a.lastSeen.getTime();
				bVal = b.lastSeen.getTime();
				break;
			default:
				return 0;
		}

		// Compare values
		if (aVal < bVal) return direction === 'asc' ? -1 : 1;
		if (aVal > bVal) return direction === 'asc' ? 1 : -1;
		return 0;
	});

	return sorted;
}
