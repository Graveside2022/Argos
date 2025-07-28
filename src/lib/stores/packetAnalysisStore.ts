import { writable, derived } from 'svelte/store';
import type { NetworkPacket as BaseNetworkPacket } from '$lib/server/wireshark';

// Extended NetworkPacket with data property for analysis
export interface NetworkPacket extends BaseNetworkPacket {
	data?: string;
}

// Enhanced packet interface with analysis fields
export interface AnalyzedPacket extends NetworkPacket {
	analysis: {
		isSuspicious: boolean;
		suspicionReasons: string[];
		category: 'normal' | 'suspicious' | 'malicious' | 'unknown';
		tags: string[];
		severity: number; // 0-10 scale
	};
	flaggedForReview?: boolean;
}

// Security alert interface
export interface SecurityAlert {
	id: string;
	timestamp: Date;
	severity: 'low' | 'medium' | 'high' | 'critical';
	type: string;
	message: string;
	relatedPackets: string[];
	resolved: boolean;
}

// Protocol statistics
export interface ProtocolStats {
	protocol: string;
	count: number;
	percentage: number;
	bytes: number;
}

// IP conversation tracking
export interface Conversation {
	src_ip: string;
	dst_ip: string;
	protocol: string;
	packetCount: number;
	bytesTransferred: number;
	startTime: Date;
	lastSeen: Date;
	ports: Set<number>;
	suspicious: boolean;
}

// SecurityAlert interface is imported from shared module

// Store for all analyzed packets
export const analyzedPackets = writable<AnalyzedPacket[]>([]);

// Store for security alerts
export const securityAlerts = writable<SecurityAlert[]>([]);

// Store for flagged packets
export const flaggedPackets = writable<AnalyzedPacket[]>([]);

// Configuration for analysis
export const analysisConfig = writable({
	maxPacketsToKeep: 10000,
	alertThresholds: {
		portScanningPackets: 20, // packets to different ports from same IP
		ddosPacketsPerSecond: 100,
		suspiciousPortThreshold: 1024,
		malformedPacketPercentage: 5
	},
	interestingPorts: new Set([22, 23, 80, 443, 3389, 5900, 8080, 8443]),
	suspiciousPorts: new Set([135, 139, 445, 1433, 3306, 5432, 6379, 27017])
});

// Derived store for protocol statistics
export const protocolStats = derived(
	analyzedPackets,
	($packets) => {
		const stats = new Map<string, { count: number; bytes: number }>();
		
		$packets.forEach(packet => {
			const existing = stats.get(packet.protocol) || { count: 0, bytes: 0 };
			stats.set(packet.protocol, {
				count: existing.count + 1,
				bytes: existing.bytes + packet.length
			});
		});
		
		const total = $packets.length;
		const result: ProtocolStats[] = [];
		
		stats.forEach((value, protocol) => {
			result.push({
				protocol,
				count: value.count,
				percentage: total > 0 ? (value.count / total) * 100 : 0,
				bytes: value.bytes
			});
		});
		
		return result.sort((a, b) => b.count - a.count);
	}
);

// Derived store for active conversations
export const activeConversations = derived(
	analyzedPackets,
	($packets) => {
		const conversations = new Map<string, Conversation>();
		
		$packets.forEach(packet => {
			const key = `${packet.src_ip}->${packet.dst_ip}`;
			const reverseKey = `${packet.dst_ip}->${packet.src_ip}`;
			
			// Check both directions to group bidirectional traffic
			let conv = conversations.get(key) || conversations.get(reverseKey);
			
			if (!conv) {
				conv = {
					src_ip: packet.src_ip,
					dst_ip: packet.dst_ip,
					protocol: packet.protocol,
					packetCount: 0,
					bytesTransferred: 0,
					startTime: packet.timestamp,
					lastSeen: packet.timestamp,
					ports: new Set(),
					suspicious: packet.analysis.isSuspicious
				};
				conversations.set(key, conv);
			}
			
			conv.packetCount++;
			conv.bytesTransferred += packet.length;
			conv.lastSeen = packet.timestamp;
			if (packet.analysis.isSuspicious) {
				conv.suspicious = true;
			}
			
			// Extract port info from packet info if available
			const portMatch = packet.info.match(/port (\d+)/i);
			if (portMatch) {
				conv.ports.add(parseInt(portMatch[1]));
			}
		});
		
		return Array.from(conversations.values())
			.sort((a, b) => b.packetCount - a.packetCount)
			.slice(0, 20); // Top 20 conversations
	}
);

// Derived store for suspicious activity summary
export const suspiciousActivity = derived(
	[analyzedPackets, securityAlerts],
	([$packets, $alerts]) => {
		const suspicious = $packets.filter(p => p.analysis.isSuspicious);
		const malicious = $packets.filter(p => p.analysis.category === 'malicious');
		const unresolvedAlerts = $alerts.filter(a => !a.resolved);
		
		return {
			suspiciousPackets: suspicious.length,
			maliciousPackets: malicious.length,
			totalAlerts: $alerts.length,
			unresolvedAlerts: unresolvedAlerts.length,
			criticalAlerts: unresolvedAlerts.filter(a => a.severity === 'critical').length,
			highAlerts: unresolvedAlerts.filter(a => a.severity === 'high').length
		};
	}
);

