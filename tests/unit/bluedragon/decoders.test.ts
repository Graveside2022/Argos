import { describe, expect, it } from 'vitest';

import {
	bytesToHex,
	classifyBleAddress,
	decodeAdvertisement,
	decodeAppleContinuity,
	decodeIbeacon,
	decodeMicrosoftCdp,
	hexToBytes,
	phyFromBlueDragonFlag,
	sanitizeLocalName
} from '$lib/server/services/bluedragon/decoders';
import { getLookupTableStats } from '$lib/server/services/bluedragon/lookup-tables';

describe('lookup tables', () => {
	it('loads expected counts', () => {
		const stats = getLookupTableStats();
		expect(stats.companyIds).toBeGreaterThan(3000);
		expect(stats.serviceUuids).toBeGreaterThan(100);
		expect(stats.airpodsModels).toBeGreaterThanOrEqual(20);
		expect(stats.appleTypes).toBeGreaterThanOrEqual(15);
		expect(stats.msCdpTypes).toBeGreaterThanOrEqual(10);
	});
});

describe('hex helpers', () => {
	it('roundtrips bytes', () => {
		const hex = '0e20004c1A';
		const bytes = hexToBytes(hex);
		expect(bytes.length).toBe(5);
		expect(bytesToHex(bytes)).toBe('0E20004C1A');
	});
});

describe('classifyBleAddress', () => {
	it('detects random nonresolvable (MSB 01)', () => {
		expect(classifyBleAddress('7e:be:29:73:a9:b3')).toBe('random_nonresolvable');
	});
	it('detects random static', () => {
		expect(classifyBleAddress('f1:22:33:44:55:66')).toBe('random_static');
	});
	it('detects public (MSB 00)', () => {
		expect(classifyBleAddress('12:34:56:78:9a:bc')).toBe('public');
	});
	it('detects random resolvable (MSB 10)', () => {
		expect(classifyBleAddress('84:fc:fe:12:34:56')).toBe('random_resolvable');
	});
});

describe('sanitizeLocalName', () => {
	it('strips non-printable', () => {
		expect(sanitizeLocalName('Bose\x00Ultra')).toBe('BoseUltra');
	});
	it('returns null for garbage', () => {
		expect(sanitizeLocalName('')).toBeNull();
		expect(sanitizeLocalName('31:11:01:42:4e:b6')).toBeNull();
	});
	it('strips hex suffixes', () => {
		expect(sanitizeLocalName('WLLINK-50DB')).toBe('WLLINK');
	});
});

describe('decodeIbeacon', () => {
	it('parses iBeacon payload', () => {
		const payload = hexToBytes(
			'0215' + 'b9407f30f5f8466eaff925556b57fe6d' + '0001' + '0002' + 'c5'
		);
		const result = decodeIbeacon(payload);
		expect(result).not.toBeNull();
		expect(result?.major).toBe(1);
		expect(result?.minor).toBe(2);
		expect(result?.power).toBe(-59);
		expect(result?.uuid).toMatch(/^b9407f30-f5f8-466e-aff9-25556b57fe6d$/);
	});
	it('rejects non-iBeacon', () => {
		const result = decodeIbeacon(hexToBytes('1006031d407ddf18'));
		expect(result).toBeNull();
	});
});

describe('decodeAppleContinuity', () => {
	it('identifies Nearby Info (0x10)', () => {
		const intel = decodeAppleContinuity(hexToBytes('1006031d407ddf18'));
		expect(intel.vendor).toBe('Apple');
		expect(intel.appleContinuityType).toBe('Nearby Info');
		expect(intel.category).toBe('phone_or_computer');
	});
	it('identifies Find My / AirTag (0x12)', () => {
		const intel = decodeAppleContinuity(
			hexToBytes('12196a1e7bbb1cc9bbbdfbb6f74e3e9db2f2551393b7d0a9cc038b')
		);
		expect(intel.isAirtag).toBe(true);
		expect(intel.category).toBe('tracker');
		expect(intel.product).toContain('Find My');
	});
	it('identifies AirPods Pro model 0x0E20', () => {
		const intel = decodeAppleContinuity(hexToBytes('07190e20020780010f402eb2'));
		expect(intel.product).toBe('AirPods Pro');
		expect(intel.category).toBe('audio_earbud');
	});
	it('identifies AirPods Max model 0x0A20', () => {
		const intel = decodeAppleContinuity(hexToBytes('07190a20020780010f402eb2'));
		expect(intel.product).toBe('AirPods Max');
	});
});

describe('decodeMicrosoftCdp', () => {
	it('identifies Xbox One 0x01', () => {
		const intel = decodeMicrosoftCdp(hexToBytes('0101deadbeef'));
		expect(intel.vendor).toBe('Microsoft');
		expect(intel.product).toBe('Xbox One');
		expect(intel.category).toBe('media');
	});
	it('identifies Windows Laptop 0x0E', () => {
		const intel = decodeMicrosoftCdp(hexToBytes('010Edeadbeef'));
		expect(intel.product).toBe('Windows Laptop');
		expect(intel.category).toBe('computer');
	});
});

describe('decodeAdvertisement', () => {
	it('resolves Apple vendor + type from MSD', () => {
		const intel = decodeAdvertisement({
			manufacturerCompanyId: 0x004c,
			manufacturerData: hexToBytes('10060c1e0fecf32a')
		});
		expect(intel.vendor).toBe('Apple');
		expect(intel.appleContinuityType).toBe('Nearby Info');
	});
	it('uses Bose local name hint', () => {
		const intel = decodeAdvertisement({ localName: 'Bose Open Earbuds Ultra' });
		expect(intel.vendor).toBe('Bose Corporation');
		expect(intel.product).toBe('Bose Open Earbuds Ultra');
		expect(intel.category).toBe('audio_earbud');
	});
	it('resolves Microsoft from company ID 0x0006', () => {
		const intel = decodeAdvertisement({
			manufacturerCompanyId: 0x0006,
			manufacturerData: hexToBytes('010B00')
		});
		expect(intel.vendor).toBe('Microsoft');
		expect(intel.product).toBe('Linux device');
	});
});

describe('phyFromBlueDragonFlag', () => {
	it('maps 0/1/2 to PHY labels', () => {
		expect(phyFromBlueDragonFlag(0)).toBe('LE 1M');
		expect(phyFromBlueDragonFlag(1)).toBe('LE 2M');
		expect(phyFromBlueDragonFlag(2)).toBe('LE Coded');
		expect(phyFromBlueDragonFlag(null)).toBe('unknown');
	});
});
