/**
 * Database Zod Schemas for Runtime Validation
 * Created for: Constitutional Audit Remediation (P1)
 * Tasks: T034-T036
 *
 * Purpose: Validate data returned from SQLite queries to ensure data integrity
 * - DbSignal: Signal records from rf_signals.db
 * - DbNetwork: Network records from rf_signals.db
 * - DbDevice: Device records from rf_signals.db
 *
 * Usage: Use safeParse() with handleValidationError() for all database query results
 */

import { z } from 'zod';

/**
 * DbSignal Schema - Validates signal records from database
 *
 * Validation rules:
 * - id: optional positive integer (auto-increment primary key)
 * - signal_id: non-empty string (unique identifier)
 * - device_id: optional non-empty string
 * - timestamp: positive integer (Unix timestamp in ms)
 * - latitude: -90 to 90 degrees
 * - longitude: -180 to 180 degrees
 * - altitude: optional number (meters)
 * - power: -120 to 0 dBm (realistic signal power range)
 * - frequency: 1 to 6000 MHz (HackRF operating range)
 * - bandwidth: optional positive number or null
 * - modulation: optional non-empty string or null
 * - source: non-empty string (SDR hardware source)
 * - metadata: optional JSON string
 */
export const DbSignalSchema = z.object({
	id: z.number().int().positive().optional(),
	signal_id: z.string().min(1),
	device_id: z.string().min(1).optional(),
	timestamp: z.number().int().positive(),
	latitude: z.number().min(-90).max(90),
	longitude: z.number().min(-180).max(180),
	altitude: z.number().optional(),
	power: z.number().min(-120).max(0),
	frequency: z.number().min(1).max(6000),
	bandwidth: z.number().positive().nullable().optional(),
	modulation: z.string().min(1).nullable().optional(),
	source: z.string().min(1),
	metadata: z.string().optional()
});

/**
 * DbDevice Schema - Validates device records from database
 *
 * Validation rules:
 * - id: optional positive integer (auto-increment primary key)
 * - device_id: non-empty string (unique identifier)
 * - type: non-empty string (device type: wifi, bluetooth, rf, etc.)
 * - manufacturer: optional non-empty string
 * - first_seen: positive integer (Unix timestamp in ms)
 * - last_seen: positive integer (Unix timestamp in ms)
 * - avg_power: optional number (average signal power in dBm)
 * - freq_min: optional positive number (minimum frequency in MHz)
 * - freq_max: optional positive number (maximum frequency in MHz)
 * - metadata: optional JSON string
 */
export const DbDeviceSchema = z.object({
	id: z.number().int().positive().optional(),
	device_id: z.string().min(1),
	type: z.string().min(1),
	manufacturer: z.string().min(1).optional(),
	first_seen: z.number().int().positive(),
	last_seen: z.number().int().positive(),
	avg_power: z.number().optional(),
	freq_min: z.number().positive().optional(),
	freq_max: z.number().positive().optional(),
	metadata: z.string().optional()
});

/**
 * DbNetwork Schema - Validates network records from database
 *
 * Validation rules:
 * - id: optional positive integer (auto-increment primary key)
 * - network_id: non-empty string (unique identifier)
 * - name: optional non-empty string (SSID, network name)
 * - type: non-empty string (wifi, bluetooth, mesh, etc.)
 * - encryption: optional non-empty string (WPA2, WEP, Open, etc.)
 * - channel: optional positive integer (WiFi channel)
 * - first_seen: positive integer (Unix timestamp in ms)
 * - last_seen: positive integer (Unix timestamp in ms)
 * - center_lat: optional latitude (-90 to 90)
 * - center_lon: optional longitude (-180 to 180)
 * - radius: optional positive number (coverage radius in meters)
 */
export const DbNetworkSchema = z.object({
	id: z.number().int().positive().optional(),
	network_id: z.string().min(1),
	name: z.string().min(1).optional(),
	type: z.string().min(1),
	encryption: z.string().min(1).optional(),
	channel: z.number().int().positive().optional(),
	first_seen: z.number().int().positive(),
	last_seen: z.number().int().positive(),
	center_lat: z.number().min(-90).max(90).optional(),
	center_lon: z.number().min(-180).max(180).optional(),
	radius: z.number().positive().optional()
});

/**
 * DbRelationship Schema - Validates relationship records from database
 *
 * Validation rules:
 * - id: optional positive integer (auto-increment primary key)
 * - source_device_id: non-empty string
 * - target_device_id: non-empty string
 * - network_id: optional non-empty string
 * - relationship_type: non-empty string (connected, nearby, interference, etc.)
 * - strength: optional number 0-1 (connection strength)
 * - first_seen: positive integer (Unix timestamp in ms)
 * - last_seen: positive integer (Unix timestamp in ms)
 */
export const DbRelationshipSchema = z.object({
	id: z.number().int().positive().optional(),
	source_device_id: z.string().min(1),
	target_device_id: z.string().min(1),
	network_id: z.string().min(1).optional(),
	relationship_type: z.string().min(1),
	strength: z.number().min(0).max(1).optional(),
	first_seen: z.number().int().positive(),
	last_seen: z.number().int().positive()
});
