/**
 * kismet-health unit tests.
 *
 * Mocks `isKismetRunning` (pgrep layer) and global `fetch` so we can
 * exercise the four health outcomes without a real Kismet instance.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/env', () => ({
	env: { KISMET_API_URL: 'http://fake-kismet:2501' }
}));

vi.mock('./kismet-control-service', () => ({
	isKismetRunning: vi.fn()
}));

vi.mock('./kismet-control-service-extended', () => ({
	startKismetExtended: vi.fn(),
	stopKismetExtended: vi.fn()
}));

vi.mock('$lib/utils/logger', () => ({
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

import { isKismetRunning } from './kismet-control-service';
import { probeKismetHealth } from './kismet-health';

const mockIsRunning = isKismetRunning as unknown as ReturnType<typeof vi.fn>;
const fetchMock = vi.fn();

function jsonResponse(body: unknown, status = 200): Response {
	return {
		ok: status >= 200 && status < 300,
		status,
		json: async () => body
	} as unknown as Response;
}

function timeoutError(): Error {
	const err = new Error('The operation was aborted due to timeout');
	err.name = 'TimeoutError';
	return err;
}

describe('probeKismetHealth', () => {
	beforeEach(() => {
		vi.stubGlobal('fetch', fetchMock);
		mockIsRunning.mockReset();
		fetchMock.mockReset();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('returns healthy when process alive, timestamp OK, devices array returned', async () => {
		mockIsRunning.mockResolvedValue(true);
		fetchMock
			.mockResolvedValueOnce(jsonResponse({ timestamp: 1776000000 }))
			.mockResolvedValueOnce(jsonResponse([{ mac: 'aa:bb' }, { mac: 'cc:dd' }]));

		const result = await probeKismetHealth();
		expect(result.healthy).toBe(true);
		expect(result.processAlive).toBe(true);
		expect(result.apiResponding).toBe(true);
		expect(result.devicesFetchable).toBe(true);
		expect(result.sampleDeviceCount).toBe(2);
		expect(result.reason).toBeNull();
	});

	it('accepts zero devices as healthy (quiet RF environment)', async () => {
		mockIsRunning.mockResolvedValue(true);
		fetchMock
			.mockResolvedValueOnce(jsonResponse({ timestamp: 1776000000 }))
			.mockResolvedValueOnce(jsonResponse([]));

		const result = await probeKismetHealth();
		expect(result.healthy).toBe(true);
		expect(result.sampleDeviceCount).toBe(0);
	});

	it('returns unhealthy when pgrep says no process', async () => {
		mockIsRunning.mockResolvedValue(false);

		const result = await probeKismetHealth();
		expect(result.healthy).toBe(false);
		expect(result.processAlive).toBe(false);
		expect(result.reason).toMatch(/not running/i);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('returns unhealthy when timestamp endpoint times out (API hung)', async () => {
		mockIsRunning.mockResolvedValue(true);
		fetchMock.mockRejectedValueOnce(timeoutError());

		const result = await probeKismetHealth();
		expect(result.healthy).toBe(false);
		expect(result.processAlive).toBe(true);
		expect(result.apiResponding).toBe(false);
		expect(result.reason).toMatch(/unresponsive|timeout/i);
	});

	it('returns unhealthy when timestamp OK but devices endpoint times out', async () => {
		mockIsRunning.mockResolvedValue(true);
		fetchMock
			.mockResolvedValueOnce(jsonResponse({ timestamp: 1776000000 }))
			.mockRejectedValueOnce(timeoutError());

		const result = await probeKismetHealth();
		expect(result.healthy).toBe(false);
		expect(result.processAlive).toBe(true);
		expect(result.apiResponding).toBe(true);
		expect(result.devicesFetchable).toBe(false);
		expect(result.reason).toMatch(/devices endpoint unresponsive/i);
	});

	it('returns unhealthy when timestamp returns HTTP 500', async () => {
		mockIsRunning.mockResolvedValue(true);
		fetchMock.mockResolvedValueOnce(jsonResponse(null, 500));

		const result = await probeKismetHealth();
		expect(result.healthy).toBe(false);
		expect(result.reason).toMatch(/HTTP 500/);
	});
});
