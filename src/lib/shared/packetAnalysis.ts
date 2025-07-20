// Shared packet analysis logic that can be used on both client and server

export interface NetworkPacket {
	id: string;
	timestamp: Date;
	src_ip: string;
	dst_ip: string;
	protocol: string;
	length: number;
	info: string;
}

export interface AnalyzedPacket extends NetworkPacket {
	analysis: {
		isSuspicious: boolean;
		suspicionReasons: string[];
		category: 'normal' | 'suspicious' | 'malicious' | 'unknown' | 'scanning' | 'malware';
		tags: string[];
		severity: number; // 0-10 scale
	};
	flaggedForReview?: boolean;
}

export interface SecurityAlert {
	id: string;
	timestamp: Date;
	severity: 'low' | 'medium' | 'high' | 'critical';
	type: string;
	message: string;
	relatedPackets: string[];
	resolved: boolean;
	// Additional fields for API compatibility
	source?: string;
	destination?: string;
	description?: string;
	details?: any;
}

// Analyze individual packet for suspicious activity
export function analyzePacket(packet: NetworkPacket): AnalyzedPacket {
	const analysis = {
		isSuspicious: false,
		suspicionReasons: [] as string[],
		category: 'normal' as const,
		tags: [] as string[],
		severity: 0
	};
	
	// Check for suspicious ports
	const suspiciousPorts = [22, 23, 3389, 445, 135, 139, 1433, 3306];
	if (packet.info && suspiciousPorts.some(port => packet.info.includes(`:${port}`))) {
		analysis.isSuspicious = true;
		analysis.suspicionReasons.push('Connection to suspicious port');
		analysis.tags.push('suspicious_port');
		analysis.severity = 5;
	}
	
	// Check for scanning patterns
	if (packet.protocol === 'TCP' && packet.info && packet.info.includes('SYN')) {
		analysis.tags.push('syn_packet');
		if (packet.length < 60) {
			analysis.isSuspicious = true;
			analysis.suspicionReasons.push('Possible port scanning activity');
			analysis.category = 'scanning';
			analysis.severity = Math.max(analysis.severity, 4);
		}
	}
	
	// Check for large packets (potential data exfiltration)
	if (packet.length > 1400) {
		analysis.tags.push('large_packet');
		if (packet.protocol === 'UDP' || packet.protocol === 'ICMP') {
			analysis.isSuspicious = true;
			analysis.suspicionReasons.push('Unusually large packet size');
			analysis.severity = Math.max(analysis.severity, 3);
		}
	}
	
	// Check for ICMP (often used for reconnaissance)
	if (packet.protocol === 'ICMP') {
		analysis.tags.push('icmp');
		if (packet.length > 100) {
			analysis.isSuspicious = true;
			analysis.suspicionReasons.push('Large ICMP packet (possible data tunneling)');
			analysis.severity = Math.max(analysis.severity, 6);
		}
	}
	
	// Check for potential malware communication patterns
	if (packet.dst_ip && (
		packet.dst_ip.startsWith('10.') || 
		packet.dst_ip.startsWith('192.168.') || 
		packet.dst_ip.startsWith('172.')
	)) {
		// Internal traffic
		analysis.tags.push('internal');
	} else {
		// External traffic
		analysis.tags.push('external');
		if (packet.protocol === 'UDP' && packet.length === 512) {
			analysis.isSuspicious = true;
			analysis.suspicionReasons.push('Suspicious UDP packet size (common in malware)');
			analysis.category = 'malware';
			analysis.severity = Math.max(analysis.severity, 7);
		}
	}
	
	// Categorize based on analysis
	if (analysis.severity >= 7) {
		analysis.category = 'malicious';
	} else if (analysis.severity >= 4) {
		analysis.category = 'suspicious';
	} else if (analysis.severity > 0) {
		analysis.category = 'unknown';
	}
	
	return {
		...packet,
		analysis
	};
}