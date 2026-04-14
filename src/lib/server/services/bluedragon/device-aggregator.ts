import type { BluetoothAddrType, BluetoothDevice, BluetoothPhy } from '$lib/types/bluedragon';

import { classifyBleAddress, decodeAdvertisement, phyFromBlueDragonFlag } from './decoders';

export interface FrameObservation {
	addr: string;
	addrType?: BluetoothAddrType;
	timestamp: number;
	rssi: number | null;
	phyFlag: number | null;
	bdClassic: boolean;
	localName?: string | null;
	manufacturerCompanyId?: number | null;
	manufacturerData?: Uint8Array | null;
	serviceUuids16?: string[];
	fastPairServiceData?: Uint8Array | null;
}

export interface BroadcastFn {
	(op: 'upsert' | 'remove', device: BluetoothDevice): void;
}

const PRUNE_INTERVAL_MS = 60_000;
const PRUNE_MAX_AGE_MS = 5 * 60_000;
const MIN_BROADCAST_INTERVAL_MS = 500;

interface Throttle {
	lastBroadcast: number;
	dirty: boolean;
}

function resolveAddrType(frame: FrameObservation, addr: string): BluetoothAddrType {
	if (frame.addrType) return frame.addrType;
	if (frame.bdClassic) return 'classic_lap';
	return classifyBleAddress(addr);
}

function resolvePhy(frame: FrameObservation): BluetoothPhy {
	if (frame.bdClassic) return 'BR/EDR';
	return phyFromBlueDragonFlag(frame.phyFlag);
}

function buildIntelFromFrame(frame: FrameObservation): ReturnType<typeof decodeAdvertisement> {
	return decodeAdvertisement({
		localName: frame.localName,
		manufacturerCompanyId: frame.manufacturerCompanyId,
		manufacturerData: frame.manufacturerData,
		serviceUuids16: frame.serviceUuids16,
		fastPairServiceData: frame.fastPairServiceData
	});
}

function updateRssiBounds(device: BluetoothDevice, rssi: number): void {
	const newMin = device.rssiMin == null || rssi < device.rssiMin;
	const newMax = device.rssiMax == null || rssi > device.rssiMax;
	if (newMin) device.rssiMin = rssi;
	if (newMax) device.rssiMax = rssi;
}

function updateRssiAvg(device: BluetoothDevice, rssi: number): void {
	device.rssiAvg =
		device.rssiAvg == null ? rssi : Math.round((device.rssiAvg * 0.9 + rssi * 0.1) * 10) / 10;
}

function updateRssi(device: BluetoothDevice, rssi: number | null): void {
	if (rssi == null) return;
	updateRssiBounds(device, rssi);
	updateRssiAvg(device, rssi);
}

function mergeServices(device: BluetoothDevice, newUuids: string[] | undefined): void {
	if (!newUuids || newUuids.length === 0) return;
	const set = new Set([...device.services, ...newUuids.map((u) => u.toUpperCase())]);
	device.services = Array.from(set);
}

function hasNewIntelInput(frame: FrameObservation): boolean {
	return Boolean(frame.localName ?? frame.manufacturerData ?? frame.fastPairServiceData);
}

function needsIntelRefresh(device: BluetoothDevice): boolean {
	return !device.vendor || !device.product || device.category === 'unknown';
}

function fillIfMissing<K extends keyof BluetoothDevice>(
	device: BluetoothDevice,
	key: K,
	value: BluetoothDevice[K] | null | undefined
): void {
	if (device[key] != null && device[key] !== '') return;
	if (value == null) return;
	device[key] = value;
}

function applyIntelToDevice(
	device: BluetoothDevice,
	intel: ReturnType<typeof decodeAdvertisement>
): void {
	fillIfMissing(device, 'vendor', intel.vendor);
	fillIfMissing(device, 'product', intel.product);
	if (device.category === 'unknown' && intel.category !== 'unknown') {
		device.category = intel.category;
	}
	if (intel.isIbeacon) device.isIbeacon = true;
	if (intel.isAirtag) device.isAirtag = true;
	fillIfMissing(device, 'appleContinuityType', intel.appleContinuityType);
}

