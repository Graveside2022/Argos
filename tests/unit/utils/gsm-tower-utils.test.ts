/**
 * Characterization Tests for GSM Tower Utilities
 *
 * Phase 1.5 Part 2: Write Characterization Tests
 * Tests extracted logic from src/routes/gsm-evil/+page.svelte
 *
 * Strategy: Test WHAT the code does, not HOW it does it
 * Focus: Inputs → Outputs, critical paths, edge cases
 */

import { describe, it, expect } from 'vitest';
import {
	groupIMSIsByTower,
	sortTowers,
	type TowerGroup,
	type SortColumn
} from '$lib/utils/gsm-tower-utils';
import { mncToCarrier, mccToCountry } from '$lib/data/carrier-mappings';
import type { CapturedIMSI } from '$lib/types/gsm';

describe('groupIMSIsByTower', () => {
	describe('tower identification', () => {
		it('groups IMSIs by unique tower ID (MCC-MNC-LAC-CI)', () => {
			const imsis: CapturedIMSI[] = [
				{
					imsi: '310410123456789',
					mcc: '310' as any,
					mnc: '410' as any,
					lac: 12345,
					ci: 67890,
					timestamp: '2026-02-12T10:00:00Z'
				},
				{
					imsi: '310410987654321',
					mcc: '310' as any,
					mnc: '410' as any,
					lac: 12345,
					ci: 67890,
					timestamp: '2026-02-12T10:01:00Z'
				}
			];

			const towers = groupIMSIsByTower(imsis, mncToCarrier, mccToCountry, {});

			expect(towers).toHaveLength(1);
			expect(towers[0].count).toBe(2);
			expect(towers[0].devices).toHaveLength(2);
		});

		it('creates separate towers for different LAC', () => {
			const imsis: CapturedIMSI[] = [
				{
					imsi: '310410123456789',
					mcc: '310' as any,
					mnc: '410' as any,
					lac: 11111,
					ci: 67890,
					timestamp: '2026-02-12T10:00:00Z'
				},
				{
					imsi: '310410987654321',
					mcc: '310' as any,
					mnc: '410' as any,
					lac: 22222,
					ci: 67890,
					timestamp: '2026-02-12T10:01:00Z'
				}
			];

			const towers = groupIMSIsByTower(imsis, mncToCarrier, mccToCountry, {});

			expect(towers).toHaveLength(2);
		});

		it('creates separate towers for different CI', () => {
			const imsis: CapturedIMSI[] = [
				{
					imsi: '310410123456789',
					mcc: '310' as any,
					mnc: '410' as any,
					lac: 12345,
					ci: 11111,
					timestamp: '2026-02-12T10:00:00Z'
				},
				{
					imsi: '310410987654321',
					mcc: '310' as any,
					mnc: '410' as any,
					lac: 12345,
					ci: 22222,
					timestamp: '2026-02-12T10:01:00Z'
				}
			];

			const towers = groupIMSIsByTower(imsis, mncToCarrier, mccToCountry, {});

			expect(towers).toHaveLength(2);
		});
	});

	describe('carrier lookup', () => {
		it('looks up carrier from MCC-MNC mapping', () => {
			const imsis: CapturedIMSI[] = [
				{
					imsi: '310410123456789',
					mcc: '310' as any,
					mnc: '410' as any,
					lac: 12345,
					ci: 67890,
					timestamp: '2026-02-12T10:00:00Z'
				}
			];

			const towers = groupIMSIsByTower(imsis, mncToCarrier, mccToCountry, {});

			expect(towers[0].carrier).toBe('AT&T'); // From real mncToCarrier mapping
		});

		it('returns "Unknown" for unmapped MCC-MNC', () => {
			const imsis: CapturedIMSI[] = [
				{
					imsi: '999999123456789',
					mcc: '999' as any,
					mnc: '999' as any,
					lac: 12345,
					ci: 67890,
					timestamp: '2026-02-12T10:00:00Z'
				}
			];

			const towers = groupIMSIsByTower(imsis, mncToCarrier, mccToCountry, {});

			expect(towers[0].carrier).toBe('Unknown');
		});

		it('preserves MNC padding from IMSI (runtime string behavior)', () => {
			const imsis: CapturedIMSI[] = [
				{
					imsi: '310004123456789',
					mcc: '310' as any,
					mnc: '004' as any, // MNC comes as string with leading zeros from IMSI parsing
					lac: 12345,
					ci: 67890,
					timestamp: '2026-02-12T10:00:00Z'
				}
			];

			const towers = groupIMSIsByTower(imsis, mncToCarrier, mccToCountry, {});

			// padStart(2, '0') on "004" keeps it as "004" (already >= 2 chars)
			expect(towers[0].mccMnc).toBe('310-004');
			expect(towers[0].carrier).toBe('Verizon'); // "310-004" maps to Verizon
		});
	});

	describe('country lookup', () => {
		it('looks up country from MCC mapping', () => {
			const imsis: CapturedIMSI[] = [
				{
					imsi: '310410123456789',
					mcc: '310' as any,
					mnc: '410' as any,
					lac: 12345,
					ci: 67890,
					timestamp: '2026-02-12T10:00:00Z'
				}
			];

			const towers = groupIMSIsByTower(imsis, mncToCarrier, mccToCountry, {});

			expect(towers[0].country).toEqual({
				name: 'United States',
				flag: '🇺🇸',
				code: 'US'
			});
		});

		it('returns Unknown country for unmapped MCC', () => {
			const imsis: CapturedIMSI[] = [
				{
					imsi: '999999123456789',
					mcc: '999' as any,
					mnc: '999' as any,
					lac: 12345,
					ci: 67890,
					timestamp: '2026-02-12T10:00:00Z'
				}
			];

			const towers = groupIMSIsByTower(imsis, mncToCarrier, mccToCountry, {});

			expect(towers[0].country).toEqual({
				name: 'Unknown',
				flag: '🏳️',
				code: '??'
			});
		});
	});

	describe('status determination', () => {
		it('marks fake MCCs as "fake" status', () => {
			const testMCCs = [
				{ mcc: '000' as any, expected: 'fake' as const },
				{ mcc: '001' as any, expected: 'fake' as const },
				{ mcc: '999' as any, expected: 'fake' as const }
			];

			testMCCs.forEach(({ mcc, expected }) => {
				const imsis: CapturedIMSI[] = [
					{
						imsi: `${mcc}999123456789`,
						mcc: mcc,
						mnc: '999' as any,
						lac: 12345,
						ci: 67890,
						timestamp: '2026-02-12T10:00:00Z'
					}
				];

				const towers = groupIMSIsByTower(imsis, mncToCarrier, mccToCountry, {});

				expect(towers[0].status).toBe(expected);
				expect(towers[0].statusSymbol).toBe('❌');
			});
		});

		it('marks unknown countries as "suspicious" status', () => {
			const imsis: CapturedIMSI[] = [
				{
					imsi: '888888123456789',
					mcc: '888' as any, // Not in mccToCountry mapping
					mnc: '888' as any,
					lac: 12345,
					ci: 67890,
					timestamp: '2026-02-12T10:00:00Z'
				}
			];

			const towers = groupIMSIsByTower(imsis, mncToCarrier, mccToCountry, {});

			expect(towers[0].status).toBe('suspicious');
			expect(towers[0].statusSymbol).toBe('🚨');
		});

		it('marks unknown carriers as "unknown" status', () => {
			const imsis: CapturedIMSI[] = [
				{
					imsi: '310999123456789',
					mcc: '310' as any, // Valid MCC (USA)
					mnc: '999' as any, // Invalid MNC
					lac: 12345,
					ci: 67890,
					timestamp: '2026-02-12T10:00:00Z'
				}
			];

			const towers = groupIMSIsByTower(imsis, mncToCarrier, mccToCountry, {});

			expect(towers[0].status).toBe('unknown');
			expect(towers[0].statusSymbol).toBe('⚠️');
		});

		it('marks valid towers as "ok" status', () => {
			const imsis: CapturedIMSI[] = [
				{
					imsi: '310410123456789',
					mcc: '310' as any, // Valid MCC (USA)
					mnc: '410' as any, // Valid MNC (AT&T)
					lac: 12345,
					ci: 67890,
					timestamp: '2026-02-12T10:00:00Z'
				}
			];

			const towers = groupIMSIsByTower(imsis, mncToCarrier, mccToCountry, {});

			expect(towers[0].status).toBe('ok');
			expect(towers[0].statusSymbol).toBe('✓');
		});
	});

	describe('timestamp tracking', () => {
		it('tracks lastSeen as most recent device timestamp', () => {
			const imsis: CapturedIMSI[] = [
				{
					imsi: '310410123456789',
					mcc: '310' as any,
					mnc: '410' as any,
					lac: 12345,
					ci: 67890,
					timestamp: '2026-02-12T10:00:00Z'
				},
				{
					imsi: '310410987654321',
					mcc: '310' as any,
					mnc: '410' as any,
					lac: 12345,
					ci: 67890,
					timestamp: '2026-02-12T10:05:00Z' // 5 minutes later
				}
			];

			const towers = groupIMSIsByTower(imsis, mncToCarrier, mccToCountry, {});

			expect(towers[0].lastSeen.toISOString()).toBe('2026-02-12T10:05:00.000Z');
		});

		it('stores individual device timestamps', () => {
			const imsis: CapturedIMSI[] = [
				{
					imsi: '310410123456789',
					mcc: '310' as any,
					mnc: '410' as any,
					lac: 12345,
					ci: 67890,
					timestamp: '2026-02-12T10:00:00Z'
				},
				{
					imsi: '310410987654321',
					mcc: '310' as any,
					mnc: '410' as any,
					lac: 12345,
					ci: 67890,
					timestamp: '2026-02-12T10:05:00Z'
				}
			];

			const towers = groupIMSIsByTower(imsis, mncToCarrier, mccToCountry, {});

			expect(towers[0].devices).toHaveLength(2);
			expect(towers[0].devices[0].timestamp).toBe('2026-02-12T10:00:00Z');
			expect(towers[0].devices[1].timestamp).toBe('2026-02-12T10:05:00Z');
		});
	});

	describe('location handling', () => {
		it('uses towerLocations lookup if available', () => {
			const imsis: CapturedIMSI[] = [
				{
					imsi: '310410123456789',
					mcc: '310' as any,
					mnc: '410' as any,
					lac: 12345,
					ci: 67890,
					timestamp: '2026-02-12T10:00:00Z'
				}
			];

			const towerLocations = {
				'310-410-12345-67890': { lat: 34.0522, lon: -118.2437 }
			};

			const towers = groupIMSIsByTower(imsis, mncToCarrier, mccToCountry, towerLocations);

			expect(towers[0].location).toEqual({ lat: 34.0522, lon: -118.2437 });
		});

		it('falls back to IMSI lat/lon if towerLocations not available', () => {
			const imsis: CapturedIMSI[] = [
				{
					imsi: '310410123456789',
					mcc: '310' as any,
					mnc: '410' as any,
					lac: 12345,
					ci: 67890,
					lat: 40.7128,
					lon: -74.006,
					timestamp: '2026-02-12T10:00:00Z'
				}
			];

			const towers = groupIMSIsByTower(imsis, mncToCarrier, mccToCountry, {});

			expect(towers[0].location).toEqual({ lat: 40.7128, lon: -74.006 });
		});

		it('sets location to null if no data available', () => {
			const imsis: CapturedIMSI[] = [
				{
					imsi: '310410123456789',
					mcc: '310' as any,
					mnc: '410' as any,
					lac: 12345,
					ci: 67890,
					timestamp: '2026-02-12T10:00:00Z'
				}
			];

			const towers = groupIMSIsByTower(imsis, mncToCarrier, mccToCountry, {});

			expect(towers[0].location).toBeNull();
		});
	});

	describe('edge cases', () => {
		it('handles empty IMSI array', () => {
			const towers = groupIMSIsByTower([], mncToCarrier, mccToCountry, {});

			expect(towers).toEqual([]);
		});

		it('skips IMSIs with missing MCC', () => {
			const imsis: CapturedIMSI[] = [
				{
					imsi: '310410123456789',
					mcc: undefined as any,
					mnc: '410' as any,
					lac: 12345,
					ci: 67890,
					timestamp: '2026-02-12T10:00:00Z'
				}
			];

			const towers = groupIMSIsByTower(imsis, mncToCarrier, mccToCountry, {});

			expect(towers).toEqual([]);
		});

		it('skips IMSIs with missing LAC', () => {
			const imsis: CapturedIMSI[] = [
				{
					imsi: '310410123456789',
					mcc: '310' as any,
					mnc: '410' as any,
					lac: undefined as any,
					ci: 67890,
					timestamp: '2026-02-12T10:00:00Z'
				}
			];

			const towers = groupIMSIsByTower(imsis, mncToCarrier, mccToCountry, {});

			expect(towers).toEqual([]);
		});

		it('skips IMSIs with missing CI', () => {
			const imsis: CapturedIMSI[] = [
				{
					imsi: '310410123456789',
					mcc: '310' as any,
					mnc: '410' as any,
					lac: 12345,
					ci: undefined as any,
					timestamp: '2026-02-12T10:00:00Z'
				}
			];

			const towers = groupIMSIsByTower(imsis, mncToCarrier, mccToCountry, {});

			expect(towers).toEqual([]);
		});

		it('handles TMSI field if present', () => {
			const imsis: CapturedIMSI[] = [
				{
					imsi: '310410123456789',
					tmsi: 'ABCD1234',
					mcc: '310' as any,
					mnc: '410' as any,
					lac: 12345,
					ci: 67890,
					timestamp: '2026-02-12T10:00:00Z'
				}
			];

			const towers = groupIMSIsByTower(imsis, mncToCarrier, mccToCountry, {});

			expect(towers[0].devices[0].tmsi).toBe('ABCD1234');
		});
	});
});

