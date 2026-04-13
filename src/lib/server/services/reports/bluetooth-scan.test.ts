/**
 * bluetooth-scan unit tests.
 *
 * Mocks `execFileAsync` so we can feed canned `rfkill` + `bluetoothctl`
 * output into `checkBluetoothAdapter` / `scanBluetooth` and verify the
 * skip-path + happy-path behavior.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/exec', () => ({
	execFileAsync: vi.fn()
}));

import { execFileAsync } from '$lib/server/exec';

import { checkBluetoothAdapter, scanBluetooth } from './bluetooth-scan';

type ExecResult = { stdout: string; stderr: string };
type ExecCall = { file: string; args: readonly string[] };

const mockExec = execFileAsync as unknown as ReturnType<typeof vi.fn>;

function stub(responses: Array<(call: ExecCall) => ExecResult | Error>): ExecCall[] {
	const calls: ExecCall[] = [];
	let i = 0;
	mockExec.mockImplementation(async (file: string, args: readonly string[] = []) => {
		const call = { file, args };
		calls.push(call);
		const handler = responses[Math.min(i, responses.length - 1)];
		i++;
		const result = handler(call);
		if (result instanceof Error) throw result;
		return result;
	});
	return calls;
}

describe('checkBluetoothAdapter', () => {
	beforeEach(() => {
		mockExec.mockReset();
	});

	it('returns powered=true when rfkill clean and bluetoothctl shows Powered: yes', async () => {
		stub([
			() => ({
				stdout: 'ID TYPE     DEVICE  SOFT     HARD\n 0 bluetooth hci0  unblocked unblocked\n  Soft blocked: no\n  Hard blocked: no\n',
				stderr: ''
			}),
			() => ({
				stdout: 'Controller AA:BB:CC:DD:EE:FF (public)\n\tName: my-pi\n\tPowered: yes\n\tDiscoverable: no\n',
				stderr: ''
			})
		]);
		const status = await checkBluetoothAdapter();
		expect(status.available).toBe(true);
		expect(status.powered).toBe(true);
		expect(status.address).toBe('AA:BB:CC:DD:EE:FF');
		expect(status.reason).toBeNull();
	});

	it('returns powered=false with "adapter powered down" when controller present but off', async () => {
		stub([
			() => ({
				stdout: '0 bluetooth hci0\n  Soft blocked: no\n  Hard blocked: no\n',
				stderr: ''
			}),
			() => ({
				stdout: 'Controller 11:22:33:44:55:66 (public)\n\tPowered: no\n',
				stderr: ''
			})
		]);
		const status = await checkBluetoothAdapter();
		expect(status.available).toBe(false);
		expect(status.powered).toBe(false);
		expect(status.reason).toBe('adapter powered down');
	});

	it('reports soft-blocked reason when rfkill blocks and power-on fails', async () => {
		stub([
			() => ({
				stdout: '0 bluetooth hci0\n  Soft blocked: yes\n  Hard blocked: no\n',
				stderr: ''
			}),
			() => ({
				stdout: 'Controller 11:22:33:44:55:66 (public)\n\tPowered: no\n',
				stderr: ''
			})
		]);
		const status = await checkBluetoothAdapter();
		expect(status.powered).toBe(false);
		expect(status.reason).toBe('soft-blocked and power-on failed');
	});

	it('reports "no Bluetooth controller present" when bluetoothctl has no default controller', async () => {
		stub([
			() => ({ stdout: '', stderr: '' }),
			() => ({ stdout: 'No default controller available\n', stderr: '' })
		]);
		const status = await checkBluetoothAdapter();
		expect(status.available).toBe(false);
		expect(status.reason).toBe('no Bluetooth controller present');
	});
});

describe('scanBluetooth', () => {
	beforeEach(() => {
		mockExec.mockReset();
	});

	afterEach(() => {
		mockExec.mockReset();
	});

	it('returns [] and never calls scan on when adapter is powered down and recovery fails', async () => {
		const calls = stub([
			// First checkBluetoothAdapter: rfkill + show (not powered)
			() => ({ stdout: '0 bluetooth\n  Soft blocked: no\n', stderr: '' }),
			() => ({ stdout: 'Controller AA:BB:CC:DD:EE:FF\n\tPowered: no\n', stderr: '' }),
			// tryPowerOnBluetooth: rfkill unblock + power on
			() => ({ stdout: '', stderr: '' }),
			() => ({ stdout: '', stderr: '' }),
			// Re-check inside tryPowerOnBluetooth
			() => ({ stdout: '0 bluetooth\n  Soft blocked: no\n', stderr: '' }),
			() => ({ stdout: 'Controller AA:BB:CC:DD:EE:FF\n\tPowered: no\n', stderr: '' })
		]);
		const devices = await scanBluetooth(5000);
		expect(devices).toEqual([]);
		// Should never see a `scan on` invocation
		const scanCalls = calls.filter(
			(c) => c.file === '/usr/bin/bluetoothctl' && c.args.includes('scan')
		);
		expect(scanCalls).toHaveLength(0);
	});

	it('runs scan when adapter is powered and parses discovered devices with RSSI', async () => {
		stub([
			// checkBluetoothAdapter: rfkill + show (powered)
			() => ({ stdout: '0 bluetooth\n  Soft blocked: no\n', stderr: '' }),
			() => ({ stdout: 'Controller AA:BB:CC:DD:EE:FF\n\tPowered: yes\n', stderr: '' }),
			// scan on
			() => ({ stdout: '', stderr: '' }),
			// devices
			() => ({
				stdout: 'Device AA:11:22:33:44:55 Speaker\nDevice BB:66:77:88:99:AA Headphones\n',
				stderr: ''
			}),
			// info first
			() => ({ stdout: '\tRSSI: 0xffffffb8 (-72)\n', stderr: '' }),
			// info second
			() => ({ stdout: '\tRSSI: -60\n', stderr: '' })
		]);
		const devices = await scanBluetooth(2000);
		expect(devices).toHaveLength(2);
		expect(devices[0]).toMatchObject({
			mac: 'AA:11:22:33:44:55',
			name: 'Speaker',
			rssi_dbm: -72
		});
		expect(devices[1]).toMatchObject({
			mac: 'BB:66:77:88:99:AA',
			name: 'Headphones',
			rssi_dbm: -60
		});
	});
});
