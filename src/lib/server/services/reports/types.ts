/**
 * Shared types for the Reports & Missions feature.
 *
 * Co-locating these here keeps the mission store, API layer, agent tools,
 * and tests on a single source of truth.
 */

import type { CaptureLoadout } from './loadout-hash';
export type {
	Capture,
	DiffResult,
	EmitterDelta,
	EmitterRow,
	EmitterSignalType
} from './emcon-diff';
export type { CaptureLoadout, LoadoutIntersection, SensorLoadout } from './loadout-hash';

export type MissionType = 'sitrep-loop' | 'emcon-survey';
export type CaptureRole = 'baseline' | 'posture' | 'tick';
export type CaptureStatus = 'running' | 'complete' | 'aborted';
export type ReportType = 'sitrep' | 'emcon-survey';

export type Mission = {
	id: string;
	name: string;
	type: MissionType;
	unit: string | null;
	ao_mgrs: string | null;
	created_at: number;
	active: boolean;
};

export type CaptureRow = {
	id: string;
	mission_id: string;
	role: CaptureRole;
	start_dtg: number;
	end_dtg: number | null;
	loadout_hash: string;
	loadout: CaptureLoadout;
	status: CaptureStatus;
};

export type CaptureEmitterRow = {
	capture_id: string;
	source_table: string;
	source_id: string;
	signal_type: string;
	identifier: string | null;
	fingerprint_key: string;
	freq_hz: number | null;
	power_dbm: number | null;
	modulation: string | null;
	mgrs: string | null;
	classification: string | null;
	sensor_tool: string | null;
	raw_json: string;
};

export type ReportRow = {
	id: string;
	mission_id: string;
	type: ReportType;
	title: string;
	generated_at: number;
	capture_ids: string[];
	flagged_hostile: number;
	flagged_suspect: number;
	emitter_count: number;
	source_qmd_path: string;
	html_path: string;
	pdf_path: string | null;
	slides_html_path: string | null;
	slides_pdf_path: string | null;
};

export type ReportInput = {
	mission_id: string;
	type: ReportType;
	title: string;
	capture_ids: string[];
	flagged_hostile?: number;
	flagged_suspect?: number;
	emitter_count?: number;
	source_qmd_path: string;
	html_path: string;
	pdf_path?: string | null;
	slides_html_path?: string | null;
	slides_pdf_path?: string | null;
};
