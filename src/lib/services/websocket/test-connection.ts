/**
 * Test WebSocket connections
 * Run this in the browser console or as a Svelte component
 */

import { getHackRFWebSocketClient, getKismetWebSocketClient } from './index';
import { WebSocketEvent as WebSocketEventEnum } from '$lib/types/enums';
// import { get } from 'svelte/store';
// import { hackrfConnection, kismetConnection } from '$lib/stores/connection';

export async function testWebSocketConnections() {
    // console.info('Starting WebSocket connection tests...');
    
    // Test HackRF WebSocket
    // console.info('\n--- Testing HackRF WebSocket ---');
    const hackrfClient = getHackRFWebSocketClient({
        url: 'ws://localhost:5173/ws/hackrf',
        reconnectInterval: 2000,
        maxReconnectAttempts: 3
    });
    
    // Set up HackRF event listeners
    hackrfClient.on(WebSocketEventEnum.Open, () => {
        // console.info('✓ HackRF WebSocket connected');
        // console.info('Connection status:', get(hackrfConnection));
    });
    
    hackrfClient.on(WebSocketEventEnum.Error, (event) => {
        console.error('✗ HackRF WebSocket error:', event.error);
    });
    
    hackrfClient.on(WebSocketEventEnum.Close, (_event) => {
        // console.info('HackRF WebSocket closed:', event.data);
    });
    
    hackrfClient.on(WebSocketEventEnum.Message, (_event) => {
        // console.info('HackRF message received:', event.data?.type);
    });
    
    // Connect HackRF
    hackrfClient.connect();
    
    // Test Kismet WebSocket
    // console.info('\n--- Testing Kismet WebSocket ---');
    const kismetClient = getKismetWebSocketClient({
        url: 'ws://localhost:5173/ws/kismet',
        reconnectInterval: 2000,
        maxReconnectAttempts: 3
    });
    
    // Set up Kismet event listeners
    kismetClient.on(WebSocketEventEnum.Open, () => {
        // console.info('✓ Kismet WebSocket connected');
        // console.info('Connection status:', get(kismetConnection));
        
        // Test API methods
        // console.info('Requesting Kismet status...');
        kismetClient.requestStatus();
        
        // console.info('Requesting device list...');
        kismetClient.requestDevicesList();
    });
    
    kismetClient.on(WebSocketEventEnum.Error, (event) => {
        console.error('✗ Kismet WebSocket error:', event.error);
    });
    
    kismetClient.on(WebSocketEventEnum.Close, (_event) => {
        // console.info('Kismet WebSocket closed:', event.data);
    });
    
    kismetClient.on(WebSocketEventEnum.Message, (_event) => {
        // console.info('Kismet message received:', event.data?.type);
    });
    
    // Connect Kismet
    kismetClient.connect();
    
    // Wait and check status
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // console.info('\n--- Connection Status Summary ---');
    // console.info('HackRF:', get(hackrfConnection));
    // console.info('Kismet:', get(kismetConnection));
    
    // Test sending messages if connected
    if (hackrfClient.isConnected()) {
        // console.info('\nTesting HackRF commands...');
        hackrfClient.requestStatus();
        hackrfClient.requestSweepStatus();
    }
    
    if (kismetClient.isConnected()) {
        // console.info('\nTesting Kismet commands...');
        // kismetClient.refresh('all'); // Method doesn't exist
    }
    
    // Cleanup function
    return () => {
        // console.info('\nCleaning up connections...');
        hackrfClient.disconnect();
        kismetClient.disconnect();
    };
}

// Export for use in browser console
if (typeof window !== 'undefined') {
    const win = window as Window & { testWebSocketConnections?: typeof testWebSocketConnections };
    win.testWebSocketConnections = testWebSocketConnections;
}