import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const POST: RequestHandler = async () => {
    try {
        // Kill any existing hackrf_sweep processes
        try {
            await execAsync('pkill -f hackrf_sweep');
            console.warn('Killed existing hackrf_sweep processes');
        } catch {
            // Process might not exist, that's okay
        }
        
        // Also try with sudo if available
        try {
            await execAsync('sudo pkill -f hackrf_sweep');
        } catch {
            // Sudo might not be available or process doesn't exist
        }
        
        // Give it a moment to clean up
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        return json({
            status: 'success',
            message: 'HackRF processes cleaned up'
        });
    } catch (error: unknown) {
        console.error('Error cleaning up HackRF:', error);
        return json({
            status: 'error',
            message: error instanceof Error ? error.message : 'Failed to cleanup'
        }, { status: 500 });
    }
};