/**
 * TypeScript types for media-service MQTT payloads.
 * Matches data-model.md schemas exactly.
 *
 * These types are used by the MQTT bridge (mqtt-bridge.ts) to parse incoming
 * messages and by Svelte stores to type the reactive state.
 */

// ── Pipeline State ──────────────────────────────────────

export type PipelineStateName = 'running' | 'paused' | 'error' | 'stopped' | 'restarting';

export type PipelineName =
	| 'radio-audio'
	| 'audio-cleanup'
	| 'video-detection'
	| 'recording'
	| 'rtsp-server';

export interface PipelineState {
	readonly name: PipelineName;
	readonly state: PipelineStateName;
	readonly latency_ms: number;
	readonly buffer_pct: number;
	readonly throughput: number;
	readonly total_processed: number;
	readonly uptime_s: number;
	readonly last_error: string | null;
	readonly restart_count: number;
}

// ── System Metrics ──────────────────────────────────────

export interface SystemMetrics {
	readonly cpu_pct: number;
	readonly mem_mb: number;
	readonly disk_free_mb: number;
	readonly disk_warning: boolean;
}

// ── Health Report ───────────────────────────────────────

export interface HealthReport {
	readonly timestamp: string;
	readonly pipelines: Readonly<Record<string, PipelineState>>;
	readonly system: SystemMetrics;
}

// ── Transcription ───────────────────────────────────────

export interface TranscriptionResult {
	readonly id: string;
	readonly text: string;
	readonly timestamp: string;
	readonly duration_ms: number;
	readonly confidence: number;
	readonly language: string;
	readonly source_pipeline: string;
	readonly cleanup_applied: boolean;
}

// ── Detection ───────────────────────────────────────────

export interface DetectionEvent {
	readonly id: string;
	readonly class_label: string;
	readonly confidence: number;
	readonly bbox_x: number;
	readonly bbox_y: number;
	readonly bbox_w: number;
	readonly bbox_h: number;
	readonly frame_timestamp: string;
	readonly camera_id: string;
	readonly tracking_id: string | null;
}

// ── Recording Status ────────────────────────────────────

export type RecordingStateName = 'recording' | 'finalizing' | 'completed' | 'error' | 'stopped';

export interface RecordingStatus {
	readonly state: RecordingStateName;
	readonly pipeline_name: string;
	readonly media_type: 'audio' | 'video';
	readonly file: string;
	readonly format: string;
	readonly started_at: string;
	readonly stopped_at: string | null;
	readonly bytes_written: number;
	readonly duration_ms: number;
}

// ── Pipeline Error ──────────────────────────────────────

export interface PipelineError {
	readonly pipeline: string;
	readonly error: string;
	readonly debug: string;
	readonly severity: 'error' | 'warning';
	readonly timestamp: string;
}

// ── Pipeline Command (outbound from UI) ─────────────────

export type PipelineAction = 'start' | 'stop' | 'restart';

export interface PipelineCommand {
	readonly pipeline: PipelineName;
	readonly action: PipelineAction;
}

export interface RecordingCommand {
	readonly action: 'start' | 'stop';
	readonly media_type: 'audio' | 'video';
}

export interface ToggleCommand {
	readonly enabled: boolean;
}

// ── MQTT Topic Constants ────────────────────────────────

export const MEDIA_TOPICS = {
	// Outbound: media-service → SvelteKit
	TRANSCRIPTION: 'argos/media/transcription',
	DETECTIONS: 'argos/media/detections',
	HEALTH: 'argos/media/health',
	ERRORS: 'argos/media/errors',
	RECORDING_STATUS: 'argos/media/recording/status',
	EXPORT_READY: 'argos/media/export/ready',

	// Inbound: SvelteKit → media-service
	RECORDING_COMMAND: 'argos/media/recording/command',
	PIPELINE_COMMAND: 'argos/media/pipeline/command',
	TRANSCRIPTION_TOGGLE: 'argos/media/transcription/toggle',
	CLEANUP_TOGGLE: 'argos/media/cleanup/toggle',
	DETECTION_TOGGLE: 'argos/media/detection/toggle',
	SOURCE_SELECT: 'argos/media/source/select',
	EXPORT_COMMAND: 'argos/media/export/command'
} as const;

// ── WebSocket Event Types ───────────────────────────────

export const MEDIA_WS_EVENTS = {
	TRANSCRIPTION: 'media_transcription',
	DETECTION: 'media_detection',
	HEALTH: 'media_health',
	RECORDING: 'media_recording',
	ERROR: 'media_error'
} as const;
