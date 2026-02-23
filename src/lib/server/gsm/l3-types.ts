/**
 * Shared types for GSM Layer 3 message decoding.
 * Extracted to break the circular dependency between l3-decoder.ts and l3-message-decoders.ts.
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
