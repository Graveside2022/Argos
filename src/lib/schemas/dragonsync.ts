import { z } from 'zod';

const DragonSyncRidSchema = z
	.object({
		make: z.string().nullable(),
		model: z.string().nullable(),
		source: z.string().nullable(),
		lookup_attempted: z.boolean(),
		lookup_success: z.boolean()
	})
	.passthrough();

export const DragonSyncDroneSchema = z
	.object({
		id: z.string(),
		id_type: z.string().default(''),
		ua_type: z.number().nullable().default(null),
		ua_type_name: z.string().default('Unknown'),
		operator_id: z.string().default(''),
		operator_id_type: z.string().default(''),
		op_status: z.string().default(''),
		lat: z.number().default(0),
		lon: z.number().default(0),
		alt: z.number().default(0),
		height: z.number().default(0),
		speed: z.number().default(0),
		vspeed: z.number().default(0),
		direction: z.number().nullable().default(null),
		pressure_altitude: z.number().nullable().default(null),
		height_type: z.string().default(''),
		pilot_lat: z.number().default(0),
		pilot_lon: z.number().default(0),
		home_lat: z.number().default(0),
		home_lon: z.number().default(0),
		mac: z.string().default(''),
		rssi: z.number().default(0),
		freq: z.number().nullable().default(null),
		transport: z.string().default(''),
		description: z.string().default(''),
		rid: DragonSyncRidSchema.default({
			make: null,
			model: null,
			source: null,
			lookup_attempted: false,
			lookup_success: false
		}),
		last_update_time: z.number().default(0),
		track_type: z.enum(['drone', 'aircraft']).default('drone'),
		caa_id: z.string().default(''),
		horizontal_accuracy: z.string().default(''),
		vertical_accuracy: z.string().default(''),
		speed_accuracy: z.string().default(''),
		observed_at: z.number().nullable().default(null),
		seen_by: z.string().nullable().default(null)
	})
	.passthrough();

export const DragonSyncDronesResponseSchema = z
	.object({
		drones: z.array(DragonSyncDroneSchema)
	})
	.passthrough();

export const DragonSyncStatusResultSchema = z.object({
	success: z.boolean(),
	droneidGoRunning: z.boolean(),
	dragonSyncRunning: z.boolean(),
	status: z.enum(['stopped', 'starting', 'running', 'stopping']),
	droneCount: z.number(),
	apiReachable: z.boolean(),
	error: z.string().optional()
});

export const DragonSyncControlSchema = z.object({
	action: z.enum(['start', 'stop']).describe('DragonSync control action')
});
