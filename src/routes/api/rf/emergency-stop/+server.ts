import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { sweepManager } from '$lib/server/hackrf/sweep-manager';
import { UsrpSweepManager } from '$lib/server/usrp/sweep-manager';

export const POST: RequestHandler = async ({ request }) => {
    try {
        const body = await request.json() as Record<string, unknown>;
        const deviceType = (body.deviceType as string) || 'hackrf';
        
        if (deviceType === 'usrp') {
            // Emergency stop USRP
            const usrpManager = UsrpSweepManager.getInstance();
            await usrpManager.emergencyStop();
            
            return json({
                status: 'success',
                message: 'USRP emergency stop executed',
                device: 'usrp',
                stopped: true
            });
        } else {
            // Emergency stop HackRF
            await sweepManager.emergencyStop();
            
            return json({
                status: 'success',
                message: 'HackRF emergency stop executed',
                device: 'hackrf',
                stopped: true
            });
        }
        
    } catch (error: unknown) {
        console.error('Error in rf/emergency-stop endpoint:', error);
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
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        }
    });
}