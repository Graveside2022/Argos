import type { Database } from 'better-sqlite3';

/**
 * Creates the trunk_recorder_presets table. Each row represents one saved
 * configuration for trunk-recorder — a control channel, SDR source, and
 * talkgroup map. The service layer materializes a preset into config.json +
 * talkgroups.csv on the shared Docker volume when the operator clicks Start.
 *
 * JSON columns:
 *   - control_channels: number[] (Hz)
 *   - source_config:    { center, rate, gain, ifGain, bbGain, device, driver }
 */
export function migrate(db: Database) {
	db.exec(`
		CREATE TABLE IF NOT EXISTS trunk_recorder_presets (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			system_type TEXT NOT NULL CHECK(system_type IN ('p25', 'smartnet')),
			system_label TEXT NOT NULL DEFAULT '',
			control_channels TEXT NOT NULL DEFAULT '[]',
			talkgroups_csv TEXT NOT NULL DEFAULT '',
			source_config TEXT NOT NULL DEFAULT '{}',
			created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
			updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
		);

		CREATE INDEX IF NOT EXISTS idx_trunk_recorder_presets_name
			ON trunk_recorder_presets(name);
	`);
}
