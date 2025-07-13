import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { spawn } from 'child_process';

export const GET: RequestHandler = async () => {
    return new Promise((resolve) => {
        try {
            console.warn('[test-sweep] Starting hackrf_sweep test...');
            
            const args = [
                '-f', '88:108',  // FM radio band
                '-g', '20',      // VGA gain
                '-l', '32',      // LNA gain
                '-w', '100000',  // Bin width
                '-1'             // One shot mode
            ];
            
            console.warn('[test-sweep] Command: hackrf_sweep', args.join(' '));
            
            const process = spawn('hackrf_sweep', args);
            
            let stdout = '';
            let stderr = '';
            let lineCount = 0;
            
            process.stdout.on('data', (data: Buffer) => {
                stdout += data.toString();
                lineCount++;
                console.warn('[test-sweep] stdout:', data.toString().trim());
                
                // Kill after a few lines to avoid hanging
                if (lineCount > 5) {
                    process.kill();
                }
            });
            
            process.stderr.on('data', (data: Buffer) => {
                stderr += data.toString();
                console.warn('[test-sweep] stderr:', data.toString().trim());
            });
            
            process.on('error', (error) => {
                console.error('[test-sweep] Process error:', error);
                resolve(json({
                    status: 'error',
                    message: 'Failed to spawn hackrf_sweep',
                    error: error.message
                }, { status: 500 }));
            });
            
            process.on('exit', (code, signal) => {
                console.warn('[test-sweep] Process exited with code:', code, 'signal:', signal);
                
                resolve(json({
                    status: 'success',
                    exitCode: code,
                    signal: signal,
                    stdout: stdout.split('\n').slice(0, 10), // First 10 lines
                    stderr: stderr,
                    hasData: stdout.length > 0
                }));
            });
            
            // Timeout after 5 seconds
            setTimeout(() => {
                if (process.killed === false) {
                    process.kill();
                    (resolve as (value: Response) => void)(json({
                        status: 'timeout',
                        message: 'Test timed out after 5 seconds',
                        stdout: stdout.split('\n').slice(0, 10),
                        stderr: stderr
                    }));
                }
            }, 5000);
            
        } catch (error: unknown) {
            console.error('[test-sweep] Error:', error);
            resolve(json({
                status: 'error',
                message: (error as { message?: string }).message || 'Unknown error',
                error: error
            }, { status: 500 }));
        }
    });
};