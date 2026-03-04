/**
 * Zod validation schemas for RF propagation API endpoints.
 *
 * Validates coverage, P2P, and route requests
 * against CloudRF API parameter requirements.
 *
 * @module
 */

import { z } from 'zod';

/** CloudRF colormap identifiers (verified against live API) */
const CloudRFColormapSchema = z.enum(['RAINBOW45.dBm', 'LTE.dBm', 'HF.dBm']);

/** CloudRF propagation model IDs */
const PropagationModelSchema = z.union([
	z.literal(1),
	z.literal(3),
	z.literal(6),
	z.literal(7),
	z.literal(11)
]);

/** Clutter/environment profile filenames */
const ClutterProfileSchema = z.enum(['Minimal.clt', 'Temperate.clt', 'Tropical.clt', 'Jungle.clt']);

/** Reliability percentage options */
const ReliabilitySchema = z.union([z.literal(50), z.literal(75), z.literal(90), z.literal(95)]);

/** Latitude range: -90 to 90 decimal degrees */
const LatSchema = z.number().min(-90).max(90);

/** Longitude range: -180 to 180 decimal degrees */
const LonSchema = z.number().min(-180).max(180);

/** RF frequency: 1–100000 MHz (CloudRF supports wider range) */
const FrequencySchema = z.number().min(1).max(100000);

/** Antenna height above ground: 0.5–500 meters */
const HeightSchema = z.number().min(0.5).max(500);

/** Antenna polarization: 0=horizontal, 1=vertical */
const PolarizationSchema = z.number().int().min(0).max(1);

// ── Coverage ──────────────────────────────────────────────────────────

export const CoverageRequestSchema = z.object({
	lat: LatSchema,
	lon: LonSchema,
	frequency: FrequencySchema,
	polarization: PolarizationSchema,
	txHeight: HeightSchema,
	rxHeight: HeightSchema,
	radius: z.number().min(0.1).max(100),
	resolution: z.number().min(5).max(300).default(10),
	colormap: CloudRFColormapSchema.default('RAINBOW45.dBm'),
	txPower: z.number().min(0.001).max(100).optional(),
	rxSensitivity: z.number().min(-150).max(0).optional(),
	clutterProfile: ClutterProfileSchema.optional(),
	propagationModel: PropagationModelSchema.nullable().optional(),
	reliability: ReliabilitySchema.optional()
});

// ── Point-to-Point ──────────────────────────────────────────────────

export const P2PRequestSchema = z.object({
	txLat: LatSchema,
	txLon: LonSchema,
	rxLat: LatSchema,
	rxLon: LonSchema,
	frequency: FrequencySchema,
	polarization: PolarizationSchema,
	txHeight: HeightSchema,
	rxHeight: HeightSchema
});

// ── Route ───────────────────────────────────────────────────────────

export const RouteRequestSchema = z.object({
	txLat: LatSchema,
	txLon: LonSchema,
	frequency: FrequencySchema,
	polarization: PolarizationSchema,
	txHeight: HeightSchema,
	rxHeight: HeightSchema,
	waypoints: z
		.array(z.tuple([LatSchema, LonSchema]))
		.min(1, 'At least one waypoint required')
		.max(50, 'Maximum 50 waypoints')
});
