import { json } from '@sveltejs/kit';
import { checkInstalledTools } from '$lib/server/toolChecker';
import { getNetworkInterfaces } from '$lib/server/networkInterfaces';
import { execSync } from 'node:child_process';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	try {
		// Get system info
		const systemInfo = {
			platform: process.platform,
			arch: process.arch,
			nodeVersion: process.version,
			hostname: execSync('hostname').toString().trim()
		};
		
		// Check for OS details
		let osDetails = 'Unknown';
		try {
			osDetails = execSync('cat /etc/os-release | grep PRETTY_NAME | cut -d= -f2 | tr -d \'"\'').toString().trim();
		} catch (e) {
			// Fallback
			try {
				osDetails = execSync('uname -a').toString().trim();
			} catch (e2) {
				osDetails = `${process.platform} ${process.arch}`;
			}
		}
		
		// Get installed tools status
		const toolStatus = checkInstalledTools();
		
		// Get network interfaces
		const networkInterfaces = getNetworkInterfaces();
		
		// Check for RF hardware
		const rfHardware = {
			hackrf: false,
			rtlsdr: false,
			usrp: false
		};
		
		try {
			// Check for HackRF
			const lsusb = execSync('lsusb 2>/dev/null || echo ""').toString();
			rfHardware.hackrf = lsusb.includes('1d50:6089') || lsusb.includes('Great Scott Gadgets');
			rfHardware.rtlsdr = lsusb.includes('0bda:2838') || lsusb.includes('Realtek Semiconductor');
			rfHardware.usrp = lsusb.includes('Ettus Research');
		} catch (e) {
			// USB check failed
		}
		
		// Check for DragonOS specific markers
		let isDragonOS = false;
		try {
			const dragonCheck = execSync('ls /usr/share/dragonos* /opt/dragonos* 2>/dev/null | head -1').toString();
			isDragonOS = dragonCheck.length > 0;
			
			// Also check for specific DragonOS files
			if (!isDragonOS) {
				const moreChecks = execSync('ls /usr/local/bin/dragon* /usr/bin/dragon* 2>/dev/null | head -1').toString();
				isDragonOS = moreChecks.length > 0;
			}
		} catch (e) {
			// Not DragonOS
		}
		
		return json({
			system: {
				...systemInfo,
				os: osDetails,
				isDragonOS
			},
			tools: toolStatus,
			network: {
				interfaces: networkInterfaces,
				suggestedInterface: networkInterfaces[0]?.name || 'eth0'
			},
			hardware: rfHardware,
			recommendations: getRecommendations(toolStatus, rfHardware, isDragonOS)
		});
		
	} catch (error) {
		return json({
			error: 'Failed to get system status',
			message: (error as Error).message
		}, { status: 500 });
	}
};

function getRecommendations(tools: any, hardware: any, isDragonOS: boolean): string[] {
	const recommendations: string[] = [];
	
	if (!tools.tshark?.installed) {
		recommendations.push('Install Wireshark or tshark for packet capture: sudo apt-get install tshark');
	}
	
	if (!tools.gnuradio?.installed && (hardware.hackrf || hardware.rtlsdr)) {
		recommendations.push('Install GNU Radio to use your SDR hardware: sudo apt-get install gnuradio');
	}
	
	if (!tools.kismet?.installed) {
		recommendations.push('Install Kismet for WiFi monitoring: sudo apt-get install kismet');
	}
	
	if (!isDragonOS && Object.values(tools).every((t: any) => !(t as any)?.installed)) {
		recommendations.push('Consider using DragonOS which comes with all RF tools pre-installed');
	}
	
	if (!hardware.hackrf && !hardware.rtlsdr && !hardware.usrp) {
		recommendations.push('No SDR hardware detected. Connect a HackRF, RTL-SDR, or USRP device for RF monitoring');
	}
	
	return recommendations;
}