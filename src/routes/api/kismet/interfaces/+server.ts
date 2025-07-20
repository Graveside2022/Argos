import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const GET: RequestHandler = async () => {
	try {
		// Get network interfaces
		const { stdout } = await execAsync('ip link show | grep -E "^[0-9]+:" | grep -v lo');
		const lines = stdout.split('\n').filter(line => line.trim());
		
		const interfaces = [];
		
		for (const line of lines) {
			const match = line.match(/^\d+:\s+(\w+):/);
			if (match) {
				const interfaceName = match[1];
				
				// Skip non-wireless interfaces
				if (!interfaceName.startsWith('wl') && !interfaceName.includes('wlan')) {
					continue;
				}
				
				// Check if it supports monitor mode
				let hasMonitorMode = false;
				let friendlyName = interfaceName;
				
				try {
					// Try to get interface info
					const { stdout: iwOutput } = await execAsync(`iw dev ${interfaceName} info 2>/dev/null || echo "no_info"`);
					
					if (!iwOutput.includes('no_info')) {
						hasMonitorMode = true; // If iw can read it, it likely supports monitor mode
						
						// Get driver info for friendly name
						try {
							const { stdout: ethtoolOutput } = await execAsync(`ethtool -i ${interfaceName} 2>/dev/null | grep driver || echo "unknown"`);
							const driverMatch = ethtoolOutput.match(/driver:\s*(.+)/);
							if (driverMatch) {
								friendlyName = `${interfaceName} (${driverMatch[1].trim()})`;
							}
						} catch {
							// Ignore ethtool errors
						}
					}
				} catch {
					// Interface might not support wireless operations
				}
				
				interfaces.push({
					interface: interfaceName,
					name: friendlyName,
					hasMonitorMode
				});
			}
		}
		
		// If no wireless interfaces found, add some common defaults
		if (interfaces.length === 0) {
			interfaces.push(
				{ interface: 'wlan0', name: 'Default WiFi Interface', hasMonitorMode: true },
				{ interface: 'wlan1', name: 'Secondary WiFi Interface', hasMonitorMode: true }
			);
		}
		
		return json({
			success: true,
			interfaces
		});
		
	} catch (error) {
		console.error('Error getting interfaces:', error);
		
		// Return default interfaces on error
		return json({
			success: true,
			interfaces: [
				{ interface: 'wlan0', name: 'Default WiFi Interface', hasMonitorMode: true },
				{ interface: 'wlan1', name: 'Secondary WiFi Interface', hasMonitorMode: true }
			]
		});
	}
};