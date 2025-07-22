import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { sweepManager } from '$lib/server/hackrf/sweepManager';
import { UsrpSweepManager } from '$lib/server/usrp/sweepManager';

export const POST: RequestHandler = async ({ request }) => {
    try {
        const body = await request.json() as Record<string, unknown>;
        const deviceType = (body.deviceType as string) || 'hackrf';
        
        // Always use the HackRF sweep manager which handles both devices
        await sweepManager.stopSweep();
        
        return json({
            status: 'success',
            message: 'Sweep stopped successfully',
            device: deviceType || 'auto'
        });
        
    } catch (error: unknown) {
        console.error('Error in rf/stop-sweep endpoint:', error);
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