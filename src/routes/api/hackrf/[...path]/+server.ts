import type { RequestHandler } from './$types';

// Proxy all HackRF API requests to the external service
const HACKRF_SERVICE_URL = 'http://localhost:3002';

export const GET: RequestHandler = async ({ params, url, request }) => {
    const path = params.path || '';
    const queryString = url.search;
    const targetUrl = `${HACKRF_SERVICE_URL}/${path}${queryString}`;
    
    try {
        // Handle SSE endpoints specially
        if (path === 'data-stream') {
            const response = await fetch(targetUrl, {
                headers: {
                    'Accept': 'text/event-stream',
                },
            });
            
            // Return the response with proper SSE headers
            return new Response(response.body, {
                headers: {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                    'Access-Control-Allow-Origin': '*',
                },
            });
        }
        
        // Regular GET request
        const response = await fetch(targetUrl, {
            method: 'GET',
            headers: Object.fromEntries(request.headers),
        });
        
        const data = await response.text();
        
        return new Response(data, {
            status: response.status,
            headers: {
                'Content-Type': response.headers.get('Content-Type') || 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
        });
    } catch (error) {
        console.error('Proxy error:', error);
        return new Response(JSON.stringify({ error: 'Proxy error' }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
        });
    }
};

export const POST: RequestHandler = async ({ params, request }) => {
    const path = params.path || '';
    const targetUrl = `${HACKRF_SERVICE_URL}/${path}`;
    
    try {
        const body = await request.text();
        
        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(request.headers),
            },
            body: body,
        });
        
        const data = await response.text();
        
        return new Response(data, {
            status: response.status,
            headers: {
                'Content-Type': response.headers.get('Content-Type') || 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
        });
    } catch (error) {
        console.error('Proxy error:', error);
        return new Response(JSON.stringify({ error: 'Proxy error' }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
        });
    }
};

export const OPTIONS: RequestHandler = () => {
    return new Response(null, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
    });
};