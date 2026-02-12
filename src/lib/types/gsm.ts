/**
 * Shared GSM scanning types
 *
 * Used by both the streaming and non-streaming intelligent-scan endpoints.
 * Any changes here affect:
 *   - src/routes/api/gsm-evil/intelligent-scan-stream/+server.ts
 *   - src/routes/api/gsm-evil/intelligent-scan/+server.ts
 */

export interface CapturedIMSI {
	imsi: string;
	tmsi?: string;
	mcc: string | number;
	mnc: string | number;
	lac: number;
	ci: number;
	lat?: number;
	lon?: number;
	timestamp: string;
}

export interface FrequencyTestResult {
	frequency: string;
	power: number;
	frameCount: number;
	hasGsmActivity: boolean;
	strength: string;
	channelType?: string;
	controlChannel?: boolean;
	mcc?: string;
	mnc?: string;
	lac?: string;
	ci?: string;
}

export interface ScanProgress {
	current: number;
	total: number;
	completed: number;
}

export interface ScanResult {
	type: 'scan_complete' | 'frequency_result';
	success?: boolean;
	bestFrequency?: string;
	bestFrequencyFrames?: number;
	scanResults?: FrequencyTestResult[];
	totalTested?: number;
	frequency?: string;
	result?: FrequencyTestResult;
	progress?: ScanProgress;
	message?: string;
	error?: string;
}
