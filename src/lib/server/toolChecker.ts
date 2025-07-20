import { execSync } from 'node:child_process';

interface ToolStatus {
	name: string;
	installed: boolean;
	path?: string;
	version?: string;
	error?: string;
}

export function checkInstalledTools(): Record<string, ToolStatus> {
	const tools = {
		tshark: {
			name: 'Wireshark (tshark)',
			commands: ['tshark', 'dumpcap', 'tcpdump'],
			installed: false
		},
		gnuradio: {
			name: 'GNU Radio',
			commands: ['gnuradio-companion', 'gnuradio-config-info'],
			installed: false
		},
		kismet: {
			name: 'Kismet',
			commands: ['kismet', 'kismet_server'],
			installed: false
		},
		hackrf: {
			name: 'HackRF',
			commands: ['hackrf_info', 'hackrf_sweep'],
			installed: false
		},
		rtl433: {
			name: 'RTL-433',
			commands: ['rtl_433'],
			installed: false
		}
	};
	
	const results: Record<string, ToolStatus> = {};
	
	for (const [key, tool] of Object.entries(tools)) {
		results[key] = {
			name: tool.name,
			installed: false
		};
		
		// Try each command variant
		for (const cmd of tool.commands) {
			try {
				const path = execSync(`which ${cmd} 2>/dev/null`).toString().trim();
				if (path) {
					results[key].installed = true;
					results[key].path = path;
					
					// Try to get version
					try {
						if (cmd === 'tshark') {
							results[key].version = execSync(`${cmd} -v 2>&1 | head -1`).toString().trim();
						} else if (cmd === 'kismet') {
							results[key].version = execSync(`${cmd} --version 2>&1 | head -1`).toString().trim();
						}
					} catch (e) {
						// Version check failed, that's ok
					}
					
					break; // Found one variant, stop checking
				}
			} catch (e) {
				// Command not found, try next
			}
		}
		
		if (!results[key].installed) {
			results[key].error = `${tool.name} not found. Please install it to use this feature.`;
		}
	}
	
	return results;
}

export function getAvailableTools(): string[] {
	const status = checkInstalledTools();
	return Object.entries(status)
		.filter(([_, tool]) => tool.installed)
		.map(([key, _]) => key);
}

export function getMissingToolsMessage(): string {
	const status = checkInstalledTools();
	const missing = Object.entries(status)
		.filter(([_, tool]) => !tool.installed)
		.map(([_, tool]) => tool.name);
	
	if (missing.length === 0) {
		return 'All RF monitoring tools are installed!';
	}
	
	return `Missing tools: ${missing.join(', ')}. The Fusion center will work with limited functionality.`;
}