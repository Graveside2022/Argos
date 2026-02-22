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

export interface L3DecodedMessage {
	messageType: string;
	protocol: string;
	details: string[];
	imsi?: string;
	tmsi?: string;
	lac?: number;
	ci?: number;
}

/**
 * Decode GSM Layer 3 message from hex string
 */
export function decodeL3Message(hexData: string): L3DecodedMessage | null {
	if (!hexData || hexData.length < 4) {
		return null;
	}

	const hex = hexData.replace(/\s+/g, '');
	const bytes: number[] = [];
	for (let i = 0; i < hex.length; i += 2) {
		bytes.push(parseInt(hex.substr(i, 2), 16));
	}

	if (bytes.length < 2) {
		return null;
	}

	const pd = (bytes[0] >> 4) & 0x0f;
	const messageType = bytes[1];

	switch (pd) {
		case 0x06:
			return decodeRR(bytes, messageType);
		case 0x05:
			return decodeMM(bytes, messageType);
		case 0x03:
			return decodeCC(bytes, messageType);
		case 0x09:
			return decodeSMS(bytes, messageType);
		default:
			return {
				messageType: 'Unknown',
				protocol: `PD=${pd.toString(16)}`,
				details: [`Protocol discriminator: 0x${pd.toString(16).padStart(2, '0')}`]
			};
	}
}

/**
 * Decode Radio Resource Management (RR) messages
 */
function decodeRR(bytes: number[], msgType: number): L3DecodedMessage {
	const sysInfo = decodeRRSystemInfo(bytes, msgType);
	if (sysInfo) return sysInfo;

	switch (msgType) {
		case 0x21:
			return decodeRRPagingRequest1(bytes, extractIMSI, extractTMSI);
		case 0x22:
			return {
				messageType: 'Paging Request Type 2',
				protocol: 'RR',
				details: ['Paging multiple mobile stations']
			};
		case 0x3e:
			return {
				messageType: 'Immediate Assignment',
				protocol: 'RR',
				details: ['Channel allocation']
			};
		case 0x3f:
			return {
				messageType: 'Immediate Assignment Extended',
				protocol: 'RR',
				details: ['Extended channel allocation']
			};
		case 0x06:
			return {
				messageType: 'Paging Response',
				protocol: 'RR',
				details: ['Mobile station responding to page']
			};
		case 0x35:
			return {
				messageType: 'Channel Release',
				protocol: 'RR',
				details: ['Releasing dedicated channel']
			};
		default:
			return {
				messageType: `RR Message 0x${msgType.toString(16).padStart(2, '0')}`,
				protocol: 'RR',
				details: [`Message type: 0x${msgType.toString(16).padStart(2, '0')}`]
			};
	}
}

/**
 * Decode Mobility Management (MM) messages
 */
function decodeMM(bytes: number[], msgType: number): L3DecodedMessage {
	switch (msgType) {
		case 0x18:
			return decodeMMIdentityRequest(bytes);
		case 0x19:
			return decodeMMIdentityResponse(bytes, extractIMSI, extractTMSI);
		case 0x01:
			return {
				messageType: 'IMSI Detach Indication',
				protocol: 'MM',
				details: ['Mobile station detaching']
			};
		case 0x04:
			return {
				messageType: 'TMSI Reallocation Command',
				protocol: 'MM',
				details: ['Network assigning new TMSI']
			};
		case 0x08:
			return {
				messageType: 'Location Updating Request',
				protocol: 'MM',
				details: ['Mobile registering location']
			};
		case 0x02:
			return {
				messageType: 'Location Updating Accept',
				protocol: 'MM',
				details: ['Location update successful']
			};
		case 0x11:
			return {
				messageType: 'Authentication Request',
				protocol: 'MM',
				details: ['Network requesting authentication']
			};
		case 0x14:
			return {
				messageType: 'Authentication Response',
				protocol: 'MM',
				details: ['Mobile providing authentication']
			};
		default:
			return {
				messageType: `MM Message 0x${msgType.toString(16).padStart(2, '0')}`,
				protocol: 'MM',
				details: [`Message type: 0x${msgType.toString(16).padStart(2, '0')}`]
			};
	}
}

/**
 * Extract IMSI from Mobile Identity bytes
 */
function extractIMSI(bytes: number[]): string {
	let imsi = '';
	for (let i = 1; i < bytes.length; i++) {
		const digit1 = bytes[i] & 0x0f;
		const digit2 = (bytes[i] >> 4) & 0x0f;

		if (digit1 !== 0x0f) imsi += digit1.toString();
		if (digit2 !== 0x0f && i < bytes.length - 1) imsi += digit2.toString();
	}
	return imsi;
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
