import airpodsData from './data/airpods-models.json' with { type: 'json' };
import appleContinuityData from './data/apple-continuity-types.json' with { type: 'json' };
import companyIds from './data/company-ids.json' with { type: 'json' };
import fastPairData from './data/fast-pair-models.json' with { type: 'json' };
import ieeeOuiData from './data/ieee-oui.json' with { type: 'json' };
import msCdpData from './data/ms-cdp-devices.json' with { type: 'json' };
import samsungData from './data/samsung-device-types.json' with { type: 'json' };
import serviceUuids from './data/service-uuids.json' with { type: 'json' };
import xiaomiData from './data/xiaomi-device-types.json' with { type: 'json' };

interface RawCompanyEntry {
	code: number;
	name: string;
}

interface RawServiceEntry {
	uuid: string;
	name: string;
	identifier?: string;
	source?: string;
}

interface AirpodsData {
	comment?: string;
	models: Record<string, string>;
}

interface AppleContinuityEntry {
	name: string;
	category: string;
	description: string;
}

interface AppleContinuityData {
	comment?: string;
	types: Record<string, AppleContinuityEntry>;
}

interface MsCdpData {
	comment?: string;
	deviceTypes: Record<string, string>;
}

const companyIdMap: Map<number, string> = new Map(
	(companyIds as RawCompanyEntry[]).map((entry) => [entry.code, entry.name])
);

const serviceUuidMap: Map<string, string> = new Map(
	(serviceUuids as RawServiceEntry[]).map((entry) => [entry.uuid.toUpperCase(), entry.name])
);

const airpodsModelMap: Map<string, string> = new Map(
	Object.entries((airpodsData as AirpodsData).models).map(([k, v]) => [k.toUpperCase(), v])
);

const appleContinuityMap: Map<string, AppleContinuityEntry> = new Map(
	Object.entries((appleContinuityData as AppleContinuityData).types).map(([k, v]) => [
		k.toUpperCase(),
		v
	])
);

const msCdpMap: Map<string, string> = new Map(
	Object.entries((msCdpData as MsCdpData).deviceTypes).map(([k, v]) => [k.toUpperCase(), v])
);

const ieeeOuiMap: Map<string, string> = new Map(
	Object.entries(ieeeOuiData as Record<string, string>).map(([k, v]) => [k.toUpperCase(), v])
);

const xiaomiDeviceMap: Map<string, string> = new Map(
	Object.entries(xiaomiData as Record<string, string>).map(([k, v]) => [k.toUpperCase(), v])
);

const samsungDeviceMap: Map<string, string> = new Map(
	Object.entries(samsungData as Record<string, string>).map(([k, v]) => [k.toUpperCase(), v])
);

const fastPairMap: Map<string, string> = new Map(
	Object.entries(fastPairData as Record<string, string>).map(([k, v]) => [k.toUpperCase(), v])
);

export function lookupVendor(companyId: number): string | null {
	return companyIdMap.get(companyId) ?? null;
}

export function lookupServiceUuid16(uuid: string): string | null {
	return serviceUuidMap.get(uuid.toUpperCase().padStart(4, '0')) ?? null;
}

export function lookupAirpodsModel(hexId: string): string | null {
	return airpodsModelMap.get(hexId.toUpperCase()) ?? null;
}

export function lookupAppleContinuity(typeByte: string): AppleContinuityEntry | null {
	return appleContinuityMap.get(typeByte.toUpperCase()) ?? null;
}

export function lookupMsCdpDeviceType(typeByte: string): string | null {
	return msCdpMap.get(typeByte.toUpperCase()) ?? null;
}

export function lookupOuiVendor(mac: string): string | null {
	const clean = mac.replace(/[:-]/g, '').toUpperCase().slice(0, 6);
	return ieeeOuiMap.get(clean) ?? null;
}

export function lookupXiaomiDevice(typeHex: string): string | null {
	return xiaomiDeviceMap.get(typeHex.toUpperCase()) ?? null;
}

export function lookupSamsungDevice(typeByte: string): string | null {
	return samsungDeviceMap.get(typeByte.toUpperCase()) ?? null;
}

export function lookupFastPairModel(modelId: string): string | null {
	return fastPairMap.get(modelId.toUpperCase()) ?? null;
}

interface LookupTableStats {
	companyIds: number;
	serviceUuids: number;
	airpodsModels: number;
	appleTypes: number;
	msCdpTypes: number;
	ieeeOui: number;
	xiaomiDevices: number;
	samsungDevices: number;
	fastPairModels: number;
}

export function getLookupTableStats(): LookupTableStats {
	return {
		companyIds: companyIdMap.size,
		serviceUuids: serviceUuidMap.size,
		airpodsModels: airpodsModelMap.size,
		appleTypes: appleContinuityMap.size,
		msCdpTypes: msCdpMap.size,
		ieeeOui: ieeeOuiMap.size,
		xiaomiDevices: xiaomiDeviceMap.size,
		samsungDevices: samsungDeviceMap.size,
		fastPairModels: fastPairMap.size
	};
}
