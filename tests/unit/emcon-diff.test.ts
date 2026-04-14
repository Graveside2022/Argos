/**
 * EMCON diff engine tests — TDD red phase.
 * Per wave-1 brief: 12 required behaviors.
 */
import { describe, expect, it } from 'vitest';

import {
	type Capture,
	diffCaptures,
	type EmitterRow
} from '../../src/lib/server/services/reports/emcon-diff';
import type { CaptureLoadout } from '../../src/lib/server/services/reports/loadout-hash';

const matchedLoadout: CaptureLoadout = {
	sensors: [{ tool: 'kismet' }, { tool: 'hackrf' }]
};

function cap(
	id: string,
	emitters: EmitterRow[],
	loadout: CaptureLoadout = matchedLoadout
): Capture {
	return { id, loadout, emitters };
}

function wifiAp(opts: {
	bssid: string;
	ssid: string | null;
	power: number;
	sensor?: string;
}): EmitterRow {
	return {
		fingerprint_key: `wifi-ap:${opts.bssid}`,
		signal_type: 'wifi-ap',
		identifier: opts.ssid,
		freq_hz: 2_412_000_000,
		power_dbm: opts.power,
		modulation: 'OFDM',
		mgrs: null,
		classification: null,
		source_table: 'networks',
		source_id: opts.bssid,
		bssid: opts.bssid,
		ssid: opts.ssid,
		sensor_tool: opts.sensor ?? 'kismet'
	};
}

function rf(opts: {
	id: string;
	freq: number;
	mod: string;
	power: number;
	sensor?: string;
}): EmitterRow {
	return {
		fingerprint_key: `rf:${opts.id}`,
		signal_type: 'rf',
		identifier: opts.id,
		freq_hz: opts.freq,
		power_dbm: opts.power,
		modulation: opts.mod,
		mgrs: null,
		classification: null,
		source_table: 'signals',
		source_id: opts.id,
		sensor_tool: opts.sensor ?? 'hackrf'
	};
}

function gsm(opts: { key: string; power: number }): EmitterRow {
	return {
		fingerprint_key: `gsm:${opts.key}`,
		signal_type: 'gsm',
		identifier: opts.key,
		freq_hz: 935_000_000,
		power_dbm: opts.power,
		modulation: 'GMSK',
		mgrs: null,
		classification: null,
		source_table: 'signals',
		source_id: opts.key,
		sensor_tool: 'gsm-evil'
	};
}

function bt(opts: { addr: string; power: number }): EmitterRow {
	return {
		fingerprint_key: `bt:${opts.addr}`,
		signal_type: 'bluetooth',
		identifier: opts.addr,
		freq_hz: 2_440_000_000,
		power_dbm: opts.power,
		modulation: 'GFSK',
		mgrs: null,
		classification: null,
		source_table: 'devices',
		source_id: opts.addr,
		sensor_tool: 'kismet'
	};
}

