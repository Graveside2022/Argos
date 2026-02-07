/**
 * GSM Protocol Parser - Pure functions for analyzing GSM frame data
 *
 * All functions in this module are pure (no side effects, no closures over
 * mutable state, no I/O). They can be unit-tested independently of the
 * SSE streaming endpoint.
 */

/**
 * Channel analysis result from frame inspection.
 */
export interface ChannelAnalysis {
	channelType: string;
	controlChannel: boolean;
}

/**
 * Cell identity fields parsed from tshark output.
 * Values are decimal strings (hex LAC/CI are converted).
 */
export interface CellIdentity {
	mcc: string;
	mnc: string;
	lac: string;
	ci: string;
}

/**
 * GSM L3 Radio Resource Management message types (3GPP TS 04.08).
 * Protocol discriminator 0x06 = Radio Resource management.
 *
 * System Information messages indicate a BCCH carrier.
 * Paging messages indicate a CCCH.
 */
const SYSTEM_INFO_MSG_TYPES = new Set([
	0x19, // System Information Type 1
	0x1a, // System Information Type 2
	0x1b, // System Information Type 2bis
	0x1c, // System Information Type 2ter
	0x1d, // System Information Type 2quater
	0x1e, // System Information Type 3
	0x02, // System Information Type 4
	0x03, // System Information Type 5
	0x07 // System Information Type 6
]);

const PAGING_MSG_TYPES = new Set([
	0x21, // Paging Request Type 1
	0x22, // Paging Request Type 2
	0x24, // Paging Request Type 3
	0x3e, // Notification/NCH
	0x3f // Notification Response
]);

/**
 * Analyze raw hex lines from grgsm_livemon_headless output to identify
 * the GSM logical channel type.
 *
 * The function looks for L3 RR messages (protocol discriminator 0x06)
 * and classifies based on whether System Information or Paging messages
 * are present.
 *
 * @param hexLines - Lines of hex-encoded GSM frame data from the log file.
 *                   Expected format: whitespace-separated hex bytes per line,
 *                   e.g. "  15 06 1a 00 ..."
 * @param frameCount - Total number of GSMTAP frames observed on the frequency.
 * @returns Channel type classification. Empty channelType if no frames.
 */
export function analyzeGsmFrames(hexLines: string[], frameCount: number): ChannelAnalysis {
	if (hexLines.length === 0 || frameCount === 0) {
		return { channelType: '', controlChannel: false };
	}

	let hasSI = false;
	let hasPaging = false;

	for (const line of hexLines) {
		const bytes = line.trim().split(/\s+/);
		// L3 message: byte[1] is protocol discriminator, byte[2] is message type
		if (bytes.length >= 3 && bytes[1] === '06') {
			const msgType = parseInt(bytes[2], 16);
			if (SYSTEM_INFO_MSG_TYPES.has(msgType)) {
				hasSI = true;
			}
			if (PAGING_MSG_TYPES.has(msgType)) {
				hasPaging = true;
			}
		}
	}

	if (hasSI) {
		return { channelType: 'BCCH/CCCH', controlChannel: true };
	}
	if (hasPaging) {
		return { channelType: 'CCCH', controlChannel: true };
	}
	if (frameCount > 100) {
		return { channelType: 'TCH', controlChannel: false };
	}
	return { channelType: 'SDCCH', controlChannel: false };
}

/**
 * Parse tshark cell identity output into structured fields.
 *
 * tshark is invoked with fields: e212.lai.mcc, e212.lai.mnc, gsm_a.lac,
 * gsm_a.bssmap.cell_ci, separated by commas. LAC and CI are returned as
 * hex values (e.g. "0x1065") which this function converts to decimal.
 *
 * Multiple lines of output may be present (one per decoded packet).
 * The function accumulates data across all lines, taking the last non-empty
 * value for each field (matching the original endpoint behavior).
 *
 * @param tsharkOutput - Raw stdout from the tshark cell identity command.
 * @returns Parsed cell identity. Fields are empty strings if not captured.
 */
