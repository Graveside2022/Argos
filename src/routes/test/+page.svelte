<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { getHackRFWebSocketClient, getKismetWebSocketClient } from '$lib/services/websocket';
    import { hackrfAPI } from '$lib/services/api/hackrf';
    import { kismetAPI } from '$lib/services/api/kismet';
    import { WebSocketEvent as WebSocketEventEnum } from '$lib/types/enums';
    import type { HackRFWebSocketClient } from '$lib/services/websocket/hackrf';
    import type { KismetWebSocketClient } from '$lib/services/websocket/kismet';
    
    let hackrfWS: HackRFWebSocketClient | null = null;
    let kismetWS: KismetWebSocketClient | null = null;
    
    // Test states
    let hackrfWSConnected = false;
    let kismetWSConnected = false;
    let hackrfAPIStatus = 'Not tested';
    let kismetAPIStatus = 'Not tested';
    
    // Test results
    let testResults: Array<{
        test: string;
        result: 'pending' | 'success' | 'failed';
        message: string;
        timestamp: Date;
    }> = [];
    
    function addTestResult(test: string, result: 'success' | 'failed', message: string) {
        testResults = [...testResults, {
            test,
            result,
            message,
            timestamp: new Date()
        }];
    }
    
    // Test HackRF API
    async function testHackRFAPI() {
        hackrfAPIStatus = 'Testing...';
        try {
            const status = await hackrfAPI.getStatus();
            hackrfAPIStatus = `Connected: ${status.connected}, Sweeping: ${status.sweeping}`;
            addTestResult('HackRF API Status', 'success', JSON.stringify(status));
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            hackrfAPIStatus = `Failed: ${errorMessage}`;
            addTestResult('HackRF API Status', 'failed', errorMessage);
        }
    }
    
    // Test Kismet API
    async function testKismetAPI() {
        kismetAPIStatus = 'Testing...';
        try {
            const status = await kismetAPI.getStatus();
            kismetAPIStatus = `Running: ${status.running}, PID: ${status.pid || 'N/A'}`;
            addTestResult('Kismet API Status', 'success', JSON.stringify(status));
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            kismetAPIStatus = `Failed: ${errorMessage}`;
            addTestResult('Kismet API Status', 'failed', errorMessage);
        }
    }
    
    // Test WebSocket connections
    function testWebSockets() {
        // Test HackRF WebSocket
        hackrfWS = getHackRFWebSocketClient({
            url: 'ws://localhost:5173/ws/hackrf',
            reconnectInterval: 2000,
            maxReconnectAttempts: 3
        });
        
        hackrfWS.on(WebSocketEventEnum.Open, () => {
            hackrfWSConnected = true;
            addTestResult('HackRF WebSocket', 'success', 'Connected successfully');
            
            // Test sending commands
            if (hackrfWS) {
                hackrfWS.requestStatus();
                hackrfWS.requestSweepStatus();
            }
        });
        
        hackrfWS.on(WebSocketEventEnum.Error, (event) => {
            hackrfWSConnected = false;
            addTestResult('HackRF WebSocket', 'failed', event.error?.message || 'Connection error');
        });
        
        hackrfWS.on(WebSocketEventEnum.Message, (event) => {
            const messageType = event.data && typeof event.data === 'object' && 'type' in event.data ? 
                (event.data as { type: string }).type : 'unknown';
            addTestResult('HackRF WS Message', 'success', `Type: ${messageType}`);
        });
        
        hackrfWS.connect();
        
        // Test Kismet WebSocket
        kismetWS = getKismetWebSocketClient({
            url: 'ws://localhost:5173/ws/kismet',
            reconnectInterval: 2000,
            maxReconnectAttempts: 3
        });
        
        kismetWS.on(WebSocketEventEnum.Open, () => {
            kismetWSConnected = true;
            addTestResult('Kismet WebSocket', 'success', 'Connected successfully');
            
            // Test sending commands
            if (kismetWS) {
                kismetWS.requestStatus();
                kismetWS.requestDevicesList();
            }
        });
        
        kismetWS.on(WebSocketEventEnum.Error, (event) => {
            kismetWSConnected = false;
            addTestResult('Kismet WebSocket', 'failed', event.error?.message || 'Connection error');
        });
        
        kismetWS.on(WebSocketEventEnum.Message, (event) => {
            const messageType = event.data && typeof event.data === 'object' && 'type' in event.data ? 
                (event.data as { type: string }).type : 'unknown';
            addTestResult('Kismet WS Message', 'success', `Type: ${messageType}`);
        });
        
        kismetWS.connect();
    }
    
    // Run all tests
    async function runAllTests() {
        testResults = [];
        
        // Test APIs
        await testHackRFAPI();
        await testKismetAPI();
        
        // Test WebSockets
        testWebSockets();
    }
    
    onMount(() => {
        // Auto-run tests on mount
        void runAllTests();
    });
    
    onDestroy(() => {
        // Cleanup WebSocket connections
        if (hackrfWS) {
            hackrfWS.destroy();
        }
        if (kismetWS) {
            kismetWS.destroy();
        }
    });
