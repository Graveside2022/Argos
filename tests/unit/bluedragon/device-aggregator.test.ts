import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
	DeviceAggregator,
	type FrameObservation
} from '$lib/server/services/bluedragon/device-aggregator';
import type { BluetoothDevice } from '$lib/types/bluedragon';

function makeFrame(overrides: Partial<FrameObservation> = {}): FrameObservation {
	return {
		addr: '7e:be:29:73:a9:b3',
		timestamp: Date.now(),
		rssi: -60,
		phyFlag: 0,
		bdClassic: false,
		localName: null,
		manufacturerCompanyId: null,
		manufacturerData: null,
		serviceUuids16: [],
		fastPairServiceData: null,
		...overrides
	};
}

describe('DeviceAggregator', () => {
	let broadcast: ReturnType<typeof vi.fn>;
	let agg: DeviceAggregator;

	beforeEach(() => {
		broadcast = vi.fn();
		agg = new DeviceAggregator((op, device) => broadcast(op, device));
	});

	it('creates device on first frame', () => {
		agg.ingest(makeFrame());
		expect(agg.getDeviceCount()).toBe(1);
		expect(broadcast).toHaveBeenCalledWith(
			'upsert',
			expect.objectContaining({ packetCount: 1 })
		);
	});

	it('updates existing device on repeat frame', () => {
		const t0 = Date.now();
		agg.ingest(makeFrame({ timestamp: t0, rssi: -60 }));
		agg.ingest(makeFrame({ timestamp: t0 + 100, rssi: -50 }));
		const snapshot = agg.getSnapshot();
		expect(snapshot).toHaveLength(1);
		const dev = snapshot[0] as BluetoothDevice;
		expect(dev.packetCount).toBe(2);
		expect(dev.rssiMax).toBe(-50);
		expect(dev.rssiMin).toBe(-60);
		expect(dev.rssiAvg).toBeLessThan(-50);
	});

	it('merges service UUIDs as a set', () => {
		agg.ingest(makeFrame({ serviceUuids16: ['FEBE'] }));
		agg.ingest(makeFrame({ serviceUuids16: ['FCB2', 'FEBE'] }));
		const dev = agg.getSnapshot()[0];
		expect(new Set(dev.services)).toEqual(new Set(['FEBE', 'FCB2']));
	});

	it('debounces broadcasts inside 500 ms window', () => {
		const t0 = Date.now();
		agg.ingest(makeFrame({ timestamp: t0, rssi: -60 }));
		broadcast.mockClear();
		agg.ingest(makeFrame({ timestamp: t0 + 100, rssi: -59 }));
		agg.ingest(makeFrame({ timestamp: t0 + 200, rssi: -58 }));
		expect(broadcast).not.toHaveBeenCalled();
		agg.ingest(makeFrame({ timestamp: t0 + 600, rssi: -57 }));
		expect(broadcast).toHaveBeenCalledTimes(1);
	});

	it('reset clears state and emits removes', () => {
		agg.ingest(makeFrame());
		agg.ingest(makeFrame({ addr: 'ab:cd:ef:12:34:56' }));
		broadcast.mockClear();
		agg.reset();
		expect(agg.getDeviceCount()).toBe(0);
		expect(broadcast).toHaveBeenCalledWith('remove', expect.any(Object));
	});

	it('classifies BLE advertising address type', () => {
		agg.ingest(makeFrame({ addr: '9e:be:29:73:a9:b3' }));
		expect(agg.getSnapshot()[0].addrType).toBe('random_resolvable');
	});

	it('marks Classic BT frames', () => {
		agg.ingest(makeFrame({ addr: '00:de:ad:be:00:00', bdClassic: true, phyFlag: null }));
		const dev = agg.getSnapshot()[0];
		expect(dev.bdClassic).toBe(true);
		expect(dev.phy).toBe('BR/EDR');
		expect(dev.addrType).toBe('classic_lap');
	});
});
