/**
 * Network relationship analyzer for RF signals
 * Detects connections and relationships between devices
 */

import type { SignalMarker } from '$lib/stores/map/signals';

export interface NetworkNode {
  id: string;
  signal: SignalMarker;
  type: 'ap' | 'client' | 'peer' | 'unknown';
  connections: string[]; // IDs of connected nodes
  metadata: {
    ssid?: string;
    manufacturer?: string;
    protocol?: string;
    channel?: number;
  };
}

export interface NetworkEdge {
  id: string;
  source: string;
  target: string;
  type: 'wifi' | 'bluetooth' | 'direct' | 'inferred';
  strength: number; // 0-1 normalized
  metadata: {
    frequency?: number;
    distance?: number;
    lastSeen: number;
  };
}

export interface NetworkGraph {
  nodes: Map<string, NetworkNode>;
  edges: Map<string, NetworkEdge>;
  clusters: NetworkCluster[];
}

export interface NetworkCluster {
  id: string;
  name: string;
  type: 'wifi_network' | 'bluetooth_group' | 'device_cluster';
  nodeIds: string[];
  center: { lat: number; lon: number };
  radius: number;
}

/**
 * Analyze signals to build network relationships
 */
export function analyzeNetworkRelationships(signals: SignalMarker[]): NetworkGraph {
  const nodes = new Map<string, NetworkNode>();
  const edges = new Map<string, NetworkEdge>();
  const clusters: NetworkCluster[] = [];
  
  // First pass: Create nodes and detect device types
  signals.forEach(signal => {
    const node: NetworkNode = {
      id: signal.id,
      signal,
      type: detectNodeType(signal),
      connections: [],
      metadata: extractMetadata(signal)
    };
    nodes.set(signal.id, node);
  });
  
  // Second pass: Detect relationships
  const nodeArray = Array.from(nodes.values());
  
  for (let i = 0; i < nodeArray.length; i++) {
    for (let j = i + 1; j < nodeArray.length; j++) {
      const node1 = nodeArray[i];
      const node2 = nodeArray[j];
      
      const relationship = detectRelationship(node1, node2);
      if (relationship) {
        const edge: NetworkEdge = {
          id: `${node1.id}-${node2.id}`,
          source: node1.id,
          target: node2.id,
          type: relationship.type,
          strength: relationship.strength,
          metadata: {
            frequency: relationship.frequency,
            distance: calculateDistance(
              node1.signal.lat,
              node1.signal.lon,
              node2.signal.lat,
              node2.signal.lon
            ),
            lastSeen: Math.max(node1.signal.timestamp, node2.signal.timestamp)
          }
        };
        
        edges.set(edge.id, edge);
        node1.connections.push(node2.id);
        node2.connections.push(node1.id);
      }
    }
  }
  
  // Third pass: Identify clusters
  const identifiedClusters = identifyNetworkClusters(nodes, edges);
  clusters.push(...identifiedClusters);
  
  return { nodes, edges, clusters };
}

/**
 * Detect node type based on signal characteristics
 */
function detectNodeType(signal: SignalMarker): 'ap' | 'client' | 'peer' | 'unknown' {
  const signalType = signal.metadata?.signalType || '';
  const power = signal.power;
  const _freq = signal.frequency;
  
  // Access points typically have stronger, consistent signals
  if (signalType.includes('wifi') && power > -60) {
    return 'ap';
  }
  
  // Clients have weaker signals
  if (signalType.includes('wifi') && power < -70) {
    return 'client';
  }
  
  // Bluetooth devices are peers
  if (signalType === 'bluetooth') {
    return 'peer';
  }
  
  return 'unknown';
}

/**
 * Extract metadata from signal
 */
