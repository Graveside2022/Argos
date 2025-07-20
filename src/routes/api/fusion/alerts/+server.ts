import { json } from '@sveltejs/kit';
import { wiresharkController } from '$lib/server/wireshark';
import { analyzePacket } from '$lib/shared/packetAnalysis';
import type { RequestHandler } from './$types';
import type { NetworkPacket } from '$lib/server/wireshark';
import type { SecurityAlert } from '$lib/shared/packetAnalysis';

// Store security alerts
const alerts: SecurityAlert[] = [];
const MAX_STORED_ALERTS = 500;

// Listen for new packets and analyze for security threats
wiresharkController.on('packet', (packet: NetworkPacket) => {
	const analysis = analyzePacket(packet);
	
	if (analysis.isSuspicious) {
		const alert: SecurityAlert = {
			id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
			timestamp: packet.timestamp,
			severity: analysis.severity >= 7 ? 'critical' : 
			         analysis.severity >= 5 ? 'high' :
			         analysis.severity >= 3 ? 'medium' : 'low',
			type: analysis.category === 'scanning' ? 'port_scan' : 
			       analysis.category === 'suspicious' ? 'suspicious_traffic' :
			       analysis.category === 'malware' ? 'malware_traffic' : 'anomaly',
			message: analysis.suspicionReasons.join(', '),
			relatedPackets: [packet.id],
			resolved: false,
			// Additional fields
			source: packet.src_ip,
			destination: packet.dst_ip,
			description: analysis.suspicionReasons.join(', '),
			details: {
				protocol: packet.protocol,
				packetLength: packet.length,
				packetInfo: packet.info,
				suspicionReasons: analysis.suspicionReasons,
				tags: analysis.tags
			}
		};
		
		alerts.push(alert);
		
		// Keep only recent alerts
		if (alerts.length > MAX_STORED_ALERTS) {
			alerts.splice(0, alerts.length - MAX_STORED_ALERTS);
		}
		
		// Log high severity alerts
		if (alert.severity >= 7) {
			console.warn(`🚨 HIGH SEVERITY ALERT: ${alert.description} (${alert.source} -> ${alert.destination})`);
		}
	}
});

export const GET: RequestHandler = async ({ url }) => {
	try {
		const limit = parseInt(url.searchParams.get('limit') || '50');
		const offset = parseInt(url.searchParams.get('offset') || '0');
		const severity = url.searchParams.get('severity');
		const type = url.searchParams.get('type');
		const source = url.searchParams.get('source');
		
		// Filter alerts based on query parameters
		let filteredAlerts = [...alerts];
		
		if (severity) {
			// Filter by severity level (critical > high > medium > low)
			const severityLevels = ['low', 'medium', 'high', 'critical'];
			const minSeverityIndex = severityLevels.indexOf(severity);
			if (minSeverityIndex !== -1) {
				filteredAlerts = filteredAlerts.filter(alert => {
					const alertSeverityIndex = severityLevels.indexOf(alert.severity);
					return alertSeverityIndex >= minSeverityIndex;
				});
			}
		}
		
		if (type) {
			filteredAlerts = filteredAlerts.filter(alert => alert.type === type);
		}
		
		if (source) {
			filteredAlerts = filteredAlerts.filter(alert => 
				alert.source.includes(source) || alert.destination.includes(source)
			);
		}
		
		// Sort by timestamp (newest first)
		filteredAlerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
		
		// Apply pagination
		const paginatedAlerts = filteredAlerts.slice(offset, offset + limit);
		
		// Calculate alert summary statistics
		const summary = {
			total: filteredAlerts.length,
			critical: filteredAlerts.filter(a => a.severity === 'critical').length,
			high: filteredAlerts.filter(a => a.severity === 'high').length,
			medium: filteredAlerts.filter(a => a.severity === 'medium').length,
			low: filteredAlerts.filter(a => a.severity === 'low').length,
			byType: filteredAlerts.reduce((acc, alert) => {
				acc[alert.type] = (acc[alert.type] || 0) + 1;
				return acc;
			}, {} as Record<string, number>),
			recentActivity: filteredAlerts.filter(a => 
				Date.now() - a.timestamp.getTime() < 5 * 60 * 1000 // Last 5 minutes
			).length
		};
		
		return json({
			alerts: paginatedAlerts,
			summary,
			limit,
			offset,
			hasMore: offset + limit < filteredAlerts.length
		});
		
	} catch (error) {
		console.error('Failed to get alerts:', error);
		return json({
			error: 'Failed to retrieve alerts',
			message: error.message
		}, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ url }) => {
	try {
		const alertId = url.searchParams.get('id');
		
		if (alertId) {
			// Delete specific alert
			const index = alerts.findIndex(alert => alert.id === alertId);
			if (index !== -1) {
				alerts.splice(index, 1);
				return json({
					success: true,
					message: 'Alert deleted'
				});
			} else {
				return json({
					error: 'Alert not found'
				}, { status: 404 });
			}
		} else {
			// Clear all alerts
			alerts.length = 0;
			return json({
				success: true,
				message: 'All alerts cleared'
			});
		}
		
	} catch (error) {
		console.error('Failed to delete alerts:', error);
		return json({
			error: 'Failed to delete alerts',
			message: error.message
		}, { status: 500 });
	}
};

// Mark alert as acknowledged
export const PATCH: RequestHandler = async ({ request }) => {
	try {
		const { id, acknowledged } = await request.json();
		
		const alert = alerts.find(a => a.id === id);
		if (!alert) {
			return json({
				error: 'Alert not found'
			}, { status: 404 });
		}
		
		// Add acknowledged field to alert details
		alert.details = {
			...alert.details,
			acknowledged: acknowledged || false,
			acknowledgedAt: acknowledged ? new Date().toISOString() : undefined
		};
		
		return json({
			success: true,
			message: acknowledged ? 'Alert acknowledged' : 'Alert unacknowledged',
			alert
		});
		
	} catch (error) {
		console.error('Failed to update alert:', error);
		return json({
			error: 'Failed to update alert',
			message: error.message
		}, { status: 500 });
	}
};