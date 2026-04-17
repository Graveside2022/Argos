import { z } from 'zod';

/**
 * Domain types and Zod schemas for trunk-recorder integration.
 *
 * A Preset captures everything needed to materialize a trunk-recorder
 * config.json + talkgroups.csv on the shared Docker volume. The service
 * layer writes these files and invokes `docker start trunk-recorder`.
 *
 * Field shapes match the upstream trunk-recorder config.json format —
 * see https://trunkrecorder.com/docs/CONFIGURE for canonical keys.
 */

/** P25 Phase 1/2 or Motorola SmartNet/SmartZone. */
export const SystemTypeSchema = z.enum(['p25', 'smartnet']);
export type SystemType = z.infer<typeof SystemTypeSchema>;

/** Upstream trunk-recorder source object. Matches sources[] entry shape. */
export const SourceConfigSchema = z.object({
	center: z.number().int().positive(),
	rate: z.number().int().positive().default(8_000_000),
	gain: z.number().int().min(0).max(62).default(40),
	ifGain: z.number().int().min(0).max(62).default(32),
	bbGain: z.number().int().min(0).max(62).default(16),
	driver: z.enum(['osmosdr', 'usrp']).default('osmosdr'),
	device: z.string().default('hackrf=0'),
	error: z.number().default(0)
});
export type SourceConfig = z.infer<typeof SourceConfigSchema>;

/** One talkgroup row — human-readable mapping for numeric TGID. */
export const TalkgroupRowSchema = z.object({
	tgid: z.number().int().nonnegative(),
	mode: z.string().default('D'),
	label: z.string().min(1).max(64),
	description: z.string().max(256).default(''),
	tag: z.string().max(32).default(''),
	category: z.string().max(32).default(''),
	priority: z.number().int().min(1).max(5).default(3)
});
export type TalkgroupRow = z.infer<typeof TalkgroupRowSchema>;

/** Preset as stored (JSON columns stringified in SQLite). */
export const PresetSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1).max(80),
	systemType: SystemTypeSchema,
	systemLabel: z.string().max(80).default(''),
	controlChannels: z.array(z.number().int().positive()).min(1),
	talkgroupsCsv: z.string().default(''),
	sourceConfig: SourceConfigSchema,
	createdAt: z.number().int(),
	updatedAt: z.number().int()
});
export type Preset = z.infer<typeof PresetSchema>;

/** Payload accepted by POST /api/trunk-recorder/config (create or update). */
export const PresetInputSchema = PresetSchema.omit({
	id: true,
	createdAt: true,
	updatedAt: true
}).extend({
	id: z.string().min(1).optional()
});
export type PresetInput = z.infer<typeof PresetInputSchema>;

/** Control-endpoint request body. */
export const ControlActionSchema = z.object({
	action: z.enum(['start', 'stop', 'restart', 'status']),
	presetId: z.string().min(1).optional()
});
export type ControlBody = z.infer<typeof ControlActionSchema>;
export type ControlAction = ControlBody['action'];

/** Status returned by GET /api/trunk-recorder/status. */
export interface TrunkRecorderStatus {
	running: boolean;
	status: 'running' | 'stopped' | 'starting' | 'stopping';
	presetId: string | null;
	owner: string | null;
	startedAt: number | null;
	rdioScannerRunning: boolean;
}
