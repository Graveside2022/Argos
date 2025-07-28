import { spawn, type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';

export interface NetworkPacket {
	id: string;
	timestamp: Date;
	src_ip: string;
	dst_ip: string;
	protocol: string;
	length: number;
	info: string;
}

export interface WiresharkStats {
	interface: string;
	packets_captured: number;
	packets_per_second: number;
	bytes_captured: number;
	uptime: number;
}

export class WiresharkController extends EventEmitter {
	private process: ChildProcess | null = null;
	private interface: string = 'eth0';
	private isRunning = false;
	private packetCount = 0;
	private startTime: Date | null = null;
	private lastPacketTime: Date | null = null;
	private packetsPerSecond = 0;
	
	constructor(networkInterface: string = 'eth0') {
		super();
		this.interface = networkInterface;
	}
	
	async start(): Promise<void> {
		if (this.isRunning) {
			throw new Error('Wireshark is already running');
		}
		
		try {
			console.log('Starting Wireshark capture...');
			// Try to use real packet capture
			await this.tryRealCapture();
			console.log('Wireshark capture started');
			
		} catch (error) {
			console.error('Wireshark start error:', error);
			this.isRunning = false;
			throw new Error(`Failed to start Wireshark: ${error instanceof Error ? (error as Error).message : String(error)}`);
		}
	}
	
	private async tryRealCapture(): Promise<boolean> {
		try {
			// Check if tshark is available
			await this.checkTsharkAvailable();
			
			// Configure tshark arguments for JSON output with continuous capture
			const args = [
				'-i', this.interface,
				'-l',                    // Line buffered output
				'-T', 'json',           // JSON output format
				'-e', 'frame.time',     // Timestamp
				'-e', 'ip.src',         // Source IP
				'-e', 'ip.dst',         // Destination IP
				'-e', 'frame.protocols',// Protocol stack
				'-e', 'frame.len',      // Frame length
				'-f', 'ip',             // Only capture IP traffic
				'-c', '10'              // Capture 10 packets at a time for streaming
			];
			
			// Try without sudo first (if capabilities are set)
			this.process = spawn('tshark', args);
			
			// Wait a bit to see if it starts successfully
			await new Promise((resolve, reject) => {
				let errorData = '';
				
				const timeout = setTimeout(() => {
					if (errorData.includes('permission') || errorData.includes('permitted')) {
						reject(new Error('Permission denied'));
					} else {
						resolve(true);
					}
				}, 1000);
				
				this.process!.stderr?.once('data', (data) => {
					errorData += data.toString();
					clearTimeout(timeout);
					
					if (data.toString().includes('permission') || data.toString().includes('permitted')) {
						this.process!.kill();
						this.process = null;
						reject(new Error('Permission denied'));
					}
				});
				
				this.process!.on('error', (error) => {
					clearTimeout(timeout);
					reject(error);
				});
			});
			
			// If we get here, tshark started successfully
			this.startTime = new Date();
			this.packetCount = 0;
			this.isRunning = true;
			
			this.setupPacketStream();
			this.setupProcessHandlers();
			
			console.log(`✅ Wireshark started on interface ${this.interface}`);
			this.emit('started', { interface: this.interface });
			
			return true;
			
		} catch (error) {
			// Clean up failed process
			if (this.process) {
				this.process.kill();
				this.process = null;
			}
			
			throw error;
		}
	}
	
	
	async stop(): Promise<void> {
		if (!this.isRunning) {
			return;
		}
		
		try {
			if (this.process) {
				// Stop real process
				this.process.kill('SIGTERM');
				this.process = null;
			}
			
			this.isRunning = false;
			this.startTime = null;
			
			console.log('Wireshark stopped');
			this.emit('stopped');
			
		} catch (error) {
			throw new Error(`Failed to stop Wireshark: ${error instanceof Error ? (error as Error).message : String(error)}`);
		}
	}
	
	getStatus(): {
		running: boolean;
		interface: string;
		packets: number;
		rate: number;
		uptime: number;
	} {
		const uptime = this.startTime ? 
			Math.floor((Date.now() - this.startTime.getTime()) / 1000) : 0;
			
		return {
			running: this.isRunning,
			interface: this.interface,
			packets: this.packetCount,
			rate: this.packetsPerSecond,
			uptime
		};
	}
	
	private async checkTsharkAvailable(): Promise<void> {
		return new Promise((resolve, reject) => {
			// Try multiple packet capture tools
			const tools = ['tshark', 'tcpdump', 'dumpcap'];
			let toolFound = false;
			let currentTool = '';
			
			console.log('Checking for packet capture tools...');
			
			const checkNext = (index: number) => {
				if (index >= tools.length) {
					reject(new Error('No packet capture tool found. Please install tshark, tcpdump, or dumpcap.'));
					return;
				}
				
				currentTool = tools[index];
				console.log(`Checking for ${currentTool}...`);
				const checkProcess = spawn('which', [currentTool]);
				
				// Add timeout to prevent hanging
				const timeout = setTimeout(() => {
					checkProcess.kill();
					console.log(`Check for ${currentTool} timed out`);
					checkNext(index + 1);
				}, 2000);
				
				checkProcess.on('close', (code) => {
					clearTimeout(timeout);
					if (code === 0) {
						console.log(`Found packet capture tool: ${currentTool}`);
						toolFound = true;
						resolve();
					} else {
						console.log(`${currentTool} not found`);
						checkNext(index + 1);
					}
				});
				
				checkProcess.on('error', (err) => {
					clearTimeout(timeout);
					console.log(`Error checking ${currentTool}:`, err.message);
					checkNext(index + 1);
				});
			};
			
			checkNext(0);
		});
	}
	
	private setupPacketStream(): void {
		if (!this.process) return;
		
		let buffer = '';
		let expectingArray = false;
		
		this.process.stdout?.on('data', (data) => {
			const dataStr = data.toString();
			buffer += dataStr;
			
			// Debug: Log raw data for troubleshooting (only if substantial)
			if (dataStr.length > 5) {
				console.log('📥 Wireshark raw data:', dataStr.substring(0, 200));
			}
			
			// Check if we've accumulated enough data to detect JSON array start
			if (buffer.includes('[')) {
				expectingArray = true;
				console.log('🔍 Detected JSON array start, buffer length:', buffer.length);
			}
			
			if (expectingArray) {
				// For continuous streaming, wait for complete JSON array structure
				const arrayMatch = buffer.match(/\[[\s\S]*?\]/);
				if (arrayMatch) {
					try {
						console.log('🔍 Parsing JSON array:', arrayMatch[0].substring(0, 200));
						const packets = JSON.parse(arrayMatch[0]);
						if (Array.isArray(packets)) {
							console.log(`📊 Processing ${packets.length} packets`);
							for (const packetData of packets) {
								const packet = this.parsePacket(packetData);
								if (packet) {
									this.packetCount++;
									this.lastPacketTime = new Date();
									this.updatePacketRate();
									this.emit('packet', packet);
									console.log('✅ Packet processed:', packet.src_ip, '->', packet.dst_ip);
								}
							}
						}
						// Remove processed array from buffer
						if (arrayMatch.index !== undefined) {
							buffer = buffer.substring(arrayMatch.index + arrayMatch[0].length);
						}
						expectingArray = false;
					} catch (error) {
						// JSON array not complete yet, keep accumulating
						if (buffer.includes(']')) {
							console.log('⚠️ Array parse error:', (error instanceof Error ? (error as Error).message : String(error)).substring(0, 50));
							console.log('🔤 Buffer content:', buffer.substring(0, 200));
							buffer = ''; // Reset on error
							expectingArray = false;
						}
					}
				}
			} else {
				// Handle streaming individual JSON objects (line by line)
				const lines = buffer.split('\n');
				buffer = lines.pop() || ''; // Keep incomplete line in buffer
				
				for (const line of lines) {
					const trimmed = line.trim();
					if (!trimmed) continue;
					
					// Skip array markers and empty lines
					if (trimmed === '[' || trimmed === ']') continue;
					
					// Handle individual JSON objects
					if (trimmed.startsWith('{') && trimmed.includes('"_source"')) {
						try {
							// Clean up JSON object - remove trailing comma
							let cleanJson = trimmed;
							if (cleanJson.endsWith(',')) {
								cleanJson = cleanJson.slice(0, -1);
							}
							
							console.log('🔍 Parsing individual JSON object:', cleanJson.substring(0, 100));
							const packetData = JSON.parse(cleanJson);
							const packet = this.parsePacket(packetData);
							if (packet) {
								this.packetCount++;
								this.lastPacketTime = new Date();
								this.updatePacketRate();
								this.emit('packet', packet);
								console.log('✅ Individual packet processed:', packet.src_ip, '->', packet.dst_ip);
							}
						} catch (error) {
							// Skip logging minor JSON errors - focus on successful packets
							if (trimmed.length > 100 && !(error instanceof Error && (error as Error).message.includes('Unexpected end of JSON input'))) {
								console.log('⚠️ JSON parse error:', (error instanceof Error ? (error as Error).message : String(error)).substring(0, 50));
							}
						}
					}
				}
			}
		});
		
		this.process.stderr?.on('data', (data) => {
			console.error('Wireshark stderr:', data.toString());
		});
	}
	
	private setupProcessHandlers(): void {
		if (!this.process) return;
		
		this.process.on('close', (code) => {
			console.log(`Wireshark process exited with code ${code}`);
			
			// If this was an intentional stop, don't restart
			if (!this.isRunning) {
				this.process = null;
				this.emit('stopped');
				return;
			}
			
			// If we're still supposed to be running, restart the process
			// This handles the case where tshark exits after capturing the batch
			console.log('🔄 Restarting tshark for continuous capture...');
			this.process = null;
			
			// Brief delay before restart
			setTimeout(() => {
				if (this.isRunning) {
					this.restartCapture();
				}
			}, 100);
		});
		
		this.process.on('error', (error) => {
			console.error('Wireshark process error:', error);
			this.isRunning = false;
			this.emit('error', error);
		});
	}
	
	private parsePacket(data: any): NetworkPacket | null {
		try {
			// Extract packet fields from tshark JSON output
			// tshark outputs Elasticsearch-style JSON with _source.layers structure
			const layers = data._source?.layers;
			if (!layers) {
				console.log('❌ No layers found in packet data:', JSON.stringify(data).substring(0, 100));
				return null;
			}
			
			const frameTime = layers['frame.time']?.[0];
			const srcIp = layers['ip.src']?.[0] || 'unknown';
			const dstIp = layers['ip.dst']?.[0] || 'unknown';
			const protocols = layers['frame.protocols']?.[0] || 'unknown';
			const frameLen = parseInt(layers['frame.len']?.[0]) || 0;
			const frameInfo = layers['frame.info']?.[0] || '';
			
			// Validate required fields
			if (srcIp === 'unknown' || dstIp === 'unknown') {
				console.log('❌ Missing IP addresses in packet');
				return null;
			}
			
			// Extract primary protocol
			const protocolList = protocols.split(':');
			const protocol = protocolList[protocolList.length - 1]?.toUpperCase() || 'UNKNOWN';
			
			const packet: NetworkPacket = {
				id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
				timestamp: frameTime ? new Date(frameTime) : new Date(),
				src_ip: srcIp,
				dst_ip: dstIp,
				protocol,
				length: frameLen,
				info: frameInfo
			};
			
			console.log('✅ Successfully parsed packet:', packet.src_ip, '->', packet.dst_ip, packet.protocol);
			return packet;
			
		} catch (error) {
			console.error('Error parsing packet:', error);
			return null;
		}
	}
	
	private updatePacketRate(): void {
		if (!this.startTime) return;
		
		const uptimeSeconds = (Date.now() - this.startTime.getTime()) / 1000;
		if (uptimeSeconds > 0) {
			this.packetsPerSecond = Math.round(this.packetCount / uptimeSeconds);
		}
		
		// Emit stats every 100 packets
		if (this.packetCount % 100 === 0) {
			this.emit('stats', {
				interface: this.interface,
				packets: this.packetCount,
				rate: this.packetsPerSecond,
				uptime: Math.floor(uptimeSeconds)
			});
		}
	}
	
	async listInterfaces(): Promise<string[]> {
		return new Promise((resolve, reject) => {
			const process = spawn('tshark', ['-D']);
			let output = '';
			
			process.stdout?.on('data', (data) => {
				output += data.toString();
			});
			
			process.on('close', (code) => {
				if (code === 0) {
					const interfaces = output
						.split('\n')
						.filter(line => line.trim())
						.map(line => {
							// Parse tshark interface list format: "1. eth0 (Ethernet)"
							const match = line.match(/^\d+\.\s+(\w+)/);
							return match ? match[1] : null;
						})
						.filter(Boolean) as string[];
					
					resolve(interfaces);
				} else {
					reject(new Error('Failed to list network interfaces'));
				}
			});
			
			process.on('error', (error) => {
				reject(error);
			});
		});
	}
	
	setInterface(interfaceName: string): void {
		if (this.isRunning) {
			throw new Error('Cannot change interface while Wireshark is running');
		}
		this.interface = interfaceName;
	}
	
	private async restartCapture(): Promise<void> {
		if (!this.isRunning) return;
		
		try {
			// Configure tshark arguments for JSON output with continuous capture
			const args = [
				'-i', this.interface,
				'-l',                    // Line buffered output
				'-T', 'json',           // JSON output format
				'-e', 'frame.time',     // Timestamp
				'-e', 'ip.src',         // Source IP
				'-e', 'ip.dst',         // Destination IP
				'-e', 'frame.protocols',// Protocol stack
				'-e', 'frame.len',      // Frame length
				'-f', 'ip',             // Only capture IP traffic
				'-c', '10'              // Capture 10 packets at a time for streaming
			];
			
			// Try without sudo (assuming we got here, capabilities should work)
			this.process = spawn('tshark', args);
			
			this.setupPacketStream();
			this.setupProcessHandlers();
			
		} catch (error) {
			console.error('Failed to restart capture:', error);
			this.isRunning = false;
			this.emit('error', error);
		}
	}
}

// Global instance
export const wiresharkController = new WiresharkController();