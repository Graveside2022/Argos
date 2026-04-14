import type { BluetoothAddrType, BluetoothCategory, BluetoothPhy } from '$lib/types/bluedragon';

import {
	lookupAirpodsModel,
	lookupAppleContinuity,
	lookupFastPairModel,
	lookupMsCdpDeviceType,
	lookupOuiVendor,
	lookupSamsungDevice,
	lookupServiceUuid16,
	lookupVendor,
	lookupXiaomiDevice
} from './lookup-tables';

export interface DecodedIntel {
	vendor: string | null;
	product: string | null;
	category: BluetoothCategory;
	isIbeacon: boolean;
	isAirtag: boolean;
	appleContinuityType: string | null;
}

const EMPTY: DecodedIntel = {
	vendor: null,
	product: null,
	category: 'unknown',
	isIbeacon: false,
	isAirtag: false,
	appleContinuityType: null
};

export function hexToBytes(hex: string): Uint8Array {
	const clean = hex.replace(/[^0-9a-fA-F]/g, '');
	const out = new Uint8Array(clean.length / 2);
	for (let i = 0; i < out.length; i++) {
		out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
	}
	return out;
}

export function bytesToHex(bytes: Uint8Array): string {
	return Array.from(bytes, (b) => b.toString(16).padStart(2, '0'))
		.join('')
		.toUpperCase();
}

const ADDR_TYPE_BY_TOP_BITS: Record<number, BluetoothAddrType> = {
	0b11: 'random_static',
	0b01: 'random_resolvable',
	0b00: 'random_nonresolvable'
};

export function classifyBleAddress(addr: string): BluetoothAddrType {
	const first = parseInt(addr.slice(0, 2), 16);
	if (Number.isNaN(first)) return 'unknown';
	const topTwoBits = (first >> 6) & 0x03;
	return ADDR_TYPE_BY_TOP_BITS[topTwoBits] ?? 'public';
}

function stripToPrintable(raw: string): string {
	return raw.replace(/[^\x20-\x7e]/g, '').trim();
}

export function sanitizeLocalName(raw: string | null | undefined): string | null {
	if (!raw) return null;
	const printable = stripToPrintable(raw);
	if (printable.length < 2) return null;
	if (/^[0-9a-fA-F:]+$/.test(printable)) return null;
	return printable.replace(/[-_][0-9A-Fa-f]{4,12}$/, '').trim() || null;
}

interface NameRule {
	match: RegExp;
	product: (name: string) => string;
	category: BluetoothCategory;
	vendor: string;
}

const NAME_RULES: NameRule[] = [
	{
		match: /^le-bose|^bose\b/i,
		product: (n) => n,
		category: 'audio_earbud',
		vendor: 'Bose Corporation'
	},
	{ match: /openfit|shokz/i, product: (n) => n, category: 'audio_earbud', vendor: 'Shokz' },
	{ match: /airpods/i, product: (n) => n, category: 'audio_earbud', vendor: 'Apple' },
	{ match: /^tile_/i, product: (n) => n, category: 'tracker', vendor: 'Tile' },
	{ match: /mi\s*band|amazfit/i, product: (n) => n, category: 'wearable', vendor: 'Xiaomi' },
	{ match: /galaxy\s*buds/i, product: (n) => n, category: 'audio_earbud', vendor: 'Samsung' },
	{ match: /galaxy\s*watch/i, product: (n) => n, category: 'wearable', vendor: 'Samsung' },
	{ match: /pixel\s*buds/i, product: (n) => n, category: 'audio_earbud', vendor: 'Google' },
	{ match: /sonos/i, product: (n) => n, category: 'audio_speaker', vendor: 'Sonos' },
	{ match: /hue\s/i, product: (n) => n, category: 'iot', vendor: 'Philips' },
	{ match: /tesla\s*model/i, product: (n) => n, category: 'vehicle', vendor: 'Tesla' }
];

