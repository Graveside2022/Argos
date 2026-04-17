import { randomUUID } from 'node:crypto';

import type { Database } from 'better-sqlite3';

import type { Preset, PresetInput } from './types';

/**
 * Row shape as stored in SQLite. JSON columns are TEXT; the repository
 * serializes/deserializes them at the boundary so callers only see domain
 * types. Keep in sync with the migration in
 * `src/lib/server/db/migrations/20260417_create_trunk_recorder_presets.ts`.
 */
interface PresetRow {
	id: string;
	name: string;
	system_type: 'p25' | 'smartnet';
	system_label: string;
	control_channels: string;
	talkgroups_csv: string;
	source_config: string;
	created_at: number;
	updated_at: number;
}

function rowToPreset(row: PresetRow): Preset {
	return {
		id: row.id,
		name: row.name,
		systemType: row.system_type,
		systemLabel: row.system_label,
		controlChannels: JSON.parse(row.control_channels) as number[],
		talkgroupsCsv: row.talkgroups_csv,
		sourceConfig: JSON.parse(row.source_config) as Preset['sourceConfig'],
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}

const INSERT_SQL = `
	INSERT INTO trunk_recorder_presets (
		id, name, system_type, system_label,
		control_channels, talkgroups_csv, source_config,
		created_at, updated_at
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

const UPDATE_SQL = `
	UPDATE trunk_recorder_presets SET
		name = ?,
		system_type = ?,
		system_label = ?,
		control_channels = ?,
		talkgroups_csv = ?,
		source_config = ?,
		updated_at = ?
	WHERE id = ?
`;

export function listPresets(db: Database): Preset[] {
	const rows = db
		.prepare('SELECT * FROM trunk_recorder_presets ORDER BY updated_at DESC')
		.all() as PresetRow[];
	return rows.map(rowToPreset);
}

export function getPreset(db: Database, id: string): Preset | null {
	const row = db.prepare('SELECT * FROM trunk_recorder_presets WHERE id = ?').get(id) as
		| PresetRow
		| undefined;
	return row ? rowToPreset(row) : null;
}

export function createPreset(db: Database, input: PresetInput): Preset {
	const now = Date.now();
	const id = input.id ?? randomUUID();
	db.prepare(INSERT_SQL).run(
		id,
		input.name,
		input.systemType,
		input.systemLabel,
		JSON.stringify(input.controlChannels),
		input.talkgroupsCsv,
		JSON.stringify(input.sourceConfig),
		now,
		now
	);
	return {
		id,
		name: input.name,
		systemType: input.systemType,
		systemLabel: input.systemLabel,
		controlChannels: input.controlChannels,
		talkgroupsCsv: input.talkgroupsCsv,
		sourceConfig: input.sourceConfig,
		createdAt: now,
		updatedAt: now
	};
}

export function updatePreset(db: Database, id: string, input: PresetInput): Preset | null {
	const existing = getPreset(db, id);
	if (!existing) return null;
	const now = Date.now();
	db.prepare(UPDATE_SQL).run(
		input.name,
		input.systemType,
		input.systemLabel,
		JSON.stringify(input.controlChannels),
		input.talkgroupsCsv,
		JSON.stringify(input.sourceConfig),
		now,
		id
	);
	return {
		...existing,
		name: input.name,
		systemType: input.systemType,
		systemLabel: input.systemLabel,
		controlChannels: input.controlChannels,
		talkgroupsCsv: input.talkgroupsCsv,
		sourceConfig: input.sourceConfig,
		updatedAt: now
	};
}

export function deletePreset(db: Database, id: string): boolean {
	const result = db.prepare('DELETE FROM trunk_recorder_presets WHERE id = ?').run(id);
	return result.changes > 0;
}