// Function to analyze a packet
export function analyzePacket(packet: NetworkPacket): AnalyzedPacket {
	const analysis = {
		isSuspicious: false,
		suspicionReasons: [] as string[],
		category: 'normal' as 'normal' | 'suspicious' | 'malicious' | 'unknown',
		tags: [] as string[],
		severity: 0
	};
	
	// Check for suspicious ports
	const portMatch = packet.info.match(/port (\d+)/gi);
	if (portMatch) {
		portMatch.forEach(match => {
			const port = parseInt(match.replace(/port /i, ''));
			if ([135, 139, 445, 1433, 3306, 5432, 6379, 27017].includes(port)) {
				analysis.isSuspicious = true;
				analysis.suspicionReasons.push(`Suspicious port ${port} detected`);
				analysis.severity = Math.max(analysis.severity, 6);
				analysis.tags.push('suspicious-port');
			}
		});
	}
	
	// Check for scanning patterns
	if (packet.protocol === 'TCP' && packet.info.includes('SYN') && !packet.info.includes('ACK')) {
		analysis.tags.push('syn-scan');
		analysis.severity = Math.max(analysis.severity, 3);
	}
	
	// Check for potential malicious IPs (simplified - in production use threat feeds)
	const suspiciousIPs = ['10.0.0.1', '192.168.1.1']; // Example only
	if (suspiciousIPs.includes(packet.src_ip)) {
		analysis.isSuspicious = true;
		analysis.suspicionReasons.push('Traffic from suspicious IP');
		analysis.severity = Math.max(analysis.severity, 7);
	}
	
	// Check for unusual protocols
	const unusualProtocols = ['ICMP', 'GRE', 'ESP'];
	if (unusualProtocols.includes(packet.protocol)) {
		analysis.tags.push('unusual-protocol');
		analysis.severity = Math.max(analysis.severity, 2);
	}
	
	// Check packet size anomalies
	if (packet.length > 1500) {
		analysis.tags.push('jumbo-frame');
		analysis.severity = Math.max(analysis.severity, 1);
	}
	if (packet.length < 20) {
		analysis.tags.push('tiny-packet');
		analysis.severity = Math.max(analysis.severity, 2);
	}
	
	// Determine category based on severity
	if (analysis.severity >= 7) {
		analysis.category = 'malicious';
	} else if (analysis.severity >= 4 || analysis.isSuspicious) {
		analysis.category = 'suspicious';
	} else if (analysis.severity > 0) {
		analysis.category = 'unknown';
	}
	
	return {
		...packet,
		analysis
	};
}

// Function to add and analyze a new packet
export function addPacket(packet: NetworkPacket) {
	const analyzed = analyzePacket(packet);
	
	analyzedPackets.update(packets => {
		// Keep only the last N packets
		const updated = [analyzed, ...packets].slice(0, 10000);
		return updated;
	});
	
	// Generate alerts if needed
	if (analyzed.analysis.category === 'malicious') {
		generateAlert('high', 'Malicious Activity Detected', 
			`Detected malicious traffic from ${analyzed.src_ip}`, [analyzed.id]);
	} else if (analyzed.analysis.category === 'suspicious' && analyzed.analysis.severity >= 6) {
		generateAlert('medium', 'Suspicious Activity', 
			analyzed.analysis.suspicionReasons.join(', '), [analyzed.id]);
	}
	
	return analyzed;
}

// Function to generate security alerts
export function generateAlert(
	severity: SecurityAlert['severity'],
	type: string,
	message: string,
	relatedPackets: string[]
) {
	const alert: SecurityAlert = {
		id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
		timestamp: new Date(),
		severity,
		type,
		message,
		relatedPackets,
		resolved: false
	};
	
	securityAlerts.update(alerts => [alert, ...alerts]);
}

// Function to flag a packet for review
export function flagPacketForReview(packetId: string) {
	analyzedPackets.update(packets => {
		return packets.map(p => {
			if (p.id === packetId) {
				p.flaggedForReview = true;
				flaggedPackets.update(flagged => [p, ...flagged]);
			}
			return p;
		});
	});
}

// Function to resolve an alert
export function resolveAlert(alertId: string) {
	securityAlerts.update(alerts => {
		return alerts.map(a => {
			if (a.id === alertId) {
				a.resolved = true;
			}
			return a;
		});
	});
}

// Function to detect port scanning
export function detectPortScanning(packets: AnalyzedPacket[]): void {
	const ipPortMap = new Map<string, Set<number>>();
	
	packets.forEach(packet => {
		const portMatch = packet.info.match(/port (\d+)/i);
		if (portMatch) {
			const port = parseInt(portMatch[1]);
			const ports = ipPortMap.get(packet.src_ip) || new Set();
			ports.add(port);
			ipPortMap.set(packet.src_ip, ports);
		}
	});
	
	ipPortMap.forEach((ports, ip) => {
		if (ports.size > 20) {
			generateAlert('high', 'Port Scanning Detected',
				`IP ${ip} has accessed ${ports.size} different ports`, []);
		}
	});
}

// Function to export packets for analysis
export function exportPackets(packets: AnalyzedPacket[], format: 'json' | 'csv' = 'json'): string {
	if (format === 'json') {
		return JSON.stringify(packets, null, 2);
	} else {
		// CSV export
		const headers = ['timestamp', 'src_ip', 'dst_ip', 'protocol', 'length', 'category', 'severity'];
		const rows = packets.map(p => [
			p.timestamp.toISOString(),
			p.src_ip,
			p.dst_ip,
			p.protocol,
			p.length.toString(),
			p.analysis.category,
			p.analysis.severity.toString()
		]);
		
		return [headers, ...rows].map(row => row.join(',')).join('\n');
	}
}