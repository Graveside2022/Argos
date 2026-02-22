/**
 * GSM Layer 3 Message Decoder
 * Parses GSM RR, MM, and CM protocol messages
 */

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

	// Remove spaces and convert to bytes
	const hex = hexData.replace(/\s+/g, '');
	const bytes: number[] = [];
	for (let i = 0; i < hex.length; i += 2) {
		bytes.push(parseInt(hex.substr(i, 2), 16));
	}

	if (bytes.length < 2) {
		return null;
	}

	// Protocol Discriminator is in upper 4 bits of byte 0
	const pd = (bytes[0] >> 4) & 0x0f;
	const messageType = bytes[1];

	// Decode based on protocol discriminator
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

/** Decode RR System Information messages (SI1-SI4) — returns null for non-SI types */
function decodeRRSystemInfo(bytes: number[], msgType: number): L3DecodedMessage | null {
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

	// LAC is at bytes 4-5, CI is at bytes 6-7 (if present)
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

/** Decode Paging Request Type 1 — scans for Mobile Identity IE to extract IMSI/TMSI */
function decodeRRPagingRequest1(bytes: number[]): L3DecodedMessage {
	const details: string[] = ['Paging for mobile stations'];
	let imsi: string | undefined;
	let tmsi: string | undefined;

	// Look for Mobile Identity IE (tag 0x17)
	for (let i = 2; i < bytes.length - 1; i++) {
		if (bytes[i] === 0x17) {
			const len = bytes[i + 1];
			const idType = bytes[i + 2] & 0x07;

			if (idType === 0x01 && len >= 8) {
				// IMSI
				imsi = extractIMSI(bytes.slice(i + 2, i + 2 + len));
				details.push(`→ IMSI: ${imsi}`);
			} else if (idType === 0x04 && len >= 4) {
				// TMSI
				tmsi = extractTMSI(bytes.slice(i + 2, i + 2 + len));
				details.push(`→ TMSI: ${tmsi}`);
			}
		}
	}

	return {
		messageType: 'Paging Request Type 1',
		protocol: 'RR',
		details,
		imsi,
		tmsi
	};
}

/**
 * Decode Radio Resource Management (RR) messages
 */
function decodeRR(bytes: number[], msgType: number): L3DecodedMessage {
	// System Information messages (SI1-SI4)
	const sysInfo = decodeRRSystemInfo(bytes, msgType);
	if (sysInfo) return sysInfo;

	switch (msgType) {
		case 0x21:
			return decodeRRPagingRequest1(bytes);
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

/** Decode MM Identity Request — resolves identity type code to human-readable name */
function decodeMMIdentityRequest(bytes: number[]): L3DecodedMessage {
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
function decodeMMIdentityResponse(bytes: number[]): L3DecodedMessage {
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
 * Decode Mobility Management (MM) messages
 */
function decodeMM(bytes: number[], msgType: number): L3DecodedMessage {
	switch (msgType) {
		case 0x18:
			return decodeMMIdentityRequest(bytes);
		case 0x19:
			return decodeMMIdentityResponse(bytes);
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
 * Decode Call Control (CC) messages
 */
function decodeCC(_bytes: number[], msgType: number): L3DecodedMessage {
	const _details: string[] = [];

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
function decodeSMS(bytes: number[], msgType: number): L3DecodedMessage {
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

/**
 * Extract IMSI from Mobile Identity bytes
 */
function extractIMSI(bytes: number[]): string {
	let imsi = '';
	// Skip first byte (length and type), start from digit extraction
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
