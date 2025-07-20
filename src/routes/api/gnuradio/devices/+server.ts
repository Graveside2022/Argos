import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSpectrumAnalyzer } from '$lib/server/gnuradio';

export const GET: RequestHandler = async () => {
	try {
		// Get spectrum analyzer instance
		const analyzer = getSpectrumAnalyzer();
		
		// Get available devices
		const devices = analyzer.getDevices();
		
		// Get current status
		const status = analyzer.getStatus();
		
		return json({
			success: true,
			message: 'GNU Radio devices retrieved',
			data: {
				devices: devices,
				activeDevice: status.device,
				totalDevices: devices.length,
				availableDevices: devices.filter(d => d.available).length
			}
		});
		
	} catch (error) {
		console.error('GNU Radio devices error:', error);
		
		return json({
			success: false,
			error: error.message,
			message: 'Failed to get GNU Radio devices',
			data: {
				devices: [],
				activeDevice: null,
				totalDevices: 0,
				availableDevices: 0
			}
		}, {
			status: 500
		});
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		// Parse device selection from request body
		const body = await request.text();
		const { deviceId } = JSON.parse(body);
		
		// Get spectrum analyzer instance
		const analyzer = getSpectrumAnalyzer();
		
		// Note: Device selection would require restart, so we'll just return current status
		// In a full implementation, this would stop the analyzer, change device, and restart
		
		const status = analyzer.getStatus();
		
		return json({
			success: true,
			message: 'Device selection requires restart',
			data: {
				currentDevice: status.device,
				requestedDevice: deviceId,
				note: 'Stop analyzer, change device, and restart to apply changes'
			}
		});
		
	} catch (error) {
		console.error('GNU Radio device selection error:', error);
		
		return json({
			success: false,
			error: error.message,
			message: 'Failed to select GNU Radio device'
		}, {
			status: 500
		});
	}
};