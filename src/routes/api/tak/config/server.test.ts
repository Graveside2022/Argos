/**
 * Unit tests for TAK Config API (GET/POST /api/tak/config)
 * Task: T015
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Module mocks (must be before imports) ---

const mockLoadTakConfig = vi.fn();
const mockGetRFDatabase = vi.fn(() => ({ rawDb: {} }));
const mockSaveConfig = vi.fn();
const mockGetInstance = vi.fn(() => ({ saveConfig: mockSaveConfig }));

vi.mock('$lib/server/db/database', () => ({
	getRFDatabase: () => mockGetRFDatabase()
}));

vi.mock('$lib/server/tak/tak-db', () => ({
	loadTakConfig: (...args: unknown[]) => mockLoadTakConfig(...args)
}));

vi.mock('$lib/server/tak/TakService', () => ({
	TakService: { getInstance: () => mockGetInstance() }
}));

// Import handlers after mocks are registered
import { GET, POST } from './+server';

// --- Helpers ---

function makeRequest(body: unknown): Request {
	return new Request('http://localhost/api/tak/config', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});
}

const VALID_CONFIG = {
	name: 'Unit TAK',
	hostname: '192.168.1.100',
	port: 8089,
	protocol: 'tls' as const,
	shouldConnectOnStartup: false,
	truststorePass: 'atakatak',
	certPass: 'atakatak',
	enrollmentPort: 8446
};

// --- Tests ---

describe('GET /api/tak/config', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns existing config as JSON', async () => {
		const fakeConfig = { id: 'abc-123', name: 'Test TAK', hostname: '10.0.0.1' };
		mockLoadTakConfig.mockReturnValue(fakeConfig);

		// Safe: Test: RequestEvent type not needed — handler only uses return value
		const response = await GET({ request: new Request('http://localhost') } as never);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data).toEqual(fakeConfig);
		expect(mockGetRFDatabase).toHaveBeenCalled();
	});

	it('returns null when no config exists', async () => {
		mockLoadTakConfig.mockReturnValue(null);

		const response = await GET({ request: new Request('http://localhost') } as never);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data).toBeNull();
	});
});

describe('POST /api/tak/config', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockSaveConfig.mockResolvedValue(undefined);
	});

	it('saves valid config and returns success', async () => {
		const body = { ...VALID_CONFIG, id: crypto.randomUUID() };

		const response = await POST({ request: makeRequest(body) } as never);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.success).toBe(true);
		expect(data.config.id).toBe(body.id);
		expect(mockSaveConfig).toHaveBeenCalledOnce();
	});

	it('auto-generates UUID when id is omitted', async () => {
		const response = await POST({ request: makeRequest(VALID_CONFIG) } as never);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.success).toBe(true);
		expect(data.config.id).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
		);
	});

	it('rejects invalid body with 400 and Zod errors', async () => {
		const response = await POST({
			request: makeRequest({ name: '', hostname: '', port: -1 })
		} as never);
		const data = await response.json();

		expect(response.status).toBe(400);
		expect(data.success).toBe(false);
		expect(data.error).toBeTruthy();
	});

	it('rejects non-tls protocol', async () => {
		const response = await POST({
			request: makeRequest({ ...VALID_CONFIG, protocol: 'tcp' })
		} as never);
		const data = await response.json();

		expect(response.status).toBe(400);
		expect(data.success).toBe(false);
	});

	it('rejects port out of range', async () => {
		const response = await POST({
			request: makeRequest({ ...VALID_CONFIG, port: 99999 })
		} as never);
		const data = await response.json();

		expect(response.status).toBe(400);
		expect(data.success).toBe(false);
	});

	it('returns 500 when saveConfig throws', async () => {
		mockSaveConfig.mockRejectedValue(new Error('DB write failed'));

		const body = { ...VALID_CONFIG, id: crypto.randomUUID() };
		const response = await POST({ request: makeRequest(body) } as never);
		const data = await response.json();

		expect(response.status).toBe(500);
		expect(data.error).toBe('Internal Server Error');
	});

	it('accepts optional authMethod enum values', async () => {
		for (const authMethod of ['enroll', 'import'] as const) {
			const body = { ...VALID_CONFIG, id: crypto.randomUUID(), authMethod };
			const response = await POST({ request: makeRequest(body) } as never);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.config.authMethod).toBe(authMethod);
		}
	});

	it('rejects invalid authMethod value', async () => {
		const body = { ...VALID_CONFIG, authMethod: 'password' };
		const response = await POST({ request: makeRequest(body) } as never);
		const data = await response.json();

		expect(response.status).toBe(400);
		expect(data.success).toBe(false);
	});
});
