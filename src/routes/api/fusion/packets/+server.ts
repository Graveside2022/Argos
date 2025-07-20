import { json } from '@sveltejs/kit';
import { wiresharkController } from '$lib/server/wireshark';
import type { RequestHandler } from './$types';
import type { NetworkPacket } from '$lib/server/wireshark';

// Store recent packets in memory for API access
const recentPackets: NetworkPacket[] = [];
const MAX_STORED_PACKETS = 1000;

// Listen for new packets and store them
wiresharkController.on('packet', (packet: NetworkPacket) => {
	recentPackets.push(packet);
	
	// Keep only recent packets to prevent memory issues
	if (recentPackets.length > MAX_STORED_PACKETS) {
		recentPackets.splice(0, recentPackets.length - MAX_STORED_PACKETS);
	}
});

export const GET: RequestHandler = async ({ url }) => {
	try {
		const limit = parseInt(url.searchParams.get('limit') || '100');
		const offset = parseInt(url.searchParams.get('offset') || '0');
		const protocol = url.searchParams.get('protocol');
		const srcIp = url.searchParams.get('src_ip');
		const dstIp = url.searchParams.get('dst_ip');
		
		// Filter packets based on query parameters
		let filteredPackets = [...recentPackets];
		
		if (protocol) {
			filteredPackets = filteredPackets.filter(p => 
				p.protocol.toLowerCase().includes(protocol.toLowerCase())
			);
		}
		
		if (srcIp) {
			filteredPackets = filteredPackets.filter(p => p.src_ip.includes(srcIp));
		}
		
		if (dstIp) {
			filteredPackets = filteredPackets.filter(p => p.dst_ip.includes(dstIp));
		}
		
		// Sort by timestamp (newest first)
		filteredPackets.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
		
		// Apply pagination
		const paginatedPackets = filteredPackets.slice(offset, offset + limit);
		
		return json({
			packets: paginatedPackets,
			total: filteredPackets.length,
			limit,
			offset,
			hasMore: offset + limit < filteredPackets.length
		});
		
	} catch (error) {
		console.error('Failed to get packets:', error);
		return json({
			error: 'Failed to retrieve packets',
			message: error.message
		}, { status: 500 });
	}
};

export const DELETE: RequestHandler = async () => {
	try {
		// Clear stored packets
		recentPackets.length = 0;
		
		return json({
			success: true,
			message: 'Packet history cleared'
		});
		
	} catch (error) {
		console.error('Failed to clear packets:', error);
		return json({
			error: 'Failed to clear packets',
			message: error.message
		}, { status: 500 });
	}
};