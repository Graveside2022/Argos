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
	isControlChannel: boolean;
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
/** Extract the L3 RR message type from a hex line, or null if not an RR message */
function extractRrMessageType(line: string): number | null {
	const bytes = line.trim().split(/\s+/);
	if (bytes.length < 3 || bytes[1] !== '06') return null;
	return parseInt(bytes[2], 16);
}

/** Classify a single message type as SI, paging, or neither */
function classifyMsgType(msgType: number): 'si' | 'paging' | null {
	if (SYSTEM_INFO_MSG_TYPES.has(msgType)) return 'si';
	if (PAGING_MSG_TYPES.has(msgType)) return 'paging';
	return null;
}

/** Extract classified message kinds from hex lines, filtering nulls */
function extractMessageKinds(hexLines: string[]): Array<'si' | 'paging'> {
	return hexLines
		.map(extractRrMessageType)
		.filter((t): t is number => t !== null)
		.map(classifyMsgType)
		.filter((k): k is 'si' | 'paging' => k !== null);
}

/** Scan hex lines for SI and paging message presence */
function detectMessageTypes(hexLines: string[]): { hasSI: boolean; hasPaging: boolean } {
	const kinds = extractMessageKinds(hexLines);
	return { hasSI: kinds.includes('si'), hasPaging: kinds.includes('paging') };
}

/** Classify channel from detected message types and frame count */
function classifyChannel(hasSI: boolean, hasPaging: boolean, frameCount: number): ChannelAnalysis {
	if (hasSI) return { channelType: 'BCCH/CCCH', isControlChannel: true };
	if (hasPaging) return { channelType: 'CCCH', isControlChannel: true };
	if (frameCount > 100) return { channelType: 'TCH', isControlChannel: false };
	return { channelType: 'SDCCH', isControlChannel: false };
}

export function analyzeGsmFrames(hexLines: string[], frameCount: number): ChannelAnalysis {
	if (hexLines.length === 0 || frameCount === 0) {
		return { channelType: '', isControlChannel: false };
	}
	const { hasSI, hasPaging } = detectMessageTypes(hexLines);
	return classifyChannel(hasSI, hasPaging, frameCount);
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
/** Convert a possibly-hex tshark field to a decimal string */
function parseHexField(raw: string): string {
	const trimmed = raw.trim();
	if (!trimmed) return '';
	return trimmed.startsWith('0x') ? String(parseInt(trimmed, 16)) : trimmed;
}

/** Extract a non-empty trimmed string from a CSV part, or empty string */
function extractField(part: string | undefined): string {
	const trimmed = part?.trim();
	return trimmed || '';
}

/** Assign a value to a CellIdentity field if non-empty */
function assignIfPresent(result: CellIdentity, field: keyof CellIdentity, value: string): void {
	if (value) result[field] = value;
}

/** Apply one line of tshark CSV output to a CellIdentity (last non-empty wins) */
function applyCellLine(result: CellIdentity, line: string): void {
	const parts = line.split(',');
	assignIfPresent(result, 'mcc', extractField(parts[0]));
	assignIfPresent(result, 'mnc', extractField(parts[1]));
	assignIfPresent(result, 'lac', parseHexField(parts[2] ?? ''));
	assignIfPresent(result, 'ci', parseHexField(parts[3] ?? ''));
}

export function parseCellIdentity(tsharkOutput: string): CellIdentity {
	const result: CellIdentity = { mcc: '', mnc: '', lac: '', ci: '' };
	if (!tsharkOutput?.trim()) return result;

	const cellLines = tsharkOutput
		.trim()
		.split('\n')
		.filter((l: string) => l.trim() && !/^,*$/.test(l));

	for (const line of cellLines) applyCellLine(result, line);
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
/** Power (dBm) thresholds — sorted descending */
const POWER_THRESHOLDS: [number, string][] = [
	[-40, 'Excellent'],
	[-50, 'Very Strong'],
	[-60, 'Strong'],
	[-70, 'Good'],
	[-80, 'Moderate'],
	[-90, 'Weak']
];

/** Frame-count thresholds — sorted descending */
const FRAME_THRESHOLDS: [number, string][] = [
	[200, 'Excellent'],
	[150, 'Very Strong'],
	[100, 'Strong'],
	[50, 'Good'],
	[10, 'Moderate']
];

/** Walk a threshold table and return the first matching label */
function classifyByThreshold(value: number, table: [number, string][], fallback: string): string {
	return table.find(([min]) => value > min)?.[1] ?? fallback;
}

/** Classify power in dBm to a strength label */
function classifyByPower(power: number): string {
	return classifyByThreshold(power, POWER_THRESHOLDS, 'No Signal');
}

/** Classify frame count to a strength label */
function classifyByFrameCount(frameCount: number): string {
	if (frameCount <= 0) return 'No Signal';
	return classifyByThreshold(frameCount, FRAME_THRESHOLDS, 'Weak');
}

export function classifySignalStrength(power: number, frameCount: number): string {
	if (power > -100) return classifyByPower(power);
	return classifyByFrameCount(frameCount);
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
/** Check if cell identity has enough fields to be definitive */
function hasDefinitiveCellId(cellIdentity: CellIdentity): boolean {
	return Boolean(cellIdentity.mcc && cellIdentity.lac && cellIdentity.ci);
}

/** Fallback channel classification when no frame analysis or cell identity is available */
function fallbackChannelType(frameCount: number): ChannelAnalysis {
	if (frameCount > 10) return { channelType: 'BCCH/CCCH', isControlChannel: true };
	return { channelType: 'SDCCH', isControlChannel: false };
}

export function determineChannelType(
	cellIdentity: CellIdentity,
	frameAnalysis: ChannelAnalysis | null,
	frameCount: number
): ChannelAnalysis {
	if (frameCount === 0) return { channelType: '', isControlChannel: false };
	if (hasDefinitiveCellId(cellIdentity))
		return { channelType: 'BCCH/CCCH', isControlChannel: true };
	return frameAnalysis ?? fallbackChannelType(frameCount);
}
