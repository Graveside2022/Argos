#!/usr/bin/env node

// Test script to debug AirSignal RF detection

import fetch from 'node-fetch';
import EventSource from 'eventsource';

const baseUrl = 'http://localhost:5173';

async function testAirSignalRF() {
    console.log('=== Testing AirSignal RF Detection ===\n');
    
    // 1. Check current RF status
    console.log('1. Checking RF status...');
    const statusResponse = await fetch(`${baseUrl}/api/rf/status?device=usrp`);
    const status = await statusResponse.json();
    console.log('Current status:', JSON.stringify(status.data, null, 2));
    
    // 2. Connect to data stream to monitor
    console.log('\n2. Connecting to data stream...');
    const eventSource = new EventSource(`${baseUrl}/api/hackrf/data-stream`);
    
    let dataReceived = false;
    
    eventSource.addEventListener('connected', (event) => {
        console.log('Connected to data stream:', event.data);
    });
    
    eventSource.addEventListener('sweep_data', (event) => {
        dataReceived = true;
        try {
            const data = JSON.parse(event.data);
            console.log('\nReceived sweep data:');
            console.log('- Start freq:', data.start_freq, 'MHz');
            console.log('- Stop freq:', data.stop_freq, 'MHz');
            console.log('- Power levels:', data.power_levels ? data.power_levels.length : 'none');
            console.log('- Power values:', data.powerValues ? data.powerValues.length : 'none');
            console.log('- Peak power:', data.peak_power);
            console.log('- Data structure:', Object.keys(data));
            
            // Check if data would pass the -100 dBm threshold
            if (data.power_levels && data.power_levels.length > 0) {
                const maxPower = Math.max(...data.power_levels);
                console.log('- Max power in power_levels:', maxPower, 'dBm');
                console.log('- Would pass -100 dBm threshold?', maxPower > -100);
            }
        } catch (e) {
            console.error('Error parsing sweep data:', e);
        }
    });
    
    eventSource.addEventListener('error', (event) => {
        if (event.data) {
            console.error('SSE error:', event.data);
        }
    });
    
    // 3. Start RF sweep with 2.4GHz filter settings
    console.log('\n3. Starting RF sweep with 2.4GHz filter...');
    const frequencies = [
        { start: 2400, stop: 2500, step: 5 }  // WiFi 2.4GHz range
    ];
    
    const sweepResponse = await fetch(`${baseUrl}/api/rf/start-sweep`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            deviceType: 'usrp',
            frequencies,
            cycleTime: 10,
            gain: 40,
            sampleRate: 20e6
        })
    });
    
    const sweepResult = await sweepResponse.json();
    console.log('Sweep start result:', JSON.stringify(sweepResult, null, 2));
    
    // 4. Wait for data and check what format it's in
    console.log('\n4. Waiting for spectrum data (10 seconds)...');
    
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    if (!dataReceived) {
        console.log('\nNo data received! Checking process status...');
        
        // Check if process is running
        const statusCheck = await fetch(`${baseUrl}/api/rf/status?device=usrp`);
        const statusData = await statusCheck.json();
        console.log('Final status:', JSON.stringify(statusData.data, null, 2));
    }
    
    // 5. Stop the sweep
    console.log('\n5. Stopping sweep...');
    const stopResponse = await fetch(`${baseUrl}/api/rf/stop-sweep`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },  
        body: JSON.stringify({ deviceType: 'usrp' })
    });
    
    console.log('Stop result:', await stopResponse.text());
    
    eventSource.close();
    
    console.log('\n=== Test Complete ===');
}

testAirSignalRF().catch(console.error);