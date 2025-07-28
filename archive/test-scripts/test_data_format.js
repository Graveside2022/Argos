#!/usr/bin/env node

// Quick test to see data format mismatch

import EventSource from 'eventsource';
import fetch from 'node-fetch';

async function testDataFormat() {
    console.log('Starting sweep and monitoring data format...\n');
    
    // Connect to SSE first
    const eventSource = new EventSource('http://localhost:5173/api/hackrf/data-stream');
    
    let dataCount = 0;
    
    eventSource.addEventListener('sweep_data', (event) => {
        dataCount++;
        try {
            const data = JSON.parse(event.data);
            console.log(`\n=== Data Sample ${dataCount} ===`);
            console.log('Keys in data:', Object.keys(data));
            console.log('Has power_levels?', 'power_levels' in data);
            console.log('Has powerValues?', 'powerValues' in data);
            console.log('power_levels type:', Array.isArray(data.power_levels) ? 'array' : typeof data.power_levels);
            console.log('power_levels length:', data.power_levels?.length);
            
            if (dataCount >= 3) {
                eventSource.close();
                process.exit(0);
            }
        } catch (e) {
            console.error('Parse error:', e);
        }
    });
    
    // Start sweep
    await fetch('http://localhost:5173/api/rf/start-sweep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            deviceType: 'usrp',
            frequencies: [{ start: 2400, stop: 2500, step: 5 }],
            cycleTime: 10
        })
    });
}

testDataFormat().catch(console.error);