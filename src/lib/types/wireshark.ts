/**
 * Canonical Wireshark/packet capture type definitions.
 * Used by server/wireshark and related packet analysis modules.
 */

export interface NetworkPacket {
	id: string;
	timestamp: Date;
	src_ip: string;
	dst_ip: string;
	protocol: string;
	length: number;
	info: string;
}
