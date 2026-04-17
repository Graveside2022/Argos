import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { env } from '$lib/server/env';

import type { Preset } from './types';

/**
 * Materializes a Preset into the two files trunk-recorder reads at startup:
 *   - {TRUNK_RECORDER_CONFIG_DIR}/config.json
 *   - {TRUNK_RECORDER_CONFIG_DIR}/talkgroups.csv
 *
 * The Docker container mounts {TRUNK_RECORDER_CONFIG_DIR} at /app/config. All
 * paths inside the generated JSON are rewritten to the container-side mount
 * prefix (/app/config, /app/recordings) so the binary can read them.
 */

const CONTAINER_CONFIG_DIR = '/app/config';
const CONTAINER_RECORDINGS_DIR = '/app/recordings';

function buildRdioUploaderConfig(preset: Preset): Record<string, unknown> {
	return {
		systems: [
			{
				id: 1,
				shortName: preset.systemLabel || preset.name,
				apiKey: 'argos-local',
				url: `${env.RDIO_SCANNER_URL}/api/trunk-recorder-call-upload`
			}
		]
	};
}

/** Top-level trunk-recorder config.json shape. */
function buildConfig(preset: Preset): Record<string, unknown> {
	const systemEntry: Record<string, unknown> = {
		control_channels: preset.controlChannels,
		type: preset.systemType,
		shortName: preset.systemLabel || preset.name,
		talkgroupsFile: `${CONTAINER_CONFIG_DIR}/talkgroups.csv`,
		recordUnknown: true,
		squelch: -50,
		modulation: 'qpsk',
		hideEncrypted: false
	};

	return {
		ver: 2,
		sources: [preset.sourceConfig],
		systems: [systemEntry],
		captureDir: CONTAINER_RECORDINGS_DIR,
		logFile: false,
		broadcastSignals: false,
		callTimeout: 3,
		controlWarnRate: 10,
		frequencyFormat: 'mhz',
		statusAsString: true,
		audioStreaming: false,
		plugins: [
			{
				name: 'rdioscanner_uploader',
				library: 'librdioscanner_uploader.so',
				...buildRdioUploaderConfig(preset)
			}
		]
	};
}

/**
 * Writes config.json + talkgroups.csv from a Preset.
 * Returns the host paths written (for logging / verification).
 */
export function writePresetFiles(preset: Preset): { configPath: string; talkgroupsPath: string } {
	const dir = env.TRUNK_RECORDER_CONFIG_DIR;
	mkdirSync(dir, { recursive: true });

	const configPath = path.join(dir, 'config.json');
	const talkgroupsPath = path.join(dir, 'talkgroups.csv');

	writeFileSync(configPath, JSON.stringify(buildConfig(preset), null, 2), 'utf8');
	writeFileSync(talkgroupsPath, preset.talkgroupsCsv, 'utf8');

	return { configPath, talkgroupsPath };
}
