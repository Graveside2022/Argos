/**
 * GSM Layer 3 Message Type Decoders
 * Parses RR, MM, CC, and SMS protocol messages from byte arrays
 */

import type { L3DecodedMessage } from './l3-types';

/** Decode RR System Information messages (SI1-SI4) — returns null for non-SI types */
export function decodeRRSystemInfo(bytes: number[], msgType: number): L3DecodedMessage | null {
	switch (msgType) {
		case 0x19:
			return {
				messageType: 'System Information Type 1 (SI1)',
				protocol: 'RR',
				details: ['Cell channel description', 'RACH control parameters']
			};
		case 0x1a:
			return {
				messageType: 'System Information Type 2 (SI2)',
				protocol: 'RR',
				details: ['Neighbor cell description', 'BCCH frequency list']
			};
		case 0x1b:
			return decodeRRSysInfo3(bytes);
		case 0x1c:
			return {
				messageType: 'System Information Type 4 (SI4)',
				protocol: 'RR',
				details: ['LAC and Cell identity', 'CBCH channel description']
			};
		default:
			return null;
	}
}

/** Decode System Information Type 3 — extracts LAC and Cell Identity */
function decodeRRSysInfo3(bytes: number[]): L3DecodedMessage {
	const details: string[] = [];
	let lac: number | undefined;
	let ci: number | undefined;

	if (bytes.length >= 6) {
		lac = (bytes[4] << 8) | bytes[5];
		details.push(`LAC: ${lac}`);
	}
	if (bytes.length >= 8) {
		ci = (bytes[6] << 8) | bytes[7];
		details.push(`Cell Identity: ${ci}`);
	}

	return {
		messageType: 'System Information Type 3 (SI3)',
		protocol: 'RR',
		details: ['Cell identity', 'Location area', ...details],
		lac,
		ci
	};
}

/** Extract Mobile Identity from bytes at a given offset. Returns label + value, or null. */
function parseMobileIdentity(
	bytes: number[],
	offset: number,
	extractIMSI: (bytes: number[]) => string,
	extractTMSI: (bytes: number[]) => string
): { field: 'imsi' | 'tmsi'; value: string } | null {
	const len = bytes[offset + 1];
	const idType = bytes[offset + 2] & 0x07;
	const slice = bytes.slice(offset + 2, offset + 2 + len);
	if (idType === 0x01 && len >= 8) return { field: 'imsi', value: extractIMSI(slice) };
	if (idType === 0x04 && len >= 4) return { field: 'tmsi', value: extractTMSI(slice) };
	return null;
}

/** Scan byte array for Mobile Identity IEs starting with tag 0x17. */
function findMobileIdentities(
	bytes: number[],
	extractIMSI: (bytes: number[]) => string,
	extractTMSI: (bytes: number[]) => string
): Array<{ field: 'imsi' | 'tmsi'; value: string }> {
	const results: Array<{ field: 'imsi' | 'tmsi'; value: string }> = [];
	for (let i = 2; i < bytes.length - 1; i++) {
		if (bytes[i] !== 0x17) continue;
		const id = parseMobileIdentity(bytes, i, extractIMSI, extractTMSI);
		if (id) results.push(id);
	}
	return results;
}

/** Decode Paging Request Type 1 — scans for Mobile Identity IE to extract IMSI/TMSI */
export function decodeRRPagingRequest1(
	bytes: number[],
	extractIMSI: (bytes: number[]) => string,
	extractTMSI: (bytes: number[]) => string
): L3DecodedMessage {
	const identities = findMobileIdentities(bytes, extractIMSI, extractTMSI);
	const details = [
		'Paging for mobile stations',
		...identities.map((id) => `→ ${id.field.toUpperCase()}: ${id.value}`)
	];
	const imsi = identities.find((id) => id.field === 'imsi')?.value;
	const tmsi = identities.find((id) => id.field === 'tmsi')?.value;
	return { messageType: 'Paging Request Type 1', protocol: 'RR', details, imsi, tmsi };
}

/** Decode MM Identity Request — resolves identity type code to human-readable name */
export function decodeMMIdentityRequest(bytes: number[]): L3DecodedMessage {
	const idType = bytes[2] & 0x07;
	const idTypeNames: Record<number, string> = {
		0x01: 'IMSI',
		0x02: 'IMEI',
		0x03: 'IMEISV',
		0x04: 'TMSI'
	};
	const idName = idTypeNames[idType] || `Unknown (${idType})`;

	return {
		messageType: 'Identity Request',
		protocol: 'MM',
		details: [`Requesting: ${idName}`]
	};
}

/** Decode MM Identity Response — extracts IMSI or TMSI from mobile identity bytes */
export function decodeMMIdentityResponse(
	bytes: number[],
	extractIMSI: (bytes: number[]) => string,
	extractTMSI: (bytes: number[]) => string
): L3DecodedMessage {
	const details: string[] = [];
	const idType = bytes[3] & 0x07;
	let imsi: string | undefined;
	let tmsi: string | undefined;

	if (idType === 0x01) {
		imsi = extractIMSI(bytes.slice(3));
		details.push(`✓ IMSI: ${imsi}`);
	} else if (idType === 0x04) {
		tmsi = extractTMSI(bytes.slice(3));
		details.push(`TMSI: ${tmsi}`);
	}

	return {
		messageType: 'Identity Response',
		protocol: 'MM',
		details,
		imsi,
		tmsi
	};
}

/**
 * Decode Call Control (CC) messages
 */
export function decodeCC(_bytes: number[], msgType: number): L3DecodedMessage {
	switch (msgType) {
		case 0x05:
			return {
				messageType: 'Setup (Call)',
				protocol: 'CC',
				details: ['Call establishment']
			};
		case 0x07:
			return {
				messageType: 'Connect',
				protocol: 'CC',
				details: ['Call connected']
			};
		case 0x25:
			return {
				messageType: 'Disconnect',
				protocol: 'CC',
				details: ['Call terminating']
			};
		case 0x2d:
			return {
				messageType: 'Release',
				protocol: 'CC',
				details: ['Call released']
			};
		default:
			return {
				messageType: `CC Message 0x${msgType.toString(16).padStart(2, '0')}`,
				protocol: 'CC',
				details: [`Message type: 0x${msgType.toString(16).padStart(2, '0')}`]
			};
	}
}

/**
 * Decode SMS messages
 */
export function decodeSMS(bytes: number[], msgType: number): L3DecodedMessage {
	const details: string[] = [];

	switch (msgType) {
		case 0x01:
			details.push('SMS message transfer');
			return {
				messageType: 'CP-DATA (SMS)',
				protocol: 'SMS',
				details
			};
		case 0x04:
			return {
				messageType: 'CP-ACK (SMS)',
				protocol: 'SMS',
				details: ['SMS acknowledged']
			};
		default:
			return {
				messageType: `SMS Message 0x${msgType.toString(16).padStart(2, '0')}`,
				protocol: 'SMS',
				details: [`Message type: 0x${msgType.toString(16).padStart(2, '0')}`]
			};
	}
}
