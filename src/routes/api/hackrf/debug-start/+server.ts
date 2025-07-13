import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getSweepManager } from '$lib/server/hackrf/sweepManager';

export const POST: RequestHandler = async ({ request }) => {
    try {
        const body = await request.json() as Record<string, unknown>;
        console.warn('[debug-start] Request body:', body);
        
        const manager = getSweepManager();
        console.warn('[debug-start] Got sweep manager');
        
        // Try to get current status
        const status = manager.getStatus();
        console.warn('[debug-start] Current status:', status);
        
        // Simple frequency for testing
        const testFreq = [{ value: 100, unit: 'MHz' }];
        console.warn('[debug-start] Test frequency:', testFreq);
        
        // Try to start with minimal config
        console.warn('[debug-start] Calling startCycle...');
        
        try {
            const result = await manager.startCycle(testFreq, 5000);
            console.warn('[debug-start] startCycle result:', result);
            
            return json({
                status: 'success',
                startCycleResult: result,
                managerStatus: manager.getStatus()
            });
        } catch (cycleError: unknown) {
            console.error('[debug-start] startCycle error:', cycleError);
            console.error('[debug-start] Error stack:', (cycleError as { stack?: string }).stack);
            
            return json({
                status: 'error',
                message: 'startCycle failed',
                error: (cycleError as { message?: string }).message,
                stack: (cycleError as { stack?: string }).stack,
                managerStatus: manager.getStatus()
            }, { status: 500 });
        }
        
    } catch (error: unknown) {
        console.error('[debug-start] Outer error:', error);
        return json({
            status: 'error',
            message: 'Outer error',
            error: (error as { message?: string }).message,
            stack: (error as { stack?: string }).stack
        }, { status: 500 });
    }
};