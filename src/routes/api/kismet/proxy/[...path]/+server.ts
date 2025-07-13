// Generic proxy endpoint for Kismet API
// Routes: /api/kismet/proxy/* -> Kismet API
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { KismetProxy } from '$lib/server/kismet';

export const GET: RequestHandler = async ({ params, url }) => {
  try {
    // Reconstruct the path from the catch-all parameter
    const kismetPath = params.path ? `/${params.path}` : '/';
    
    // Add query parameters if any
    const queryString = url.searchParams.toString();
    const fullPath = queryString ? `${kismetPath}?${queryString}` : kismetPath;
    
    const result = await KismetProxy.proxyGet(fullPath);
    
    return json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error: unknown) {
    console.error('Kismet proxy GET error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isConnectionError = errorMessage.includes('Cannot connect to Kismet');
    
    return json({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString()
    }, { 
      status: isConnectionError ? 503 : 500 
    });
  }
};

export const POST: RequestHandler = async ({ params, request, url }) => {
  try {
    // Reconstruct the path from the catch-all parameter
    const kismetPath = params.path ? `/${params.path}` : '/';
    
    // Add query parameters if any
    const queryString = url.searchParams.toString();
    const fullPath = queryString ? `${kismetPath}?${queryString}` : kismetPath;
    
    // Get request body
    let body;
    const contentType = request.headers.get('content-type');
    
    if (contentType?.includes('application/json')) {
      body = await request.json() as Record<string, unknown>;
    } else {
      body = await request.text();
    }
    
    const result = await KismetProxy.proxyPost(fullPath, body);
    
    return json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error: unknown) {
    console.error('Kismet proxy POST error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isConnectionError = errorMessage.includes('Cannot connect to Kismet');
    
    return json({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString()
    }, { 
      status: isConnectionError ? 503 : 500 
    });
  }
};

export const PUT: RequestHandler = async ({ params, request, url }) => {
  try {
    const kismetPath = params.path ? `/${params.path}` : '/';
    const queryString = url.searchParams.toString();
    const fullPath = queryString ? `${kismetPath}?${queryString}` : kismetPath;
    
    let body;
    const contentType = request.headers.get('content-type');
    
    if (contentType?.includes('application/json')) {
      body = await request.json() as Record<string, unknown>;
    } else {
      body = await request.text();
    }
    
    const result = await KismetProxy.proxy(fullPath, 'PUT', body);
    
    return json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error: unknown) {
    console.error('Kismet proxy PUT error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isConnectionError = errorMessage.includes('Cannot connect to Kismet');
    
    return json({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString()
    }, { 
      status: isConnectionError ? 503 : 500 
    });
  }
};

export const DELETE: RequestHandler = async ({ params, url }) => {
  try {
    const kismetPath = params.path ? `/${params.path}` : '/';
    const queryString = url.searchParams.toString();
    const fullPath = queryString ? `${kismetPath}?${queryString}` : kismetPath;
    
    const result = await KismetProxy.proxy(fullPath, 'DELETE');
    
    return json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error: unknown) {
    console.error('Kismet proxy DELETE error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isConnectionError = errorMessage.includes('Cannot connect to Kismet');
    
    return json({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString()
    }, { 
      status: isConnectionError ? 503 : 500 
    });
  }
};