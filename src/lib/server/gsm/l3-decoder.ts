/**
 * GSM Layer 3 Message Decoder
 * Parses GSM RR, MM, and CM protocol messages
 */

import {
	decodeCC,
	decodeMMIdentityRequest,
	decodeMMIdentityResponse,
	decodeRRPagingRequest1,
	decodeRRSystemInfo,
	decodeSMS
} from './l3-message-decoders';
import type { L3DecodedMessage } from './l3-types';

// Re-export type for backward compatibility
export type { L3DecodedMessage } from './l3-types';

/** Convert hex string to byte array. */
function hexToBytes(hexData: string): number[] | null {
	if (!hexData || hexData.length < 4) return null;
	const hex = hexData.replace(/\s+/g, '');
	const bytes: number[] = [];
	for (let i = 0; i < hex.length; i += 2) {
		bytes.push(parseInt(hex.substr(i, 2), 16));
	}
	return bytes.length >= 2 ? bytes : null;
}

/** Protocol discriminator → decoder function. */
type PdDecoder = (bytes: number[], msgType: number) => L3DecodedMessage;
const PD_DECODERS: Record<number, PdDecoder> = {
	0x06: decodeRR,
	0x05: decodeMM,
	0x03: decodeCC,
	0x09: decodeSMS
};

/**
 * Decode GSM Layer 3 message from hex string
 */
export function decodeL3Message(hexData: string): L3DecodedMessage | null {
	const bytes = hexToBytes(hexData);
	if (!bytes) return null;

	const pd = (bytes[0] >> 4) & 0x0f;
	const decoder = PD_DECODERS[pd];
	if (decoder) return decoder(bytes, bytes[1]);

	return {
		messageType: 'Unknown',
		protocol: `PD=${pd.toString(16)}`,
		details: [`Protocol discriminator: 0x${pd.toString(16).padStart(2, '0')}`]
	};
}

/** Static RR message type descriptions. */
const RR_MESSAGES: Record<number, { messageType: string; details: string[] }> = {
	0x22: { messageType: 'Paging Request Type 2', details: ['Paging multiple mobile stations'] },
	0x3e: { messageType: 'Immediate Assignment', details: ['Channel allocation'] },
	0x3f: {
		messageType: 'Immediate Assignment Extended',
		details: ['Extended channel allocation']
	},
	0x06: { messageType: 'Paging Response', details: ['Mobile station responding to page'] },
	0x35: { messageType: 'Channel Release', details: ['Releasing dedicated channel'] }
};

/**
 * Decode Radio Resource Management (RR) messages
 */
function decodeRR(bytes: number[], msgType: number): L3DecodedMessage {
	const sysInfo = decodeRRSystemInfo(bytes, msgType);
	if (sysInfo) return sysInfo;
	if (msgType === 0x21) return decodeRRPagingRequest1(bytes, extractIMSI, extractTMSI);

	const entry = RR_MESSAGES[msgType];
	if (entry) return { ...entry, protocol: 'RR' };

	return {
		messageType: `RR Message 0x${msgType.toString(16).padStart(2, '0')}`,
		protocol: 'RR',
		details: [`Message type: 0x${msgType.toString(16).padStart(2, '0')}`]
	};
}

/** Dynamic MM decoders (require byte-level parsing). */
type MmDynamicDecoder = (bytes: number[]) => L3DecodedMessage;
const MM_DYNAMIC: Record<number, MmDynamicDecoder> = {
	0x18: (bytes) => decodeMMIdentityRequest(bytes),
	0x19: (bytes) => decodeMMIdentityResponse(bytes, extractIMSI, extractTMSI)
};

/** Static MM message type descriptions. */
const MM_MESSAGES: Record<number, { messageType: string; details: string[] }> = {
	0x01: { messageType: 'IMSI Detach Indication', details: ['Mobile station detaching'] },
	0x04: { messageType: 'TMSI Reallocation Command', details: ['Network assigning new TMSI'] },
	0x08: { messageType: 'Location Updating Request', details: ['Mobile registering location'] },
	0x02: { messageType: 'Location Updating Accept', details: ['Location update successful'] },
	0x11: { messageType: 'Authentication Request', details: ['Network requesting authentication'] },
	0x14: { messageType: 'Authentication Response', details: ['Mobile providing authentication'] }
};

/**
 * Decode Mobility Management (MM) messages
 */
function decodeMM(bytes: number[], msgType: number): L3DecodedMessage {
	const dynamic = MM_DYNAMIC[msgType];
	if (dynamic) return dynamic(bytes);

	const entry = MM_MESSAGES[msgType];
	if (entry) return { ...entry, protocol: 'MM' };

	return {
		messageType: `MM Message 0x${msgType.toString(16).padStart(2, '0')}`,
		protocol: 'MM',
		details: [`Message type: 0x${msgType.toString(16).padStart(2, '0')}`]
	};
}

/**
 * Extract IMSI from Mobile Identity bytes
 */
/** Extract a single BCD digit pair from one byte, filtering 0x0F padding. */
function decodeBcdPair(byte: number, isLast: boolean): string {
	const lo = byte & 0x0f;
	const hi = (byte >> 4) & 0x0f;
	const d1 = lo !== 0x0f ? lo.toString() : '';
	const d2 = hi !== 0x0f && !isLast ? hi.toString() : '';
	return d1 + d2;
}

function extractIMSI(bytes: number[]): string {
	return bytes
		.slice(1)
		.map((b, i, arr) => decodeBcdPair(b, i === arr.length - 1))
		.join('');
}

/**
 * Extract TMSI from Mobile Identity bytes
 */
function extractTMSI(bytes: number[]): string {
	if (bytes.length >= 5) {
		const tmsi = (bytes[1] << 24) | (bytes[2] << 16) | (bytes[3] << 8) | bytes[4];
		return `0x${tmsi.toString(16).padStart(8, '0')}`;
	}
	return 'N/A';
}