export function parseCellIdentity(tsharkOutput: string): CellIdentity {
	const result: CellIdentity = { mcc: '', mnc: '', lac: '', ci: '' };

	if (!tsharkOutput || !tsharkOutput.trim()) {
		return result;
	}

	const cellLines = tsharkOutput
		.trim()
		.split('\n')
		.filter((l: string) => l.trim() && !/^,*$/.test(l));

	for (const line of cellLines) {
		const parts = line.split(',');
		if (parts[0] && parts[0].trim()) result.mcc = parts[0].trim();
		if (parts[1] && parts[1].trim()) result.mnc = parts[1].trim();
		if (parts[2] && parts[2].trim()) {
			const raw = parts[2].trim();
			result.lac = raw.startsWith('0x') ? String(parseInt(raw, 16)) : raw;
		}
		if (parts[3] && parts[3].trim()) {
			const raw = parts[3].trim();
			result.ci = raw.startsWith('0x') ? String(parseInt(raw, 16)) : raw;
		}
	}

	return result;
}

/**
 * Classify signal strength into a human-readable label.
 *
 * Two classification modes:
 * 1. Power-based: when an actual dBm measurement is available (power > -100).
 * 2. Frame-count-based: fallback when HackRF cannot provide power measurement
 *    (power === -100 but frames were captured).
 *
 * @param power - Measured power in dBm. -100 indicates no measurement.
 * @param frameCount - Number of GSMTAP frames captured.
 * @returns Human-readable strength label.
 */
export function classifySignalStrength(power: number, frameCount: number): string {
	// Power-based classification (when real measurement available)
	if (power > -100) {
		if (power > -40) return 'Excellent';
		if (power > -50) return 'Very Strong';
		if (power > -60) return 'Strong';
		if (power > -70) return 'Good';
		if (power > -80) return 'Moderate';
		if (power > -90) return 'Weak';
		return 'No Signal';
	}

	// Frame-count-based fallback (HackRF provides no power measurement)
	if (frameCount > 0) {
		if (frameCount > 200) return 'Excellent';
		if (frameCount > 150) return 'Very Strong';
		if (frameCount > 100) return 'Strong';
		if (frameCount > 50) return 'Good';
		if (frameCount > 10) return 'Moderate';
		return 'Weak';
	}

	return 'No Signal';
}

/**
 * Determine the logical channel type for a frequency based on all
 * available evidence: cell identity from tshark and hex frame analysis.
 *
 * Priority:
 * 1. If tshark decoded MCC + LAC + CI, those come from SI3/SI4, which
 *    definitively identifies a BCCH carrier.
 * 2. Otherwise, fall back to hex frame analysis from analyzeGsmFrames().
 * 3. If hex analysis also failed (threw an error upstream), use a simple
 *    frame-count heuristic.
 *
 * @param cellIdentity - Parsed cell identity from tshark.
 * @param frameAnalysis - Result from analyzeGsmFrames(), or null if
 *                        the hex log could not be read.
 * @param frameCount - Total GSMTAP frames observed.
 * @returns Channel type classification.
 */
export function determineChannelType(
	cellIdentity: CellIdentity,
	frameAnalysis: ChannelAnalysis | null,
	frameCount: number
): ChannelAnalysis {
	if (frameCount === 0) {
		return { channelType: '', controlChannel: false };
	}

	// Definitive: tshark decoded cell identity from SI3/SI4 = BCCH
	if (cellIdentity.mcc && cellIdentity.lac && cellIdentity.ci) {
		return { channelType: 'BCCH/CCCH', controlChannel: true };
	}

	// Use hex frame analysis if available
	if (frameAnalysis) {
		return frameAnalysis;
	}

	// Fallback heuristic when hex log was unreadable
	if (frameCount > 10) {
		return { channelType: 'BCCH/CCCH', controlChannel: true };
	}
	return { channelType: 'SDCCH', controlChannel: false };
}