export function classifyFromLocalName(
	name: string
): { product: string; category: BluetoothCategory; vendor?: string } | null {
	for (const rule of NAME_RULES) {
		if (rule.match.test(name)) {
			return { product: rule.product(name), category: rule.category, vendor: rule.vendor };
		}
	}
	return null;
}

const SERVICE_UUID_CATEGORY: Record<string, BluetoothCategory> = {
	'180D': 'wearable',
	'180F': 'wearable',
	'1812': 'peripheral',
	'181A': 'sensor',
	'1826': 'wearable',
	'1805': 'wearable',
	FEAA: 'beacon',
	FCF1: 'audio_earbud',
	FEF3: 'audio_earbud',
	FE2C: 'audio_earbud',
	FEBE: 'audio_earbud',
	FCB2: 'audio_earbud',
	FDAB: 'audio_earbud',
	FD5A: 'phone',
	FD92: 'phone'
};

export function categoryFromServiceUuid(uuid: string): BluetoothCategory | null {
	const u = uuid.toUpperCase().padStart(4, '0');
	return SERVICE_UUID_CATEGORY[u] ?? null;
}

export function decodeIbeacon(
	msdBytes: Uint8Array
): { uuid: string; major: number; minor: number; power: number } | null {
	if (msdBytes.length < 23) return null;
	if (msdBytes[0] !== 0x02 || msdBytes[1] !== 0x15) return null;
	const uuidBytes = msdBytes.slice(2, 18);
	const uuid = bytesToHex(uuidBytes)
		.toLowerCase()
		.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
	const major = (msdBytes[18] << 8) | msdBytes[19];
	const minor = (msdBytes[20] << 8) | msdBytes[21];
	const power = msdBytes[22] > 127 ? msdBytes[22] - 256 : msdBytes[22];
	return { uuid, major, minor, power };
}

function applyIbeaconOverlay(result: DecodedIntel, msdBytes: Uint8Array): void {
	const beacon = decodeIbeacon(msdBytes);
	if (!beacon) return;
	result.isIbeacon = true;
	result.category = 'beacon';
	result.product = `iBeacon ${beacon.uuid.slice(0, 8)}… maj=${beacon.major} min=${beacon.minor}`;
}

function applyAirtagOverlay(result: DecodedIntel): void {
	result.isAirtag = true;
	result.category = 'tracker';
	result.product = 'Find My / AirTag';
}

function applyAirPodsModel(result: DecodedIntel, msdBytes: Uint8Array): void {
	if (msdBytes.length < 4) return;
	const modelHex =
		msdBytes[2].toString(16).padStart(2, '0').toUpperCase() +
		msdBytes[3].toString(16).padStart(2, '0').toUpperCase();
	const model = lookupAirpodsModel(modelHex);
	if (!model) return;
	result.product = model;
	result.category = 'audio_earbud';
}

const IBEACON_TYPES = new Set(['01', '02']);
const AIRTAG_TYPES = new Set(['11', '12']);

function buildAppleBaseline(typeByte: string): DecodedIntel {
	const entry = lookupAppleContinuity(typeByte);
	return {
		vendor: 'Apple',
		product: null,
		category: (entry?.category as BluetoothCategory) ?? 'phone_or_computer',
		isIbeacon: false,
		isAirtag: false,
		appleContinuityType: entry?.name ?? `Unknown 0x${typeByte}`
	};
}

export function decodeAppleContinuity(msdBytes: Uint8Array): DecodedIntel {
	if (msdBytes.length < 1) return { ...EMPTY, vendor: 'Apple' };
	const typeByte = msdBytes[0].toString(16).padStart(2, '0').toUpperCase();
	const result = buildAppleBaseline(typeByte);

	if (IBEACON_TYPES.has(typeByte)) applyIbeaconOverlay(result, msdBytes);
	if (AIRTAG_TYPES.has(typeByte)) applyAirtagOverlay(result);
	if (typeByte === '07') applyAirPodsModel(result, msdBytes);

	return result;
}