function extractMetadata(signal: SignalMarker): NetworkNode['metadata'] {
  const metadata: NetworkNode['metadata'] = {};
  
  // Extract WiFi channel from frequency
  if (signal.frequency >= 2412 && signal.frequency <= 2484) {
    metadata.channel = Math.round((signal.frequency - 2412) / 5) + 1;
    metadata.protocol = 'wifi_2.4';
  } else if (signal.frequency >= 5180 && signal.frequency <= 5825) {
    metadata.protocol = 'wifi_5';
    // 5GHz channel calculation is more complex
    metadata.channel = Math.round((signal.frequency - 5180) / 5) + 36;
  }
  
  // TODO: Extract SSID from signal data if available
  // TODO: Extract manufacturer from MAC address OUI
  
  return metadata;
}

/**
 * Detect relationship between two nodes
 */
function detectRelationship(
  node1: NetworkNode, 
  node2: NetworkNode
): { type: NetworkEdge['type']; strength: number; frequency?: number } | null {
  const signal1 = node1.signal;
  const signal2 = node2.signal;
  
  // Check temporal correlation (signals appear at similar times)
  const timeDiff = Math.abs(signal1.timestamp - signal2.timestamp);
  if (timeDiff > 5000) return null; // More than 5 seconds apart
  
  // Check spatial proximity
  const distance = calculateDistance(
    signal1.lat,
    signal1.lon,
    signal2.lat,
    signal2.lon
  );
  
  if (distance > 100) return null; // More than 100m apart
  
  // Check frequency relationships
  if (node1.metadata.channel && node2.metadata.channel) {
    if (node1.metadata.channel === node2.metadata.channel) {
      // Same WiFi channel - likely same network
      if (node1.type === 'ap' && node2.type === 'client') {
        return {
          type: 'wifi',
          strength: 0.9,
          frequency: signal1.frequency
        };
      }
      if (node1.type === 'client' && node2.type === 'client') {
        // Two clients on same channel - possibly same network
        return {
          type: 'inferred',
          strength: 0.5,
          frequency: signal1.frequency
        };
      }
    }
  }
  
  // Check for Bluetooth relationships
  if (signal1.metadata?.signalType === 'bluetooth' && signal2.metadata?.signalType === 'bluetooth') {
    // Bluetooth devices in proximity might be paired
    if (distance < 10) {
      return {
        type: 'bluetooth',
        strength: 0.7,
        frequency: 2400
      };
    }
  }
  
  // Check for similar signal patterns (might be same device with multiple radios)
  if (Math.abs(signal1.power - signal2.power) < 5 && distance < 5) {
    return {
      type: 'direct',
      strength: 0.8
    };
  }
  
  return null;
}

/**
 * Identify network clusters
 */
function identifyNetworkClusters(
  nodes: Map<string, NetworkNode>,
  edges: Map<string, NetworkEdge>
): NetworkCluster[] {
  const clusters: NetworkCluster[] = [];
  const visited = new Set<string>();
  
  // Find connected components using DFS
  nodes.forEach((node, nodeId) => {
    if (!visited.has(nodeId)) {
      const cluster = exploreCluster(nodeId, nodes, edges, visited);
      if (cluster.nodeIds.length > 1) {
        clusters.push(cluster);
      }
    }
  });
  
  return clusters;
}

/**
 * Explore a cluster using depth-first search
 */