</script>

<div class="min-h-screen bg-zinc-900 text-white p-8">
    <div class="max-w-6xl mx-auto">
        <h1 class="text-3xl font-bold mb-8">API & WebSocket Connection Tests</h1>
        
        <div class="grid md:grid-cols-2 gap-8 mb-8">
            <!-- API Status -->
            <div class="bg-zinc-800 rounded-lg p-6">
                <h2 class="text-xl font-semibold mb-4">API Connections</h2>
                
                <div class="space-y-4">
                    <div>
                        <div class="flex justify-between items-center mb-2">
                            <span class="font-medium">HackRF API</span>
                            <button
                                on:click={testHackRFAPI}
                                class="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm"
                            >
                                Test
                            </button>
                        </div>
                        <p class="text-sm text-zinc-400">{hackrfAPIStatus}</p>
                    </div>
                    
                    <div>
                        <div class="flex justify-between items-center mb-2">
                            <span class="font-medium">Kismet API</span>
                            <button
                                on:click={testKismetAPI}
                                class="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm"
                            >
                                Test
                            </button>
                        </div>
                        <p class="text-sm text-zinc-400">{kismetAPIStatus}</p>
                    </div>
                </div>
            </div>
            
            <!-- WebSocket Status -->
            <div class="bg-zinc-800 rounded-lg p-6">
                <h2 class="text-xl font-semibold mb-4">WebSocket Connections</h2>
                
                <div class="space-y-4">
                    <div>
                        <div class="flex justify-between items-center">
                            <span class="font-medium">HackRF WebSocket</span>
                            <span class="inline-flex items-center">
                                <span class={`w-2 h-2 rounded-full mr-2 ${
                                    hackrfWSConnected ? 'bg-green-500' : 'bg-red-500'
                                }`}></span>
                                {hackrfWSConnected ? 'Connected' : 'Disconnected'}
                            </span>
                        </div>
                    </div>
                    
                    <div>
                        <div class="flex justify-between items-center">
                            <span class="font-medium">Kismet WebSocket</span>
                            <span class="inline-flex items-center">
                                <span class={`w-2 h-2 rounded-full mr-2 ${
                                    kismetWSConnected ? 'bg-green-500' : 'bg-red-500'
                                }`}></span>
                                {kismetWSConnected ? 'Connected' : 'Disconnected'}
                            </span>
                        </div>
                    </div>
                </div>
                
                <button
                    on:click={testWebSockets}
                    class="mt-4 w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded"
                >
                    Reconnect WebSockets
                </button>
            </div>
        </div>
        
        <!-- Test Results -->
        <div class="bg-zinc-800 rounded-lg p-6">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-xl font-semibold">Test Results</h2>
                <button
                    on:click={runAllTests}
                    class="px-4 py-2 bg-green-600 hover:bg-green-700 rounded"
                >
                    Run All Tests
                </button>
            </div>
            
            <div class="overflow-x-auto">
                <table class="w-full">
                    <thead>
                        <tr class="text-left border-b border-zinc-700">
                            <th class="pb-2">Test</th>
                            <th class="pb-2">Result</th>
                            <th class="pb-2">Message</th>
                            <th class="pb-2">Time</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-zinc-700">
                        {#each testResults as result}
                            <tr>
                                <td class="py-2">{result.test}</td>
                                <td class="py-2">
                                    <span class={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                                        result.result === 'success' 
                                            ? 'bg-green-900 text-green-300' 
                                            : 'bg-red-900 text-red-300'
                                    }`}>
                                        {result.result}
                                    </span>
                                </td>
                                <td class="py-2 text-sm text-zinc-400">{result.message}</td>
                                <td class="py-2 text-sm text-zinc-400">
                                    {result.timestamp.toLocaleTimeString()}
                                </td>
                            </tr>
                        {/each}
                        {#if testResults.length === 0}
                            <tr>
                                <td colspan="4" class="py-4 text-center text-zinc-500">
                                    No test results yet. Click "Run All Tests" to start.
                                </td>
                            </tr>
                        {/if}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</div>