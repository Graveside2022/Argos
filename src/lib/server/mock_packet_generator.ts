import type { NetworkPacket } from './wireshark';

export class MockPacketGenerator {
	private intervalId: NodeJS.Timeout | null = null;
	private packetCount = 0;
	private startTime = Date.now();
	
	// Common IP addresses and protocols for realistic traffic
	private readonly ipAddresses = [
		'192.168.1.1', '192.168.1.100', '192.168.1.101', '192.168.1.102',
		'10.0.0.1', '10.0.0.50', '10.0.0.51',
		'172.16.0.1', '172.16.0.10',
		'8.8.8.8', '8.8.4.4', // Google DNS
		'1.1.1.1', '1.0.0.1', // Cloudflare DNS
		'208.67.222.222', // OpenDNS
		'93.184.216.34', // example.com
		'151.101.1.140', // reddit.com
		'104.26.10.78', // cloudflare site
		'140.82.114.4' // github.com
	];
	
	private readonly protocols = [
		{ name: 'TCP', weight: 50, ports: [80, 443, 22, 3389, 8080] },
		{ name: 'UDP', weight: 30, ports: [53, 123, 161, 500] },
		{ name: 'ICMP', weight: 10, ports: [] },
		{ name: 'HTTP', weight: 5, ports: [80] },
		{ name: 'HTTPS', weight: 5, ports: [443] }
	];
	
	private readonly packetSizes = [
		{ min: 40, max: 100, weight: 30 }, // Small packets
		{ min: 100, max: 500, weight: 40 }, // Medium packets
		{ min: 500, max: 1500, weight: 25 }, // Large packets
		{ min: 1500, max: 9000, weight: 5 } // Jumbo frames
	];
	
	generatePacket(): NetworkPacket {
		this.packetCount++;
		
		// Select random source and destination IPs
		const srcIp = this.ipAddresses[Math.floor(Math.random() * this.ipAddresses.length)];
		let dstIp = this.ipAddresses[Math.floor(Math.random() * this.ipAddresses.length)];
		
		// Ensure src and dst are different
		while (dstIp === srcIp) {
			dstIp = this.ipAddresses[Math.floor(Math.random() * this.ipAddresses.length)];
		}
		
		// Select protocol based on weights
		const protocol = this.selectWeighted(this.protocols);
		
		// Select packet size based on weights
		const sizeRange = this.selectWeighted(this.packetSizes);
		const length = Math.floor(Math.random() * (sizeRange.max - sizeRange.min + 1)) + sizeRange.min;
		
		// Generate info based on protocol
		let info = '';
		if (protocol.name === 'TCP' || protocol.name === 'HTTP' || protocol.name === 'HTTPS') {
			const port = protocol.ports[Math.floor(Math.random() * protocol.ports.length)];
			const flags = ['SYN', 'ACK', 'PSH ACK', 'FIN ACK', 'RST'];
			const flag = flags[Math.floor(Math.random() * flags.length)];
			info = `${port} → ${Math.floor(Math.random() * 50000) + 10000} [${flag}] Seq=${Math.floor(Math.random() * 1000000)}`;
		} else if (protocol.name === 'UDP') {
			const port = protocol.ports[Math.floor(Math.random() * protocol.ports.length)];
			info = `Source port: ${Math.floor(Math.random() * 50000) + 10000}  Destination port: ${port}`;
		} else if (protocol.name === 'ICMP') {
			const types = ['Echo Request', 'Echo Reply', 'Destination Unreachable', 'Time Exceeded'];
			info = types[Math.floor(Math.random() * types.length)];
		}
		
		return {
			id: `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
			timestamp: new Date(),
			src_ip: srcIp,
			dst_ip: dstIp,
			protocol: protocol.name,
			length,
			info
		};
	}
	
	private selectWeighted<T extends { weight: number }>(items: T[]): T {
		const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
		let random = Math.random() * totalWeight;
		
		for (const item of items) {
			random -= item.weight;
			if (random <= 0) {
				return item;
			}
		}
		
		return items[items.length - 1];
	}
	
	start(callback: (packet: NetworkPacket) => void, packetsPerSecond: number = 10): void {
		if (this.intervalId) {
			this.stop();
		}
		
		this.startTime = Date.now();
		this.packetCount = 0;
		
		// Generate packets at specified rate
		const interval = 1000 / packetsPerSecond;
		
		this.intervalId = setInterval(() => {
			// Generate 1-3 packets per interval for more realistic bursts
			const burstSize = Math.floor(Math.random() * 3) + 1;
			for (let i = 0; i < burstSize; i++) {
				const packet = this.generatePacket();
				callback(packet);
			}
		}, interval);
	}
	
	stop(): void {
		if (this.intervalId) {
			clearInterval(this.intervalId);
			this.intervalId = null;
		}
	}
	
	getStats() {
		const uptime = Math.floor((Date.now() - this.startTime) / 1000);
		const rate = uptime > 0 ? Math.round(this.packetCount / uptime) : 0;
		
		return {
			packets: this.packetCount,
			uptime,
			rate
		};
	}
}