/**
 * GSM Intelligent Scan — event builders for cell-identity and channel status
 *
 * Pure formatting functions that convert parsed cell-identity fields into
 * ScanEvent arrays.  No I/O, no process management — just event construction.
 * Consumed by gsm-scan-frequency-analysis.ts.
 */

import type { ScanEvent } from './gsm-scan-types';
import { createUpdateEvent } from './gsm-scan-types';

/** Count valid cell-identity lines in tshark output */
function countCellLines(tsharkOutput: string): number {
	return tsharkOutput
		.trim()
		.split('\n')
		.filter((l: string) => l.trim() && !/^,*$/.test(l)).length;
}

/** Encode cell identity presence as a 3-bit key: mcc|lac|ci */
function cellPresenceKey(cellMcc: string, cellLac: string, cellCi: string): number {
	return (cellMcc ? 4 : 0) | (cellLac ? 2 : 0) | (cellCi ? 1 : 0);
}

/** Map presence bitmask to completeness label */
const COMPLETENESS_MAP: Record<number, string> = {
	7: 'complete', // mcc + lac + ci
	3: 'missing-mcc', // lac + ci
	4: 'missing-lac-ci', // mcc only
	6: 'missing-lac-ci', // mcc + lac (no ci)
	5: 'missing-lac-ci' // mcc + ci (no lac — treat as partial)
};

/** Classify the completeness of parsed cell identity fields */
function classifyCellCompleteness(cellMcc: string, cellLac: string, cellCi: string): string {
	return COMPLETENESS_MAP[cellPresenceKey(cellMcc, cellLac, cellCi)] ?? 'incomplete';
}

/** Map cell completeness to a user-facing message */
function cellCompletenessMessage(
	label: string,
	completeness: string,
	cellMcc: string,
	cellLac: string,
	cellCi: string
): string {
	const messages: Record<string, string> = {
		complete: `${label} [PASS] Complete cell identity captured!`,
		'missing-mcc': `${label} [WARN] Partial: LAC/CI captured but no MCC/MNC (need IMSI packet)`,
		'missing-lac-ci': `${label} [WARN] Partial: MCC/MNC captured but no LAC/CI (need Cell Identity packet)`
	};
	return (
		messages[completeness] ??
		`${label} [WARN] Cell identity incomplete (MCC=${cellMcc || 'missing'}, LAC=${cellLac || 'missing'}, CI=${cellCi || 'missing'})`
	);
}

/**
 * Append cell-identity status events to the events array.
 *
 * Inspects which identity fields were captured and pushes
 * corresponding PASS / WARN messages.
 */
export function appendCellIdentityEvents(
	events: ScanEvent[],
	label: string,
	tsharkOutput: string,
	cellMcc: string,
	_cellMnc: string,
	cellLac: string,
	cellCi: string
): void {
	if (!tsharkOutput) {
		events.push(createUpdateEvent(`${label} [WARN] No cell identity data captured`));
		return;
	}
	events.push(
		createUpdateEvent(
			`${label} Found ${countCellLines(tsharkOutput)} packets with cell/identity data`
		)
	);
	const completeness = classifyCellCompleteness(cellMcc, cellLac, cellCi);
	events.push(
		createUpdateEvent(cellCompletenessMessage(label, completeness, cellMcc, cellLac, cellCi))
	);
}

/** Emit cell tower identification events */
function emitTowerIdentified(
	events: ScanEvent[],
	label: string,
	cellMcc: string,
	cellMnc: string | undefined,
	cellLac: string,
	cellCi: string
): void {
	events.push(
		createUpdateEvent(
			`${label} [RF] Cell Tower Identified: MCC=${cellMcc} MNC=${cellMnc || 'N/A'} LAC=${cellLac} CI=${cellCi}`
		)
	);
}

/** Emit channel-detected-without-identity warning events */
function emitChannelWarning(events: ScanEvent[], label: string, channelType: string): void {
	events.push(
		createUpdateEvent(
			`${label} [WARN] ${channelType || 'Unknown'} channel detected but no cell identity captured`
		)
	);
	events.push(
		createUpdateEvent(
			`${label} [TIP] TIP: Cell identity (MCC/LAC/CI) requires BCCH channel with System Information messages`
		)
	);
}

/**
 * Append channel-type status events to the events array.
 *
 * Reports identified cell towers or warns about incomplete captures.
 */
export function appendChannelEvents(
	events: ScanEvent[],
	label: string,
	cellMcc: string,
	cellMnc: string | undefined,
	cellLac: string,
	cellCi: string,
	frameCount: number,
	channelType: string
): void {
	if (cellMcc && cellLac && cellCi) {
		emitTowerIdentified(events, label, cellMcc, cellMnc, cellLac, cellCi);
	} else if (frameCount > 0) {
		emitChannelWarning(events, label, channelType);
	}
}
