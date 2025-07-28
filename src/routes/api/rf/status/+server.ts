import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { sweepManager } from '$lib/server/hackrf/sweepManager';
import { UsrpSweepManager } from '$lib/server/usrp/sweepManager';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function detectConnectedDevices(): Promise<{
    hackrf: boolean;
    usrp: boolean;
    deviceInfo: Record<string, any>;
}> {
    const deviceInfo: Record<string, any> = {};
    let hackrfConnected = false;
    let usrpConnected = false;

    // Check for HackRF
    try {
        const { stdout } = await execAsync('timeout 2 hackrf_info');
        if (stdout.includes('Serial number')) {
            hackrfConnected = true;
            const serialMatch = stdout.match(/Serial number:\s*(\S+)/);
            deviceInfo.hackrf = {
                connected: true,
                serial: serialMatch ? serialMatch[1] : 'unknown',
                info: stdout.trim()
            };
        }
    } catch (error) {
        deviceInfo.hackrf = { connected: false, error: 'Not detected' };
    }

    // Check for USRP - also check USB device
    try {
        // First try uhd_find_devices
        const { stdout } = await execAsync('UHD_IMAGES_DIR=/usr/share/uhd/images timeout 3 uhd_find_devices');
        if (stdout.includes('Device Address') || stdout.includes('B205')) {
            usrpConnected = true;
            deviceInfo.usrp = {
                connected: true,
                info: stdout.trim()
            };
        }
    } catch (error) {
        // If uhd_find_devices fails, check if USB device is present
        try {
            const { stdout: usbOut } = await execAsync('lsusb | grep -i "2500:0022\\|ettus\\|b205"');
            if (usbOut.includes('Ettus') || usbOut.includes('B205') || usbOut.includes('2500:0022')) {
                // USB device is present but UHD can't detect it - assume it's connected
                usrpConnected = true;
                deviceInfo.usrp = {
                    connected: true,
                    info: 'USRP B205 mini detected via USB (UHD detection failed)',
                    usbInfo: usbOut.trim()
                };
            } else {
                deviceInfo.usrp = { connected: false, error: 'Not detected' };
            }
        } catch (usbError) {
            deviceInfo.usrp = { connected: false, error: 'Not detected' };
        }
    }

    return { hackrf: hackrfConnected, usrp: usrpConnected, deviceInfo };
}

export const GET: RequestHandler = async ({ url }) => {
    try {
        const deviceType = url.searchParams.get('device') || 'auto';
        
        // Detect connected devices
        const { hackrf, usrp, deviceInfo } = await detectConnectedDevices();
        
        // Determine which device to check status for
        let activeDevice = deviceType;
        if (deviceType === 'auto') {
            if (usrp) {
                activeDevice = 'usrp';
            } else if (hackrf) {
                activeDevice = 'hackrf';
            } else {
                activeDevice = 'none';
            }
        }
        
        let status: any = {
            connectedDevices: {
                hackrf,
                usrp
            },
            deviceInfo,
            activeDevice
        };
        
        if (activeDevice === 'usrp') {
            const usrpManager = UsrpSweepManager.getInstance();
            const usrpStatus = usrpManager.getStatus();
            status = {
                ...status,
                device: 'usrp',
                ...usrpStatus,
                bufferStats: usrpManager.getBufferStats(),
                bufferHealth: usrpManager.getBufferHealth()
            };
        } else if (activeDevice === 'hackrf') {
            const hackrfStatus = sweepManager.getStatus();
            status = {
                ...status,
                device: 'hackrf',
                ...hackrfStatus,
                bufferStats: null, // sweepManager.getBufferStats() - method doesn't exist
                bufferHealth: null // sweepManager.getBufferHealth() - method doesn't exist
            };
        } else {
            status = {
                ...status,
                device: 'none',
                isRunning: false,
                state: 'No device connected'
            };
        }
        
        return json({
            status: 'success',
            data: status
        });
        
    } catch (error: unknown) {
        console.error('Error in rf/status endpoint:', error);
        return json({
            status: 'error',
            message: error instanceof Error ? error.message : 'Internal server error'
        }, { status: 500 });
    }
};

// Add CORS headers
export function OPTIONS() {
    return new Response(null, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        }
    });
}