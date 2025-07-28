import type { RequestHandler } from './$types';
import { sweepManager } from '$lib/server/hackrf/sweepManager';
import { UsrpSweepManager } from '$lib/server/usrp/sweepManager';

export const GET: RequestHandler = async ({ url }) => {
    const headers = {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
    };

    const deviceType = url.searchParams.get('device') || 'auto';
    
    const stream = new ReadableStream({
        async start(controller) {
            const encoder = new TextEncoder();
            
            // Send initial connection message
            controller.enqueue(encoder.encode(`event: connected\ndata: {"device": "${deviceType}"}\n\n`));
            
            let activeDevice: string = deviceType;
            let dataHandler: ((data: any) => void) | null = null;
            let errorHandler: ((error: any) => void) | null = null;
            let statusHandler: ((status: any) => void) | null = null;
            
            if (deviceType === 'auto') {
                // Auto-detect which device is active
                const usrpManager = UsrpSweepManager.getInstance();
                const usrpStatus = usrpManager.getStatus();
                const hackrfStatus = sweepManager.getStatus();
                
                if ((usrpStatus as any).isRunning) {
                    activeDevice = 'usrp';
                } else if (hackrfStatus.state === 'running' || hackrfStatus.state === 'sweeping') {
                    activeDevice = 'hackrf';
                }
            }
            
            if (activeDevice === 'usrp') {
                const usrpManager = UsrpSweepManager.getInstance();
                
                // USRP data handler
                dataHandler = (data: any) => {
                    try {
                        // Transform USRP data to frontend format
                        const transformedData = {
                            frequencies: data.frequency ? [data.frequency] : [],
                            power: data.power ? [data.power] : [],
                            power_levels: data.powerValues || [data.power],
                            start_freq: data.startFreq || data.frequency,
                            stop_freq: data.endFreq || data.frequency,
                            center_freq: data.frequency,
                            peak_freq: data.frequency,
                            peak_power: data.power,
                            timestamp: data.timestamp,
                            device: 'usrp'
                        };
                        
                        const message = `event: spectrumData\ndata: ${JSON.stringify(transformedData)}\n\n`;
                        controller.enqueue(encoder.encode(message));
                    } catch (error) {
                        console.error('Error processing USRP spectrum data:', error);
                    }
                };
                
                // Error handler
                errorHandler = (error: any) => {
                    const message = `event: error\ndata: ${JSON.stringify({ 
                        message: error.message || 'Unknown error',
                        device: 'usrp'
                    })}\n\n`;
                    controller.enqueue(encoder.encode(message));
                };
                
                // Status handler
                statusHandler = (status: any) => {
                    const message = `event: status\ndata: ${JSON.stringify({ 
                        ...status,
                        device: 'usrp'
                    })}\n\n`;
                    controller.enqueue(encoder.encode(message));
                };
                
                // Subscribe to USRP events
                usrpManager.on('spectrumData', dataHandler);
                usrpManager.on('error', errorHandler);
                usrpManager.on('status', statusHandler);
                
            } else {
                // HackRF data handler (default)
                dataHandler = (data: any) => {
                    try {
                        // Transform the data if needed
                        const transformedData = {
                            frequencies: data.powerValues ? 
                                data.powerValues.map((_: any, index: number) => {
                                    const freqStep = (data.endFreq! - data.startFreq!) / (data.powerValues!.length - 1);
                                    return data.startFreq! + (index * freqStep);
                                }) : [],
                            power: data.powerValues || [],
                            power_levels: data.powerValues || [],
                            start_freq: data.startFreq,
                            stop_freq: data.endFreq,
                            center_freq: data.frequency,
                            peak_freq: data.frequency,
                            peak_power: data.power,
                            timestamp: data.timestamp,
                            device: 'hackrf'
                        };
                        
                        const message = `event: spectrumData\ndata: ${JSON.stringify(transformedData)}\n\n`;
                        controller.enqueue(encoder.encode(message));
                    } catch (error) {
                        console.error('Error processing HackRF spectrum data:', error);
                    }
                };
                
                // Error handler
                errorHandler = (error: any) => {
                    const message = `event: error\ndata: ${JSON.stringify({ 
                        message: error.message || 'Unknown error',
                        device: 'hackrf'
                    })}\n\n`;
                    controller.enqueue(encoder.encode(message));
                };
                
                // Status handler
                statusHandler = (status: any) => {
                    const message = `event: status\ndata: ${JSON.stringify({ 
                        ...status,
                        device: 'hackrf'
                    })}\n\n`;
                    controller.enqueue(encoder.encode(message));
                };
                
                // Subscribe to HackRF events
                sweepManager.on('spectrumData', dataHandler);
                sweepManager.on('error', errorHandler);
                sweepManager.on('status', statusHandler);
            }
            
            // Send heartbeat every 30 seconds
            const heartbeatInterval = setInterval(() => {
                const heartbeat = `event: heartbeat\ndata: {"time": "${new Date().toISOString()}", "device": "${activeDevice}"}\n\n`;
                controller.enqueue(encoder.encode(heartbeat));
            }, 30000);
            
            // Cleanup on connection close
            return () => {
                clearInterval(heartbeatInterval);
                
                if (activeDevice === 'usrp') {
                    const usrpManager = UsrpSweepManager.getInstance();
                    if (dataHandler) usrpManager.off('spectrumData', dataHandler);
                    if (errorHandler) usrpManager.off('error', errorHandler);
                    if (statusHandler) usrpManager.off('status', statusHandler);
                } else {
                    if (dataHandler) sweepManager.off('spectrumData', dataHandler);
                    if (errorHandler) sweepManager.off('error', errorHandler);
                    if (statusHandler) sweepManager.off('status', statusHandler);
                }
            };
        }
    });

    return new Response(stream, { headers });
};

// Add CORS headers for OPTIONS
export function OPTIONS() {
    return new Response(null, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        }
    });
}