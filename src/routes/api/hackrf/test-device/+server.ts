import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const GET: RequestHandler = async () => {
    try {
        // Test hackrf_info
        console.warn('[test-device] Running hackrf_info...');
        const { stdout, stderr } = await execAsync('timeout 5 hackrf_info');
        
        console.warn('[test-device] stdout:', stdout);
        console.warn('[test-device] stderr:', stderr);
        
        const hasDevice = stdout.includes('Serial number');
        const serialMatch = stdout.match(/Serial number:\s*(\S+)/);
        const boardMatch = stdout.match(/Board ID Number:\s*([^\n]+)/);
        
        return json({
            status: 'success',
            deviceFound: hasDevice,
            serialNumber: serialMatch ? serialMatch[1] : null,
            boardId: boardMatch ? boardMatch[1] : null,
            rawOutput: stdout,
            errors: stderr || null
        });
    } catch (error: unknown) {
        console.error('[test-device] Error:', error);
        
        // Check if it's a timeout
        if ((error as { code?: number }).code === 124) {
            return json({
                status: 'error',
                message: 'Device check timed out',
                error: 'timeout'
            }, { status: 500 });
        }
        
        return json({
            status: 'error',
            message: (error as { message?: string }).message || 'Failed to test device',
            error: (error as { code?: number }).code || 'unknown',
            stderr: (error as { stderr?: string }).stderr || null
        }, { status: 500 });
    }
};