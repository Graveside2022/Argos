/**
 * Shared types for GSM Evil page state.
 * Extracted from +page.svelte to comply with Article 2.2 (max 300 lines/file).
 */

export interface ActivityStatus {
	hasActivity: boolean;
	packetCount: number;
	recentIMSI: boolean;
	currentFrequency: string;
	message: string;
}

/** Mutable page state passed to extracted logic functions */
export interface GsmEvilPageState {
	imsiCaptureActive: boolean;
	gsmFrames: string[];
	activityStatus: ActivityStatus;
}
