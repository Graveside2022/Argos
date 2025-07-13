import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { sweepManager } from '$lib/server/hackrf/sweepManager';

export const POST: RequestHandler = async ({ request }) => {
    try {
        const body = await request.json() as Record<string, unknown>;
        console.warn('[start-sweep] Request body:', JSON.stringify(body, null, 2));
        
        // Extract frequencies from request
        const frequencyRanges = (body.frequencies as unknown[]) || [];
        const cycleTime = (body.cycleTime as number) || 10; // Default 10 seconds
        
        if (!frequencyRanges || frequencyRanges.length === 0) {
            return json({ 
                status: 'error', 
                message: 'No frequencies provided' 
            }, { status: 400 });
        }
        
        // Convert frequency ranges to center frequencies
        const frequencies = frequencyRanges.map((range: unknown) => {
            // Handle multiple formats:
            // 1. Object with start/stop/step
            // 2. Object with start/end
            // 3. Plain number
            if (typeof range === 'object' && range !== null) {
                let centerFreq;
                const rangeObj = range as Record<string, unknown>;
                if (rangeObj.start !== undefined && rangeObj.stop !== undefined) {
                    centerFreq = ((rangeObj.start as number) + (rangeObj.stop as number)) / 2;
                } else if (rangeObj.start !== undefined && rangeObj.end !== undefined) {
                    centerFreq = ((rangeObj.start as number) + (rangeObj.end as number)) / 2;
                } else {
                    console.warn('Invalid frequency range format:', range);
                    return null;
                }
                return {
                    value: centerFreq,
                    unit: 'MHz'
                };
            } else if (typeof range === 'number') {
                return {
                    value: range,
                    unit: 'MHz'
                };
            } else {
                console.warn('Invalid frequency range format:', range);
                return null;
            }
        }).filter((freq): freq is { value: number; unit: string } => freq !== null); // Remove any null values
        
        if (frequencies.length === 0) {
            console.error('[start-sweep] No valid frequencies after parsing');
            return json({ 
                status: 'error', 
                message: 'No valid frequencies after parsing',
                rawFrequencies: frequencyRanges
            }, { status: 400 });
        }
        
        // Convert cycleTime from seconds to milliseconds
        const cycleTimeMs = cycleTime * 1000;
        
        // Start the sweep using sweepManager
        console.warn('[start-sweep] Attempting to start sweep with:', { frequencies, cycleTimeMs });
        
        try {
            const success = await sweepManager.startCycle(frequencies, cycleTimeMs);
            
            if (success) {
                console.warn('[start-sweep] Sweep started successfully');
                return json({
                    status: 'success',
                    message: 'Sweep started successfully',
                    frequencies: frequencies,
                    cycleTime: cycleTimeMs
                });
            } else {
                console.error('[start-sweep] startCycle returned false');
                const status = sweepManager.getStatus();
                console.error('[start-sweep] Current sweep manager status:', status);
                
                return json({
                    status: 'error',
                    message: 'Failed to start sweep - check server logs for details',
                    currentStatus: status
                }, { status: 500 });
            }
        } catch (cycleError: unknown) {
            console.error('[start-sweep] Error in startCycle:', cycleError);
            throw cycleError;
        }
        
    } catch (error: unknown) {
        console.error('Error in start-sweep endpoint:', error);
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