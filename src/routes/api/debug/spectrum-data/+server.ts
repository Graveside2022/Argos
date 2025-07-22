import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { sweepManager } from '$lib/server/hackrf/sweepManager';

export const GET: RequestHandler = async () => {
    const status = sweepManager.getStatus();
    const processInfo = sweepManager.getProcessInfo();
    
    // Get last spectrum data if available
    let lastSpectrumData = null;
    try {
        // Access internal state if possible
        const manager = sweepManager as any;
        if (manager.lastSpectrumData) {
            lastSpectrumData = manager.lastSpectrumData;
        }
    } catch (e) {
        // Ignore
    }
    
    return json({
        status: status,
        processInfo: processInfo,
        lastSpectrumData: lastSpectrumData,
        timestamp: new Date().toISOString()
    });
};