const MS_CDP_CATEGORY_PATTERNS: [RegExp, BluetoothCategory][] = [
	[/xbox/i, 'media'],
	[/iphone|android|phone/i, 'phone'],
	[/ipad|tablet|duo/i, 'computer'],
	[/surface|laptop|desktop|server|book/i, 'computer'],
	[/hololens/i, 'wearable'],
	[/iot/i, 'iot']
];

function msCdpCategoryFromLabel(label: string): BluetoothCategory {
	for (const [pattern, category] of MS_CDP_CATEGORY_PATTERNS) {
		if (pattern.test(label)) return category;
	}
	return 'unknown';
}

export function decodeMicrosoftCdp(msdBytes: Uint8Array): DecodedIntel {
	const result: DecodedIntel = { ...EMPTY, vendor: 'Microsoft' };
	if (msdBytes.length < 2 || msdBytes[0] !== 0x01) return result;
	const deviceTypeHex = msdBytes[1].toString(16).padStart(2, '0').toUpperCase();
	const label = lookupMsCdpDeviceType(deviceTypeHex);
	if (!label) return result;
	result.product = label;
	result.category = msCdpCategoryFromLabel(label);
	return result;
}

export function decodeFastPair(serviceDataBytes: Uint8Array): DecodedIntel {
	const result: DecodedIntel = { ...EMPTY, vendor: 'Google', category: 'audio_earbud' };
	if (serviceDataBytes.length < 3) return result;
	const modelId = bytesToHex(serviceDataBytes.slice(0, 3));
	const knownModel = lookupFastPairModel(modelId);
	result.product = knownModel ?? `Fast Pair 0x${modelId}`;
	return result;
}

export interface DecodeInput {
	addr?: string | null;
	localName?: string | null;
	manufacturerCompanyId?: number | null;
	manufacturerData?: Uint8Array | null;
	serviceUuids16?: string[];
	fastPairServiceData?: Uint8Array | null;
}

function applyVendorLookup(best: DecodedIntel, companyId: number | null | undefined): void {
	if (companyId == null) return;
	const vendor = lookupVendor(companyId);
	if (vendor) best.vendor = vendor;
}

export function decodeXiaomiBeacon(msdBytes: Uint8Array): DecodedIntel {
	const result: DecodedIntel = { ...EMPTY, vendor: 'Xiaomi' };
	if (msdBytes.length < 5) return result;
	const deviceType = ((msdBytes[3] << 8) | msdBytes[2])
		.toString(16)
		.toUpperCase()
		.padStart(4, '0');
	const model = lookupXiaomiDevice(deviceType);
	if (model) result.product = model;
	result.category = 'iot';
	return result;
}

export function decodeSamsungBle(msdBytes: Uint8Array): DecodedIntel {
	const result: DecodedIntel = { ...EMPTY, vendor: 'Samsung' };
	if (msdBytes.length < 2) return result;
	const typeByte = msdBytes[0].toString(16).toUpperCase().padStart(2, '0');
	const model = lookupSamsungDevice(typeByte);
	if (model) {
		result.product = model;
		result.category = inferSamsungCategory(model);
	}
	return result;
}

const SAMSUNG_CATEGORY_PATTERNS: [RegExp, BluetoothCategory][] = [
	[/buds/i, 'audio_earbud'],
	[/watch/i, 'wearable'],
	[/tag/i, 'tracker'],
	[/ring/i, 'wearable'],
	[/fit/i, 'wearable']
];

function inferSamsungCategory(model: string): BluetoothCategory {
	for (const [pattern, cat] of SAMSUNG_CATEGORY_PATTERNS) {
		if (pattern.test(model)) return cat;
	}
	return 'phone_or_computer';
}

const MSD_DECODERS: Record<number, (data: Uint8Array) => DecodedIntel> = {
	0x004c: decodeAppleContinuity,
	0x0006: decodeMicrosoftCdp,
	0x038f: decodeXiaomiBeacon,
	0x0075: decodeSamsungBle
};

