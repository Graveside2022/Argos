/**
 * Unit tests for TAK Enrollment API (POST /api/tak/enroll)
 * Task: T023
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Module mocks ---

const mockGenerate = vi.fn();
const mockInit = vi.fn();
const mockSavePemCerts = vi.fn((_id: string, _cert: string, _key: string, _ca: string[]) => ({
	certPath: 'data/certs/test-id/client.crt',
	keyPath: 'data/certs/test-id/client.key',
	caPath: 'data/certs/test-id/ca.crt'
}));

vi.mock('$lib/server/tak/CertManager', () => ({
	CertManager: {
		init: () => mockInit(),
		savePemCerts: (id: string, cert: string, key: string, ca: string[]) =>
			mockSavePemCerts(id, cert, key, ca)
	}
}));

vi.mock('@tak-ps/node-tak', () => ({
	TAKAPI: vi.fn().mockImplementation(() => ({
		Credentials: { generate: mockGenerate }
	})),
	APIAuthPassword: vi.fn()
}));

import { POST } from '$lib/../routes/api/tak/enroll/+server';

// --- Helpers ---

function makeRequest(body: unknown): Request {
	return new Request('http://localhost/api/tak/enroll', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});
}

const VALID_ENROLL = {
	hostname: '10.0.0.1',
	port: 8446,
	username: 'admin',
	password: 'secret123',
	id: '550e8400-e29b-41d4-a716-446655440000'
};

// --- Tests ---

describe('POST /api/tak/enroll', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockGenerate.mockResolvedValue({
			cert: '-----BEGIN CERTIFICATE-----\ncert\n-----END CERTIFICATE-----',
			key: '-----BEGIN PRIVATE KEY-----\nkey\n-----END PRIVATE KEY-----',
			ca: ['-----BEGIN CERTIFICATE-----\nca\n-----END CERTIFICATE-----']
		});
	});

	it('enrolls successfully and returns cert paths', async () => {
		const response = await POST({ request: makeRequest(VALID_ENROLL) } as never);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.success).toBe(true);
		expect(data.paths.certPath).toContain('client.crt');
		expect(data.paths.keyPath).toContain('client.key');
		expect(data.paths.caPath).toContain('ca.crt');
		expect(mockInit).toHaveBeenCalled();
		expect(mockSavePemCerts).toHaveBeenCalled();
	});

	it('auto-generates UUID when id is omitted', async () => {
		const { id: _, ...noId } = VALID_ENROLL;
		const response = await POST({ request: makeRequest(noId) } as never);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
	});

	it('rejects missing hostname with 400', async () => {
		const response = await POST({
			request: makeRequest({ port: 8446, username: 'a', password: 'b' })
		} as never);
		const data = await response.json();

		expect(response.status).toBe(400);
		expect(data.success).toBe(false);
	});

	it('rejects missing username with 400', async () => {
		const response = await POST({
			request: makeRequest({ hostname: '10.0.0.1', password: 'b' })
		} as never);
		const data = await response.json();

		expect(response.status).toBe(400);
		expect(data.success).toBe(false);
	});

	it('returns 401 on authentication failure', async () => {
		mockGenerate.mockRejectedValue(new Error('401 Unauthorized'));

		const response = await POST({ request: makeRequest(VALID_ENROLL) } as never);
		const data = await response.json();

		expect(response.status).toBe(401);
		expect(data.error).toContain('Authentication failed');
	});

	it('returns 401 on 403 Forbidden response', async () => {
		mockGenerate.mockRejectedValue(new Error('403 Forbidden'));

		const response = await POST({ request: makeRequest(VALID_ENROLL) } as never);
		const data = await response.json();

		expect(response.status).toBe(401);
		expect(data.error).toContain('Authentication failed');
	});

	it('returns 502 when server is unreachable (ECONNREFUSED)', async () => {
		mockGenerate.mockRejectedValue(new Error('connect ECONNREFUSED 10.0.0.1:8446'));

		const response = await POST({ request: makeRequest(VALID_ENROLL) } as never);
		const data = await response.json();

		expect(response.status).toBe(502);
		expect(data.error).toContain('Enrollment server unreachable');
		expect(data.error).toContain('10.0.0.1:8446');
	});

	it('returns 502 when server times out (ETIMEDOUT)', async () => {
		mockGenerate.mockRejectedValue(new Error('connect ETIMEDOUT'));

		const response = await POST({ request: makeRequest(VALID_ENROLL) } as never);
		const data = await response.json();

		expect(response.status).toBe(502);
		expect(data.error).toContain('Enrollment server unreachable');
	});

	it('returns 502 when hostname not found (ENOTFOUND)', async () => {
		mockGenerate.mockRejectedValue(new Error('getaddrinfo ENOTFOUND badhost'));

		const response = await POST({ request: makeRequest(VALID_ENROLL) } as never);

		expect(response.status).toBe(502);
	});

	it('returns 500 for unexpected errors', async () => {
		mockGenerate.mockRejectedValue(new Error('unexpected internal error'));

		const response = await POST({ request: makeRequest(VALID_ENROLL) } as never);
		const data = await response.json();

		expect(response.status).toBe(500);
		expect(data.error).toBe('Internal Server Error');
	});

	it('uses default port 8446 when port is omitted', async () => {
		const { port: _, ...noPort } = VALID_ENROLL;
		const response = await POST({ request: makeRequest(noPort) } as never);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.success).toBe(true);
	});

	it('rejects invalid port range', async () => {
		const response = await POST({
			request: makeRequest({ ...VALID_ENROLL, port: 99999 })
		} as never);
		const data = await response.json();

		expect(response.status).toBe(400);
		expect(data.success).toBe(false);
	});
});
