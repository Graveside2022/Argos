#!/usr/bin/env node

// Debug script to test HackRF data flow

import { spawn } from 'child_process';

console.log('Starting HackRF debug test...');

// Test 1: Check if hackrf_sweep produces output
console.log('\n=== Test 1: Raw hackrf_sweep output ===');
const hackrf = spawn('hackrf_sweep', ['-f', '2390:2410', '-g', '20', '-l', '32', '-w', '20000']);

let dataReceived = false;
let lineCount = 0;

hackrf.stdout.on('data', (data) => {
    dataReceived = true;
    const lines = data.toString().split('\n');
    lines.forEach(line => {
        if (line.trim()) {
            lineCount++;
            if (lineCount <= 5) {
                console.log(`Line ${lineCount}: ${line}`);
            }
        }
    });
});

hackrf.stderr.on('data', (data) => {
    console.error('STDERR:', data.toString());
});

hackrf.on('error', (error) => {
    console.error('Process error:', error);
});

hackrf.on('exit', (code, signal) => {
    console.log(`Process exited with code ${code}, signal ${signal}`);
});

// Give it 10 seconds then kill
setTimeout(() => {
    console.log(`\n=== Results ===`);
    console.log(`Data received: ${dataReceived}`);
    console.log(`Total lines: ${lineCount}`);
    hackrf.kill('SIGTERM');
    process.exit(0);
}, 10000);