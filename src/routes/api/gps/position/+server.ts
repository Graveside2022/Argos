import type { RequestHandler } from './$types';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface TPVData {
  class: string;
  mode: number;
  lat?: number;
  lon?: number;
  alt?: number;
  speed?: number;
  track?: number;
  epx?: number;
  epy?: number;
  time?: string;
}

interface SkyMessage {
  class: string;
  satellites?: Array<{
    used?: boolean;
  }>;
}

interface SatelliteData {
  used?: boolean;
}

function isSatelliteArray(value: unknown): value is SatelliteData[] {
  return Array.isArray(value) && value.every(item => 
    typeof item === 'object' && 
    item !== null && 
    (typeof (item as SatelliteData).used === 'boolean' || (item as SatelliteData).used === undefined)
  );
}

function parseTPVData(data: unknown): TPVData | null {
  if (typeof data !== 'object' || data === null) {
    return null;
  }
  
  const obj = data as Record<string, unknown>;
  
  if (typeof obj.class !== 'string' || obj.class !== 'TPV') {
    return null;
  }
  
  return {
    class: obj.class,
    mode: typeof obj.mode === 'number' ? obj.mode : 0,
    lat: typeof obj.lat === 'number' ? obj.lat : undefined,
    lon: typeof obj.lon === 'number' ? obj.lon : undefined,
    alt: typeof obj.alt === 'number' ? obj.alt : undefined,
    speed: typeof obj.speed === 'number' ? obj.speed : undefined,
    track: typeof obj.track === 'number' ? obj.track : undefined,
    epx: typeof obj.epx === 'number' ? obj.epx : undefined,
    epy: typeof obj.epy === 'number' ? obj.epy : undefined,
    time: typeof obj.time === 'string' ? obj.time : undefined
  };
}

function parseSkyMessage(data: unknown): SkyMessage | null {
  if (typeof data !== 'object' || data === null) {
    return null;
  }
  
  const obj = data as Record<string, unknown>;
  
  if (typeof obj.class !== 'string' || obj.class !== 'SKY') {
    return null;
  }
  
  return {
    class: obj.class,
    satellites: isSatelliteArray(obj.satellites) ? obj.satellites : undefined
  };
}

export const GET: RequestHandler = async () => {
  try {
    // Try to get GPS data from gpspipe (more reliable than parsing cgps)
    const { stdout } = await execAsync('timeout 2 gpspipe -w -n 5 | grep -m 1 TPV');
    
    // Parse the JSON output from gpspipe
    let tpvData: TPVData | null = null;
    try {
      const parsed = JSON.parse(stdout.trim()) as unknown;
      tpvData = parseTPVData(parsed);
    } catch {
      // JSON parsing failed
    }
    
    if (!tpvData) {
      throw new Error('Failed to parse TPV data');
    }
    
    // Try to get satellite info from gpspipe with JSON output
    let satelliteCount = 0;
    try {
      // Get more messages to try to catch a SKY message
      const { stdout: allMessages } = await execAsync('timeout 1 gpspipe -w -n 50 2>/dev/null || echo ""');
      const lines = allMessages.trim().split('\n');
      
      for (const line of lines) {
        if (line.trim() === '') continue;
        
        try {
          const parsed = JSON.parse(line) as unknown;
          const msg = parseSkyMessage(parsed);
          
          if (msg && msg.satellites) {
            // Count satellites that are used for the fix
            satelliteCount = msg.satellites.filter(sat => sat.used === true).length;
            break;
          }
        } catch {
          // Skip non-JSON lines
        }
      }
      
      // If still no satellite count, estimate from fix quality
      if (satelliteCount === 0 && tpvData.mode === 3) {
        // 3D fix typically uses at least 4 satellites
        satelliteCount = 4; // Conservative estimate
      }
    } catch {
      // If we can't get satellite data, that's ok
    }
    
    if (tpvData.class === 'TPV' && tpvData.mode >= 2) {
      // We have a valid fix
      return new Response(JSON.stringify({
        success: true,
        data: {
          latitude: tpvData.lat ?? null,
          longitude: tpvData.lon ?? null,
          altitude: tpvData.alt ?? null,
          speed: tpvData.speed ?? null,
          heading: tpvData.track ?? null,
          accuracy: tpvData.epx ?? tpvData.epy ?? 10, // Horizontal error in meters
          satellites: satelliteCount,
          fix: tpvData.mode, // 0=no fix, 1=no fix, 2=2D fix, 3=3D fix
          time: tpvData.time ?? null
        }
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      // No valid fix yet
      return new Response(JSON.stringify({
        success: false,
        error: 'No GPS fix available',
        mode: tpvData.mode
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (error: unknown) {
    // Fallback: try to get last known position from gpsd
    try {
      const { stdout: cgpsOutput } = await execAsync('timeout 1 cgps -s -x 2>&1 | head -20');
      
      // Parse cgps output (crude but works)
      const latMatch = cgpsOutput.match(/Latitude:\s+([-\d.]+)\s+[NS]/);
      const lonMatch = cgpsOutput.match(/Longitude:\s+([-\d.]+)\s+[EW]/);
      
      if (latMatch?.[1] && lonMatch?.[1]) {
        return new Response(JSON.stringify({
          success: true,
          data: {
            latitude: parseFloat(latMatch[1]),
            longitude: parseFloat(lonMatch[1]),
            altitude: null,
            speed: null,
            heading: null,
            accuracy: 50, // Assume 50m accuracy
            satellites: null,
            fix: 2,
            time: new Date().toISOString()
          }
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
    } catch {
      // Ignore fallback error
    }
    
    return new Response(JSON.stringify({
      success: false,
      error: 'GPS service not available. Make sure gpsd is running.',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};