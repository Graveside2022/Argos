import { execSync } from 'node:child_process';

export function debugToolSearch() {
	console.log('=== Tool Search Debug ===');
	console.log('Current PATH:', process.env.PATH);
	console.log('Current User:', process.env.USER);
	console.log('Platform:', process.platform);
	
	// Common tool locations
	const searchPaths = [
		'/usr/bin',
		'/usr/local/bin',
		'/bin',
		'/sbin',
		'/usr/sbin',
		'/usr/local/sbin',
		'/opt/bin',
		'/opt/local/bin',
		'/snap/bin',
		'/home/dragon/bin',
		'/usr/share/dragonos',
		'/opt/dragonos'
	];
	
	const tools = ['tshark', 'kismet', 'gnuradio-companion', 'hackrf_info', 'rtl_433'];
	
	console.log('\nSearching for tools in common locations:');
	for (const path of searchPaths) {
		try {
			const exists = execSync(`test -d ${path} && echo "exists"`).toString().trim();
			if (exists) {
				console.log(`\nChecking ${path}:`);
				for (const tool of tools) {
					try {
						const found = execSync(`test -f ${path}/${tool} && echo "found"`).toString().trim();
						if (found) {
							console.log(`  ✓ ${tool} found at ${path}/${tool}`);
						}
					} catch (e) {
						// Not found, continue
					}
				}
			}
		} catch (e) {
			// Directory doesn't exist
		}
	}
	
	// Also try using 'which' with full PATH
	console.log('\n\nUsing which command:');
	for (const tool of tools) {
		try {
			const path = execSync(`which ${tool} 2>/dev/null`).toString().trim();
			if (path) {
				console.log(`  ✓ ${tool} found at ${path}`);
			} else {
				console.log(`  ✗ ${tool} not found`);
			}
		} catch (e) {
			console.log(`  ✗ ${tool} not found`);
		}
	}
	
	// Check for aliases
	console.log('\n\nChecking for shell aliases:');
	try {
		const aliases = execSync('alias 2>/dev/null || true').toString();
		console.log(aliases || 'No aliases found');
	} catch (e) {
		console.log('Could not check aliases');
	}
	
	// Check if tools might be in containers
	console.log('\n\nChecking for Docker containers:');
	try {
		const containers = execSync('docker ps --format "table {{.Names}}\t{{.Image}}" 2>/dev/null || echo "Docker not available"').toString();
		console.log(containers);
	} catch (e) {
		console.log('Docker not available or no permissions');
	}
	
	return {
		paths: searchPaths,
		tools: tools
	};
}