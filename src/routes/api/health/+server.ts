/**
 * Health Check Endpoint — Exempt from Authentication
 *
 * Returns a minimal status indicator for monitoring infrastructure.
 * Intentionally exposes NO system details, hardware state, or version info.
 *
 * This is the ONLY API endpoint exempt from authentication (Phase 2.1.1).
 */

import { json } from '@sveltejs/kit';

import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	return json({ status: 'ok' });
};
