import { json } from '@sveltejs/kit';
import { wiresharkController } from '$lib/server/wireshark';
import type { RequestHandler } from './$types';
import type { NetworkPacket } from '$lib/server/wireshark';

// Track protocol statistics
const protocolStats: Record<string, number> = {};
const ipStats: Record<string, { sent: number; received: number }> = {};
let totalPackets = 0;
let totalBytes = 0;
let startTime = new Date();

// Listen for new packets and update stats
wiresharkController.on('packet', (packet: NetworkPacket) => {
	totalPackets++;
	totalBytes += packet.length;
	
	// Update protocol stats
	protocolStats[packet.protocol] = (protocolStats[packet.protocol] || 0) + 1;
	
	// Update IP stats
	if (!ipStats[packet.src_ip]) {
		ipStats[packet.src_ip] = { sent: 0, received: 0 };
	}
	if (!ipStats[packet.dst_ip]) {
		ipStats[packet.dst_ip] = { sent: 0, received: 0 };
	}
	
	ipStats[packet.src_ip].sent++;
	ipStats[packet.dst_ip].received++;
});

// Reset stats when Wireshark starts
wiresharkController.on('started', () => {
	Object.keys(protocolStats).forEach(key => delete protocolStats[key]);
	Object.keys(ipStats).forEach(key => delete ipStats[key]);
	totalPackets = 0;
	totalBytes = 0;
	startTime = new Date();
});

export const GET: RequestHandler = async ({ url }) => {
	try {
		const detailed = url.searchParams.get('detailed') === 'true';
		const wiresharkStatus = wiresharkController.getStatus();
		
		const uptimeSeconds = Math.floor((Date.now() - startTime.getTime()) / 1000);
		const packetsPerSecond = uptimeSeconds > 0 ? totalPackets / uptimeSeconds : 0;
		const bytesPerSecond = uptimeSeconds > 0 ? totalBytes / uptimeSeconds : 0;
		
		const basicStats = {
			wireshark: wiresharkStatus,
			capture: {
				totalPackets,
				totalBytes,
				packetsPerSecond: Math.round(packetsPerSecond * 100) / 100,
				bytesPerSecond: Math.round(bytesPerSecond),
				uptimeSeconds,
				startTime: startTime.toISOString()
			},
			protocols: Object.entries(protocolStats)
				.sort(([,a], [,b]) => b - a)
				.slice(0, 10)
				.reduce((acc, [protocol, count]) => {
					acc[protocol] = count;
					return acc;
				}, {} as Record<string, number>)
		};
		
		if (!detailed) {
			return json(basicStats);
		}
		
		// Get top talkers (most active IPs)
		const topTalkers = Object.entries(ipStats)
			.map(([ip, stats]) => ({
				ip,
				totalPackets: stats.sent + stats.received,
				sent: stats.sent,
				received: stats.received
			}))
			.sort((a, b) => b.totalPackets - a.totalPackets)
			.slice(0, 20);
		
		// Calculate protocol distribution percentages
		const protocolDistribution = Object.entries(protocolStats)
			.map(([protocol, count]) => ({
				protocol,
				count,
				percentage: Math.round((count / totalPackets) * 100 * 100) / 100
			}))
			.sort((a, b) => b.count - a.count);
		
		return json({
			...basicStats,
			detailed: {
				topTalkers,
				protocolDistribution,
				totalUniqueIPs: Object.keys(ipStats).length,
				averagePacketSize: totalPackets > 0 ? Math.round(totalBytes / totalPackets) : 0
			}
		});
		
	} catch (error) {
		console.error('Failed to get stats:', error);
		return json({
			error: 'Failed to retrieve statistics',
			message: error.message
		}, { status: 500 });
	}
};

export const DELETE: RequestHandler = async () => {
	try {
		// Reset all statistics
		Object.keys(protocolStats).forEach(key => delete protocolStats[key]);
		Object.keys(ipStats).forEach(key => delete ipStats[key]);
		totalPackets = 0;
		totalBytes = 0;
		startTime = new Date();
		
		return json({
			success: true,
			message: 'Statistics reset'
		});
		
	} catch (error) {
		console.error('Failed to reset stats:', error);
		return json({
			error: 'Failed to reset statistics',
			message: error.message
		}, { status: 500 });
	}
};