function exploreCluster(
  startNodeId: string,
  nodes: Map<string, NetworkNode>,
  edges: Map<string, NetworkEdge>,
  visited: Set<string>
): NetworkCluster {
  const clusterNodes: string[] = [];
  const stack = [startNodeId];
  let latSum = 0;
  let lonSum = 0;
  let maxDistance = 0;
  let clusterType: NetworkCluster['type'] = 'device_cluster';
  
  while (stack.length > 0) {
    const nodeId = stack.pop();
    if (!nodeId || visited.has(nodeId)) continue;
    
    visited.add(nodeId);
    clusterNodes.push(nodeId);
    
    const node = nodes.get(nodeId);
    if (!node) continue;
    
    latSum += node.signal.lat;
    lonSum += node.signal.lon;
    
    // Determine cluster type
    if (node.metadata.protocol?.includes('wifi')) {
      clusterType = 'wifi_network';
    } else if (node.metadata.protocol === 'bluetooth' && clusterType !== 'wifi_network') {
      clusterType = 'bluetooth_group';
    }
    
    // Add connected nodes to stack
    node.connections.forEach(connectedId => {
      if (!visited.has(connectedId)) {
        stack.push(connectedId);
      }
    });
  }
  
  const centerLat = latSum / clusterNodes.length;
  const centerLon = lonSum / clusterNodes.length;
  
  // Calculate radius
  clusterNodes.forEach(nodeId => {
    const node = nodes.get(nodeId);
    if (!node) return;
    
    const dist = calculateDistance(
      centerLat,
      centerLon,
      node.signal.lat,
      node.signal.lon
    );
    maxDistance = Math.max(maxDistance, dist);
  });
  
  return {
    id: `cluster-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: `${clusterType.replace('_', ' ')} (${clusterNodes.length} devices)`,
    type: clusterType,
    nodeIds: clusterNodes,
    center: { lat: centerLat, lon: centerLon },
    radius: maxDistance
  };
}

/**
 * Calculate distance between two points in meters
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
}

/**
 * Calculate force-directed layout positions
 */
export function calculateNetworkLayout(
  graph: NetworkGraph,
  bounds: { width: number; height: number; centerLat: number; centerLon: number },
  iterations: number = 100
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const forces = new Map<string, { fx: number; fy: number }>();
  
  // Initialize positions randomly
  graph.nodes.forEach((node, nodeId) => {
    positions.set(nodeId, {
      x: Math.random() * bounds.width - bounds.width / 2,
      y: Math.random() * bounds.height - bounds.height / 2
    });
    forces.set(nodeId, { fx: 0, fy: 0 });
  });
  
  // Force-directed layout iterations
  for (let iter = 0; iter < iterations; iter++) {
    // Reset forces
    forces.forEach(force => {
      force.fx = 0;
      force.fy = 0;
    });
    
    // Apply repulsive forces between all nodes
    const nodeIds = Array.from(graph.nodes.keys());
    for (let i = 0; i < nodeIds.length; i++) {
      for (let j = i + 1; j < nodeIds.length; j++) {
        const pos1 = positions.get(nodeIds[i]);
        const pos2 = positions.get(nodeIds[j]);
        if (!pos1 || !pos2) continue;
        
        const dx = pos2.x - pos1.x;
        const dy = pos2.y - pos1.y;
        const dist = Math.sqrt(dx * dx + dy * dy) + 0.01;
        
        const repulsion = 1000 / (dist * dist);
        const fx = (dx / dist) * repulsion;
        const fy = (dy / dist) * repulsion;
        
        const force1 = forces.get(nodeIds[i]);
        const force2 = forces.get(nodeIds[j]);
        if (force1 && force2) {
          force1.fx -= fx;
          force1.fy -= fy;
          force2.fx += fx;
          force2.fy += fy;
        }
      }
    }
    
    // Apply attractive forces along edges
    graph.edges.forEach(edge => {
      const pos1 = positions.get(edge.source);
      const pos2 = positions.get(edge.target);
      if (!pos1 || !pos2) return;
      
      const dx = pos2.x - pos1.x;
      const dy = pos2.y - pos1.y;
      const dist = Math.sqrt(dx * dx + dy * dy) + 0.01;
      
      const attraction = dist * 0.1 * edge.strength;
      const fx = (dx / dist) * attraction;
      const fy = (dy / dist) * attraction;
      
      const sourceForce = forces.get(edge.source);
      const targetForce = forces.get(edge.target);
      if (sourceForce && targetForce) {
        sourceForce.fx += fx;
        sourceForce.fy += fy;
        targetForce.fx -= fx;
        targetForce.fy -= fy;
      }
    });
    
    // Update positions
    positions.forEach((pos, nodeId) => {
      const force = forces.get(nodeId);
      if (!force) return;
      
      const damping = 0.8;
      
      pos.x += force.fx * damping;
      pos.y += force.fy * damping;
      
      // Keep within bounds
      pos.x = Math.max(-bounds.width / 2, Math.min(bounds.width / 2, pos.x));
      pos.y = Math.max(-bounds.height / 2, Math.min(bounds.height / 2, pos.y));
    });
  }
  
  return positions;
}