export class DeviceAggregator {
	private devices = new Map<string, BluetoothDevice>();
	private throttles = new Map<string, Throttle>();
	private broadcast: BroadcastFn;
	private pruneTimer: ReturnType<typeof setInterval> | null = null;
	private packetCount = 0;

	constructor(broadcast: BroadcastFn) {
		this.broadcast = broadcast;
	}

	start(): void {
		if (this.pruneTimer) return;
		this.pruneTimer = setInterval(() => this.pruneStale(), PRUNE_INTERVAL_MS);
	}

	stop(): void {
		if (this.pruneTimer) {
			clearInterval(this.pruneTimer);
			this.pruneTimer = null;
		}
	}

	reset(): void {
		for (const device of this.devices.values()) {
			this.broadcast('remove', device);
		}
		this.devices.clear();
		this.throttles.clear();
		this.packetCount = 0;
	}

	getDeviceCount(): number {
		return this.devices.size;
	}

	getPacketCount(): number {
		return this.packetCount;
	}

	getSnapshot(): BluetoothDevice[] {
		return Array.from(this.devices.values());
	}

	ingest(frame: FrameObservation): void {
		this.packetCount++;
		const addr = frame.addr.toLowerCase();
		const existing = this.devices.get(addr);

		if (!existing) {
			const device = this.createDevice(addr, frame);
			this.devices.set(addr, device);
			this.broadcast('upsert', device);
			this.throttles.set(addr, { lastBroadcast: frame.timestamp, dirty: false });
			return;
		}

		this.updateExisting(existing, frame);
		this.maybeBroadcast(addr, frame.timestamp);
	}

	private createDevice(addr: string, frame: FrameObservation): BluetoothDevice {
		const intel = buildIntelFromFrame(frame);
		return {
			addr,
			addrType: resolveAddrType(frame, addr),
			firstSeen: frame.timestamp,
			lastSeen: frame.timestamp,
			packetCount: 1,
			rssiAvg: frame.rssi,
			rssiMin: frame.rssi,
			rssiMax: frame.rssi,
			vendor: intel.vendor,
			product: intel.product,
			category: intel.category,
			phy: resolvePhy(frame),
			services: frame.serviceUuids16
				? [...new Set(frame.serviceUuids16.map((u) => u.toUpperCase()))]
				: [],
			isIbeacon: intel.isIbeacon,
			isAirtag: intel.isAirtag,
			appleContinuityType: intel.appleContinuityType,
			bdClassic: frame.bdClassic
		};
	}

	private updateExisting(device: BluetoothDevice, frame: FrameObservation): void {
		device.lastSeen = frame.timestamp;
		device.packetCount++;
		updateRssi(device, frame.rssi);
		mergeServices(device, frame.serviceUuids16);

		if (hasNewIntelInput(frame) && needsIntelRefresh(device)) {
			applyIntelToDevice(device, buildIntelFromFrame(frame));
		}

		const throttle = this.throttles.get(device.addr);
		if (throttle) throttle.dirty = true;
	}

	private maybeBroadcast(addr: string, now: number): void {
		const throttle = this.throttles.get(addr);
		const device = this.devices.get(addr);
		if (!throttle || !device || !throttle.dirty) return;
		if (now - throttle.lastBroadcast < MIN_BROADCAST_INTERVAL_MS) return;
		this.broadcast('upsert', device);
		throttle.lastBroadcast = now;
		throttle.dirty = false;
	}

	private pruneStale(): void {
		const now = Date.now();
		for (const [addr, device] of this.devices) {
			if (now - device.lastSeen > PRUNE_MAX_AGE_MS) {
				this.devices.delete(addr);
				this.throttles.delete(addr);
				this.broadcast('remove', device);
			}
		}
	}
}