describe('sortTowers', () => {
	const createTower = (overrides: Partial<TowerGroup>): TowerGroup => ({
		mcc: '310',
		mnc: '410',
		mccMnc: '310-410',
		lac: '12345',
		ci: '67890',
		country: { name: 'United States', flag: '🇺🇸', code: 'US' },
		carrier: 'AT&T',
		devices: [],
		count: 1,
		firstSeen: new Date('2026-02-12T10:00:00Z'),
		lastSeen: new Date('2026-02-12T10:00:00Z'),
		isNew: false,
		status: 'ok',
		statusSymbol: '✓',
		location: null,
		...overrides
	});

	describe('sort by carrier', () => {
		it('sorts alphabetically ascending', () => {
			const towers = [
				createTower({ carrier: 'Verizon' }),
				createTower({ carrier: 'AT&T' }),
				createTower({ carrier: 'T-Mobile' })
			];

			const sorted = sortTowers(towers, 'carrier', 'asc');

			expect(sorted.map((t) => t.carrier)).toEqual(['AT&T', 'T-Mobile', 'Verizon']);
		});

		it('sorts alphabetically descending', () => {
			const towers = [
				createTower({ carrier: 'AT&T' }),
				createTower({ carrier: 'T-Mobile' }),
				createTower({ carrier: 'Verizon' })
			];

			const sorted = sortTowers(towers, 'carrier', 'desc');

			expect(sorted.map((t) => t.carrier)).toEqual(['Verizon', 'T-Mobile', 'AT&T']);
		});

		it('sorts case-insensitively', () => {
			const towers = [
				createTower({ carrier: 'verizon' }),
				createTower({ carrier: 'AT&T' }),
				createTower({ carrier: 't-mobile' })
			];

			const sorted = sortTowers(towers, 'carrier', 'asc');

			expect(sorted.map((t) => t.carrier)).toEqual(['AT&T', 't-mobile', 'verizon']);
		});
	});

	describe('sort by country', () => {
		it('sorts by country name ascending', () => {
			const towers = [
				createTower({ country: { name: 'United States', flag: '🇺🇸', code: 'US' } }),
				createTower({ country: { name: 'Canada', flag: '🇨🇦', code: 'CA' } }),
				createTower({ country: { name: 'Mexico', flag: '🇲🇽', code: 'MX' } })
			];

			const sorted = sortTowers(towers, 'country', 'asc');

			expect(sorted.map((t) => t.country.name)).toEqual([
				'Canada',
				'Mexico',
				'United States'
			]);
		});

		it('sorts by country name descending', () => {
			const towers = [
				createTower({ country: { name: 'Canada', flag: '🇨🇦', code: 'CA' } }),
				createTower({ country: { name: 'Mexico', flag: '🇲🇽', code: 'MX' } }),
				createTower({ country: { name: 'United States', flag: '🇺🇸', code: 'US' } })
			];

			const sorted = sortTowers(towers, 'country', 'desc');

			expect(sorted.map((t) => t.country.name)).toEqual([
				'United States',
				'Mexico',
				'Canada'
			]);
		});
	});

	describe('sort by location', () => {
		it('sorts towers with location before towers without', () => {
			const towers = [
				createTower({ location: null }),
				createTower({ location: { lat: 34.0522, lon: -118.2437 } }),
				createTower({ location: null })
			];

			const sorted = sortTowers(towers, 'location', 'desc');

			expect(sorted[0].location).not.toBeNull();
			expect(sorted[1].location).toBeNull();
			expect(sorted[2].location).toBeNull();
		});
	});

	describe('sort by devices', () => {
		it('sorts by device count ascending', () => {
			const towers = [
				createTower({ count: 10 }),
				createTower({ count: 2 }),
				createTower({ count: 25 })
			];

			const sorted = sortTowers(towers, 'devices', 'asc');

			expect(sorted.map((t) => t.count)).toEqual([2, 10, 25]);
		});

		it('sorts by device count descending', () => {
			const towers = [
				createTower({ count: 2 }),
				createTower({ count: 25 }),
				createTower({ count: 10 })
			];

			const sorted = sortTowers(towers, 'devices', 'desc');

			expect(sorted.map((t) => t.count)).toEqual([25, 10, 2]);
		});
	});

	describe('sort by lastSeen', () => {
		it('sorts by timestamp ascending', () => {
			const towers = [
				createTower({ lastSeen: new Date('2026-02-12T10:05:00Z') }),
				createTower({ lastSeen: new Date('2026-02-12T10:00:00Z') }),
				createTower({ lastSeen: new Date('2026-02-12T10:10:00Z') })
			];

			const sorted = sortTowers(towers, 'lastSeen', 'asc');

			expect(sorted[0].lastSeen.toISOString()).toBe('2026-02-12T10:00:00.000Z');
			expect(sorted[1].lastSeen.toISOString()).toBe('2026-02-12T10:05:00.000Z');
			expect(sorted[2].lastSeen.toISOString()).toBe('2026-02-12T10:10:00.000Z');
		});

		it('sorts by timestamp descending', () => {
			const towers = [
				createTower({ lastSeen: new Date('2026-02-12T10:00:00Z') }),
				createTower({ lastSeen: new Date('2026-02-12T10:10:00Z') }),
				createTower({ lastSeen: new Date('2026-02-12T10:05:00Z') })
			];

			const sorted = sortTowers(towers, 'lastSeen', 'desc');

			expect(sorted[0].lastSeen.toISOString()).toBe('2026-02-12T10:10:00.000Z');
			expect(sorted[1].lastSeen.toISOString()).toBe('2026-02-12T10:05:00.000Z');
			expect(sorted[2].lastSeen.toISOString()).toBe('2026-02-12T10:00:00.000Z');
		});
	});

	describe('sort by LAC', () => {
		it('sorts numerically ascending', () => {
			const towers = [
				createTower({ lac: '50000' }),
				createTower({ lac: '1000' }),
				createTower({ lac: '30000' })
			];

			const sorted = sortTowers(towers, 'lac', 'asc');

			expect(sorted.map((t) => t.lac)).toEqual(['1000', '30000', '50000']);
		});

		it('sorts numerically descending', () => {
			const towers = [
				createTower({ lac: '1000' }),
				createTower({ lac: '30000' }),
				createTower({ lac: '50000' })
			];

			const sorted = sortTowers(towers, 'lac', 'desc');

			expect(sorted.map((t) => t.lac)).toEqual(['50000', '30000', '1000']);
		});
	});

	describe('sort by mccMnc', () => {
		it('sorts lexicographically ascending', () => {
			const towers = [
				createTower({ mccMnc: '310-260' }),
				createTower({ mccMnc: '262-01' }),
				createTower({ mccMnc: '310-004' })
			];

			const sorted = sortTowers(towers, 'mccMnc', 'asc');

			expect(sorted.map((t) => t.mccMnc)).toEqual(['262-01', '310-004', '310-260']);
		});

		it('sorts lexicographically descending', () => {
			const towers = [
				createTower({ mccMnc: '262-01' }),
				createTower({ mccMnc: '310-004' }),
				createTower({ mccMnc: '310-260' })
			];

			const sorted = sortTowers(towers, 'mccMnc', 'desc');

			expect(sorted.map((t) => t.mccMnc)).toEqual(['310-260', '310-004', '262-01']);
		});
	});

	describe('immutability', () => {
		it('does not mutate original array', () => {
			const towers = [
				createTower({ count: 10 }),
				createTower({ count: 2 }),
				createTower({ count: 25 })
			];

			const original = [...towers];
			sortTowers(towers, 'devices', 'asc');

			expect(towers).toEqual(original);
		});
	});

	describe('edge cases', () => {
		it('handles empty array', () => {
			const sorted = sortTowers([], 'devices', 'asc');

			expect(sorted).toEqual([]);
		});

		it('handles single tower', () => {
			const towers = [createTower({ count: 10 })];

			const sorted = sortTowers(towers, 'devices', 'asc');

			expect(sorted).toHaveLength(1);
			expect(sorted[0].count).toBe(10);
		});
	});
});