function applyManufacturerData(best: DecodedIntel, input: DecodeInput): DecodedIntel {
	if (!input.manufacturerData || input.manufacturerCompanyId == null) return best;
	const decoder = MSD_DECODERS[input.manufacturerCompanyId];
	if (!decoder) return best;
	return mergeIntel(best, decoder(input.manufacturerData));
}

function applyServiceUuidCategory(best: DecodedIntel, uuid: string): void {
	if (best.category !== 'unknown') return;
	const cat = categoryFromServiceUuid(uuid);
	if (cat) best.category = cat;
}

function applyServiceUuidName(best: DecodedIntel, uuid: string): void {
	if (best.product) return;
	const svcName = lookupServiceUuid16(uuid);
	if (svcName) best.product = svcName;
}

function applyServiceUuids(best: DecodedIntel, uuids: string[] | undefined): void {
	if (!uuids) return;
	for (const uuid of uuids) {
		applyServiceUuidCategory(best, uuid);
		applyServiceUuidName(best, uuid);
	}
}

function applyLocalNameHint(best: DecodedIntel, localName: string | null | undefined): void {
	const sanitized = sanitizeLocalName(localName);
	if (!sanitized) return;
	const hint = classifyFromLocalName(sanitized);
	if (hint) {
		applyNameRuleHint(best, hint);
		return;
	}
	if (!best.product) best.product = sanitized;
}

function shouldOverrideProduct(current: string | null): boolean {
	return !current || current.startsWith('Fast Pair');
}

function applyNameRuleHint(
	best: DecodedIntel,
	hint: { product: string; category: BluetoothCategory; vendor?: string }
): void {
	if (!best.vendor) best.vendor = hint.vendor ?? null;
	if (shouldOverrideProduct(best.product)) best.product = hint.product;
	if (best.category === 'unknown') best.category = hint.category;
}

function applyOuiVendorFallback(best: DecodedIntel, addr: string | null | undefined): void {
	if (best.vendor || !addr) return;
	const ouiVendor = lookupOuiVendor(addr);
	if (ouiVendor) best.vendor = ouiVendor;
}

export function decodeAdvertisement(input: DecodeInput): DecodedIntel {
	let best: DecodedIntel = { ...EMPTY };

	applyVendorLookup(best, input.manufacturerCompanyId);
	best = applyManufacturerData(best, input);

	if (input.fastPairServiceData) {
		best = mergeIntel(best, decodeFastPair(input.fastPairServiceData));
	}

	applyServiceUuids(best, input.serviceUuids16);
	applyLocalNameHint(best, input.localName);
	applyOuiVendorFallback(best, input.addr);

	return best;
}

function mergedCategory(base: DecodedIntel, incoming: DecodedIntel): BluetoothCategory {
	return incoming.category !== 'unknown' ? incoming.category : base.category;
}

function mergeBooleans(
	base: DecodedIntel,
	incoming: DecodedIntel
): { isIbeacon: boolean; isAirtag: boolean } {
	return {
		isIbeacon: base.isIbeacon || incoming.isIbeacon,
		isAirtag: base.isAirtag || incoming.isAirtag
	};
}

function mergeIntel(base: DecodedIntel, incoming: DecodedIntel): DecodedIntel {
	return {
		vendor: incoming.vendor ?? base.vendor,
		product: incoming.product ?? base.product,
		category: mergedCategory(base, incoming),
		...mergeBooleans(base, incoming),
		appleContinuityType: incoming.appleContinuityType ?? base.appleContinuityType
	};
}

export function phyFromBlueDragonFlag(flag: number | null | undefined): BluetoothPhy {
	if (flag == null) return 'unknown';
	if (flag === 0) return 'LE 1M';
	if (flag === 1) return 'LE 2M';
	if (flag === 2) return 'LE Coded';
	return 'unknown';
}