describe('emcon diffCaptures', () => {
	it('matches WiFi APs by BSSID across captures even if SSID changed', () => {
		const baseline = cap('b', [
			wifiAp({ bssid: 'AA:BB:CC:00:00:01', ssid: 'Alpha', power: -50 })
		]);
		const posture = cap('p', [
			wifiAp({ bssid: 'AA:BB:CC:00:00:01', ssid: 'Bravo', power: -50 })
		]);
		const result = diffCaptures(baseline, posture);
		expect(result.new).toHaveLength(0);
		expect(result.missing).toHaveLength(0);
		expect(result.unchanged).toHaveLength(1);
	});

	it('falls back to SSID match when BSSID rotates (MAC randomization)', () => {
		const baseline = cap('b', [
			wifiAp({ bssid: 'AA:BB:CC:00:00:01', ssid: 'FieldAP', power: -50 })
		]);
		const posture = cap('p', [
			wifiAp({ bssid: 'DE:AD:BE:EF:00:01', ssid: 'FieldAP', power: -50 })
		]);
		const result = diffCaptures(baseline, posture);
		expect(result.new).toHaveLength(0);
		expect(result.missing).toHaveLength(0);
		expect(result.unchanged).toHaveLength(1);
	});

	it('matches generic RF within +/-25 kHz frequency bin and same modulation', () => {
		// Spec resolution: generic-RF emitters are identified by a
		// (frequency bucket, modulation) composite key. Rows that fall into
		// the same bucket are a single emitter from the diff engine's point
		// of view — there is no stable per-emitter ID for unlabeled RF, so
		// using distinct frequencies/modulations for the baseline rows below
		// is intentional and necessary for the three independent sub-cases.
		const baseline = cap('b', [
			rf({ id: 'a', freq: 2_400_000_000, mod: 'OFDM', power: -60 }), // near match target
			rf({ id: 'b', freq: 2_401_000_000, mod: 'OFDM', power: -60 }), // will be missing (posture out-of-bin)
			rf({ id: 'c', freq: 2_402_000_000, mod: 'OFDM', power: -60 }) // will be missing (posture wrong-mod)
		]);
		// within 25 kHz of baseline 'a' — matches (unchanged)
		const near = rf({ id: 'a-near', freq: 2_400_000_024, mod: 'OFDM', power: -60 });
		// ~26 kHz away from baseline 'b' bucket — does NOT match
		const far = rf({ id: 'b-far', freq: 2_401_026_000, mod: 'OFDM', power: -60 });
		// same freq as baseline 'c', different modulation — does NOT match
		const wrongMod = rf({ id: 'c-mod', freq: 2_402_000_000, mod: 'FSK', power: -60 });
		const posture = cap('p', [near, far, wrongMod]);
		const result = diffCaptures(baseline, posture);
		// One unchanged (near), two new (far + wrongMod), two missing (b, c).
		expect(result.unchanged).toHaveLength(1);
		expect(result.new).toHaveLength(2);
		expect(result.missing).toHaveLength(2);
	});

	it('matches GSM cells by fingerprint_key (MCC+MNC+LAC+CellID composite)', () => {
		const baseline = cap('b', [gsm({ key: '310-260-1-42', power: -70 })]);
		const posture = cap('p', [gsm({ key: '310-260-1-42', power: -70 })]);
		const result = diffCaptures(baseline, posture);
		expect(result.unchanged).toHaveLength(1);
	});

	it('matches Bluetooth by BD_ADDR exactly', () => {
		const baseline = cap('b', [bt({ addr: '11:22:33:44:55:66', power: -65 })]);
		const posture = cap('p', [
			bt({ addr: '11:22:33:44:55:66', power: -65 }),
			bt({ addr: '99:88:77:66:55:44', power: -65 })
		]);
		const result = diffCaptures(baseline, posture);
		expect(result.unchanged).toHaveLength(1);
		expect(result.new).toHaveLength(1);
	});

	it('classifies +6 dB as NOTABLE (floor) and <6 dB as unchanged', () => {
		const baseline = cap('b', [
			bt({ addr: 'AA:00:00:00:00:01', power: -60 }),
			bt({ addr: 'AA:00:00:00:00:02', power: -60 })
		]);
		const posture = cap('p', [
			bt({ addr: 'AA:00:00:00:00:01', power: -54.1 }), // +5.9 -> unchanged
			bt({ addr: 'AA:00:00:00:00:02', power: -54 }) // +6.0 -> notable
		]);
		const result = diffCaptures(baseline, posture);
		expect(result.unchanged).toHaveLength(1);
		expect(result.notable).toHaveLength(1);
		expect(result.critical).toHaveLength(0);
	});

	it('classifies +15 dB as CRITICAL (floor) and +14.9 as NOTABLE', () => {
		const baseline = cap('b', [
			bt({ addr: 'AA:00:00:00:00:03', power: -60 }),
			bt({ addr: 'AA:00:00:00:00:04', power: -60 })
		]);
		const posture = cap('p', [
			bt({ addr: 'AA:00:00:00:00:03', power: -45.1 }), // +14.9 -> notable
			bt({ addr: 'AA:00:00:00:00:04', power: -45 }) // +15 -> critical
		]);
		const result = diffCaptures(baseline, posture);
		expect(result.notable).toHaveLength(1);
		expect(result.critical).toHaveLength(1);
	});

	it('absolute-values negative power deltas for threshold comparison', () => {
		const baseline = cap('b', [
			bt({ addr: 'AA:00:00:00:00:05', power: -60 }),
			bt({ addr: 'AA:00:00:00:00:06', power: -60 })
		]);
		const posture = cap('p', [
			bt({ addr: 'AA:00:00:00:00:05', power: -67 }), // -7 -> notable
			bt({ addr: 'AA:00:00:00:00:06', power: -76 }) // -16 -> critical
		]);
		const result = diffCaptures(baseline, posture);
		expect(result.notable).toHaveLength(1);
		expect(result.critical).toHaveLength(1);
	});

	it('reports emitters present in posture but not baseline as NEW', () => {
		const baseline = cap('b', []);
		const posture = cap('p', [bt({ addr: 'AA:BB:CC:DD:EE:FF', power: -60 })]);
		const result = diffCaptures(baseline, posture);
		expect(result.new).toHaveLength(1);
		expect(result.missing).toHaveLength(0);
	});

	it('reports emitters present in baseline but not posture as MISSING', () => {
		const baseline = cap('b', [bt({ addr: 'AA:BB:CC:DD:EE:FF', power: -60 })]);
		const posture = cap('p', []);
		const result = diffCaptures(baseline, posture);
		expect(result.missing).toHaveLength(1);
		expect(result.new).toHaveLength(0);
	});

	it('loadout mismatch: diffs only emitters from intersection sensors', () => {
		const baseLoadout: CaptureLoadout = {
			sensors: [{ tool: 'kismet' }, { tool: 'hackrf' }, { tool: 'gsm-evil' }]
		};
		const postLoadout: CaptureLoadout = {
			sensors: [{ tool: 'kismet' }, { tool: 'hackrf' }]
		};
		const baseline = cap(
			'b',
			[
				bt({ addr: 'AA:00:00:00:00:10', power: -60 }), // kismet - kept
				gsm({ key: '310-260-1-99', power: -70 }) // gsm-evil - excluded
			],
			baseLoadout
		);
		const posture = cap('p', [bt({ addr: 'AA:00:00:00:00:10', power: -60 })], postLoadout);
		const result = diffCaptures(baseline, posture);
		expect(result.loadout.matched).toBe(false);
		expect(result.loadout.intersection).toEqual(['hackrf', 'kismet']);
		// The excluded gsm-evil emitter must NOT appear as missing.
		expect(result.missing).toHaveLength(0);
		expect(result.unchanged).toHaveLength(1);
	});

	it('loadout match: runs full diff across all sensors', () => {
		const baseline = cap('b', [
			bt({ addr: 'AA:00:00:00:00:20', power: -60 }),
			rf({ id: 'rf1', freq: 433_000_000, mod: 'ASK', power: -60 })
		]);
		const posture = cap('p', [
			bt({ addr: 'AA:00:00:00:00:20', power: -60 }),
			rf({ id: 'rf1', freq: 433_000_000, mod: 'ASK', power: -60 })
		]);
		const result = diffCaptures(baseline, posture);
		expect(result.loadout.matched).toBe(true);
		expect(result.unchanged).toHaveLength(2);
	});
});
