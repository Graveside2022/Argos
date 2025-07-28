import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { sweepManager } from '$lib/server/hackrf/sweepManager';
import { spawn } from 'child_process';

export const GET: RequestHandler = async () => {
    const logs: string[] = [];
    
    // Check sweep manager status
    const status = sweepManager.getStatus();
    logs.push(`Sweep Manager Status: ${JSON.stringify(status)}`);
    
    // Test direct USRP process spawn
    logs.push('\n=== Testing Direct USRP Process ===');
    
    const testProcess = spawn('python3', [
        '-u',
        './scripts/usrp_spectrum_scan.py',
        '--start-freq', '2400000000',
        '--stop-freq', '2410000000',
        '--freq-step', '1000000',
        '--gain', '40',
        '--single-sweep'
    ], {
        stdio: ['ignore', 'pipe', 'pipe']
    });
    
    let dataReceived = false;
    let lineCount = 0;
    const outputLines: string[] = [];
    
    testProcess.stdout.on('data', (data) => {
        dataReceived = true;
        const lines = data.toString().split('\n').filter((line: string) => line.trim());
        lineCount += lines.length;
        lines.forEach((line: string) => {
            if (outputLines.length < 5) {
                outputLines.push(line.substring(0, 100) + '...');
            }
        });
    });
    
    testProcess.stderr.on('data', (data) => {
        logs.push(`STDERR: ${data.toString().trim()}`);
    });
    
    // Wait for process to complete
    await new Promise<void>((resolve) => {
        testProcess.on('exit', () => {
            logs.push(`\nProcess exited. Data received: ${dataReceived}, Lines: ${lineCount}`);
            logs.push('\nFirst 5 output lines:');
            outputLines.forEach(line => logs.push(line));
            resolve();
        });
        
        // Timeout after 5 seconds
        setTimeout(() => {
            testProcess.kill();
            resolve();
        }, 5000);
    });
    
    // Check if event handlers are set
    const processManager = (sweepManager as any).processManager;
    if (processManager) {
        logs.push(`\nProcessManager event handlers: ${JSON.stringify({
            hasOnStdout: !!(processManager.eventHandlers?.onStdout),
            hasOnStderr: !!(processManager.eventHandlers?.onStderr),
            hasOnExit: !!(processManager.eventHandlers?.onExit)
        })}`);
    }
    
    // Check SSE emitter
    logs.push(`\nSSE Emitter set: ${!!(sweepManager as any).sseEmitter}`);
    
    return json({
        logs: logs.join('\n'),
        timestamp: new Date().toISOString()
    });
};