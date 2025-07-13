import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getRFDatabase } from '$lib/server/db/database';
import type { NetworkEdge } from '$lib/services/map/networkAnalyzer';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const db = getRFDatabase();
    const { edges } = await request.json() as { edges: NetworkEdge[] };
    
    if (!edges || !Array.isArray(edges)) {
      return error(400, 'Invalid edges array');
    }
    
    // Create a map for efficient storage
    const edgeMap = new Map<string, NetworkEdge>();
    edges.forEach(edge => {
      edgeMap.set(edge.id, edge);
    });
    
    // Store network graph
    db.storeNetworkGraph(new Map(), edgeMap);
    
    return json({ 
      success: true, 
      count: edges.length 
    });
  } catch (err: unknown) {
    console.error('Error storing relationships:', err);
    return error(500, 'Failed to store relationships');
  }
};

export const GET: RequestHandler = ({ url }) => {
  try {
    const db = getRFDatabase();
    const deviceIds = url.searchParams.getAll('deviceId');
    
    const relationships = db.getNetworkRelationships(
      deviceIds.length > 0 ? deviceIds : undefined
    );
    
    return json({ relationships });
  } catch (err: unknown) {
    console.error('Error getting relationships:', err);
    return error(500, 'Failed to get relationships');
  }
};