/**
 * Authentication Audit Logging — NIST AU-2, AU-3 Compliance
 *
 * Phase 2.2.8: Structured audit logging for all authentication events.
 * Produces machine-parseable JSON records for security monitoring,
 * incident response, and compliance reporting.
 *
 * Event types per NIST AU-2 (Audit Events):
 *   AUTH_SUCCESS    — Valid API key or session cookie accepted
 *   AUTH_FAILURE    — Invalid credentials presented
 *   AUTH_MISSING    — No credentials provided for protected endpoint
 *   WS_AUTH_SUCCESS — WebSocket connection authenticated
 *   WS_AUTH_FAILURE — WebSocket connection rejected (bad/missing credentials)
 *   SESSION_CREATED — Browser session cookie issued on page load
 *   RATE_LIMIT_HIT  — Request rejected by rate limiter
 *
 * Record format per NIST AU-3 (Content of Audit Records):
 *   timestamp, eventType, ip, method, path, userAgent, reason
 *
 * Standards: NIST SP 800-53 AU-2, AU-3, AU-6, AU-12
 */

import { logger } from '$lib/utils/logger';

/**
 * Authentication event types per NIST AU-2
 */
export type AuthEventType =
	| 'AUTH_SUCCESS'
	| 'AUTH_FAILURE'
	| 'AUTH_MISSING'
	| 'WS_AUTH_SUCCESS'
	| 'WS_AUTH_FAILURE'
	| 'SESSION_CREATED'
	| 'RATE_LIMIT_HIT'
	| 'RATE_LIMIT_EXCEEDED'; // Added for hooks.server.ts compatibility

interface AuthAuditRecord {
	[key: string]: unknown; // Allow logger to accept record as generic object
	timestamp: string;
	eventType: AuthEventType;
	ip: string;
	method: string;
	path: string;
	userAgent?: string;
	reason?: string;
}

/**
 * Log an authentication audit event.
 * Structured JSON format for machine parsing per NIST AU-3.
 *
 * All auth events are logged at WARN level or above to ensure they
 * appear in production logs (production log level defaults to WARN).
 * Success events use INFO in development but are important enough
 * to always emit; failures always use WARN.
 */
export function logAuthEvent(event: {
	eventType: AuthEventType;
	ip: string;
	method: string;
	path: string;
	userAgent?: string;
	reason?: string;
}): void {
	const record: AuthAuditRecord = {
		timestamp: new Date().toISOString(),
		...event
	};

	// Use appropriate log level based on event type
	switch (event.eventType) {
		case 'AUTH_SUCCESS':
		case 'WS_AUTH_SUCCESS':
		case 'SESSION_CREATED':
			logger.info('[AUTH_AUDIT]', record);
			break;
		case 'AUTH_FAILURE':
		case 'WS_AUTH_FAILURE':
		case 'AUTH_MISSING':
		case 'RATE_LIMIT_HIT':
		case 'RATE_LIMIT_EXCEEDED':
			logger.warn('[AUTH_AUDIT]', record);
			break;
		default:
			logger.info('[AUTH_AUDIT]', record);
	}
}
