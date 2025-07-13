import { KismetProxy } from '$lib/server/kismet';
import { logInfo, logError, logWarn } from '$lib/utils/logger';

/**
 * Represents a wireless device detected by Kismet
 */
export interface KismetDevice {
  mac: string;
  last_seen: number;
  signal: {
    last_signal: number;
    max_signal: number;
    min_signal: number;
  };
  manufacturer: string;
  type: string;
  channel: number;
  frequency: number;
  packets: number;
  datasize: number;
  location: {
    lat: number;
    lon: number;
  };
}

/**
 * GPS coordinates for device location
 */
export interface GPSPosition {
  latitude: number;
  longitude: number;
}

/**
 * Response from the Kismet device service
 */
export interface DevicesResponse {
  devices: KismetDevice[];
  error: string | null;
  source: 'kismet' | 'fallback';
}

/**
 * Service layer for Kismet device operations
 * Handles communication with Kismet server and provides fallback mechanisms
 */
export class KismetService {
  private static readonly DEFAULT_LAT = 50.083933333;
  private static readonly DEFAULT_LON = 8.274061667;
  private static readonly LOCATION_VARIANCE = 0.002;
  private static readonly DEFAULT_SIGNAL = -100;
  
  private static readonly FALLBACK_DEVICES = [
    {
      mac: '92:D8:CF:44:9C:F6',
      manufacturer: 'Unknown',
      type: 'wifi',
      channel: 6,
      frequency: 2437,
      signal: -65
    },
    {
      mac: 'F0:AF:85:A9:F8:86',
      manufacturer: 'Unknown', 
      type: 'wifi',
      channel: 11,
      frequency: 2462,
      signal: -72
    },
    {
      mac: '88:71:B1:95:65:3A',
      manufacturer: 'ARRIS',
      type: 'wifi ap',
      channel: 1,
      frequency: 2412,
      signal: -55
    },
    {
      mac: 'B0:D8:88:31:C0:04',
      manufacturer: 'Mobile Device',
      type: 'wifi client',
      channel: 6,
      frequency: 2437,
      signal: -78
    }
  ];

  /**
   * Retrieves current GPS position from the GPS API
   * @param fetchFn - The fetch function to use for HTTP requests
   * @returns GPS position or default coordinates if unavailable
   */
  static async getGPSPosition(fetchFn: typeof fetch): Promise<GPSPosition> {
    try {
      const gpsResponse = await fetchFn('/api/gps/position');
      if (gpsResponse.ok) {
        const gpsData = (await gpsResponse.json()) as Record<string, unknown>;
        if (gpsData.success && gpsData.data) {
          const data = gpsData.data as Record<string, unknown>;
          return {
            latitude: data.latitude as number,
            longitude: data.longitude as number
          };
        }
      }
    } catch (error) {
      logWarn('Could not get GPS position, using defaults', { error });
    }
    
    return {
      latitude: this.DEFAULT_LAT,
      longitude: this.DEFAULT_LON
    };
  }

  /**
   * Retrieves wireless devices from Kismet using multiple fallback strategies
   * @param fetchFn - The fetch function to use for HTTP requests
   * @returns Device list with source information and any errors
   */
  static async getDevices(fetchFn: typeof fetch): Promise<DevicesResponse> {
    const gpsPosition = await this.getGPSPosition(fetchFn);
    let devices: KismetDevice[] = [];
    let error: string | null = null;

    // Method 1: Try the KismetProxy getDevices method
    try {
      logWarn('Attempting to fetch devices from Kismet using KismetProxy...');
      const kismetDevices = await KismetProxy.getDevices();
      devices = this.transformKismetDevices(kismetDevices, gpsPosition);
      logInfo(`Successfully fetched ${devices.length} devices from Kismet`);
      return { devices, error: null, source: 'kismet' };
    } catch (err: unknown) {
      error = (err as { message?: string }).message || 'Unknown error';
      logError('KismetProxy.getDevices failed', { error });
    }

    // Method 2: Try direct REST API endpoints
    try {
      logWarn('Attempting direct Kismet REST API...');
      const timestamp = Math.floor(Date.now() / 1000) - 300; // 5 minutes ago
      const response = await KismetProxy.proxyGet(`/devices/last-time/${timestamp}/devices.json`);
      
      if (Array.isArray(response)) {
        if (response.length > 0) {
          logWarn('Sample device signal data', {
            signal: (response[0] as Record<string, unknown>)['kismet.device.base.signal']
          });
        }
        devices = this.transformRawKismetDevices(response, gpsPosition);
        logInfo(`Fetched ${devices.length} devices via last-time endpoint`);
        return { devices, error: null, source: 'kismet' };
      }
    } catch (err2: unknown) {
      logError('Direct REST API failed', { error: (err2 as { message?: string }).message });
    }

    // Method 3: Try simple devices endpoint
    try {
      const simpleResponse = await KismetProxy.proxyGet('/devices/summary/devices.json');
      if (Array.isArray(simpleResponse)) {
        devices = this.transformRawKismetDevices(simpleResponse.slice(0, 50), gpsPosition);
        return { devices, error: null, source: 'kismet' };
      }
    } catch (err3: unknown) {
      logError('Summary endpoint failed', { error: (err3 as { message?: string }).message });
    }

    // If all methods failed, return fallback devices
    if (devices.length === 0 && error) {
      logWarn('All Kismet API methods failed, using fallback devices from logs');
      devices = this.createFallbackDevices(gpsPosition);
    }

    logWarn(`Returning ${devices.length} devices (real: ${!error}, fallback: ${!!error})`);
    return { devices, error, source: error ? 'fallback' : 'kismet' };
  }

  private static transformKismetDevices(kismetDevices: unknown[], gpsPosition: GPSPosition): KismetDevice[] {
    return kismetDevices.map((device: unknown) => {
      const d = device as Record<string, unknown>;
      const rawSignal = (d.signal as number) || this.DEFAULT_SIGNAL;
      const rawType = d.type as string;

      return {
        mac: d.mac as string,
        last_seen: new Date(d.lastSeen as string).getTime(),
        signal: {
          last_signal: rawSignal,
          max_signal: rawSignal,
          min_signal: rawSignal
        },
        manufacturer: (d.manufacturer as string) || 'Unknown',
        type: rawType?.toLowerCase() || 'unknown',
        channel: (d.channel as number) || 0,
        frequency: ((d.channel as number) || 0) * 5 + 2400,
        packets: (d.packets as number) || 0,
        datasize: (d.packets as number) || 0,
        location: {
          lat: ((d.location as Record<string, unknown>)?.lat as number) || 
               gpsPosition.latitude + (Math.random() - 0.5) * this.LOCATION_VARIANCE,
          lon: ((d.location as Record<string, unknown>)?.lon as number) || 
               gpsPosition.longitude + (Math.random() - 0.5) * this.LOCATION_VARIANCE
        }
      };
    });
  }

  private static transformRawKismetDevices(rawDevices: unknown[], gpsPosition: GPSPosition): KismetDevice[] {
    return rawDevices.map((device: unknown) => {
      const d = device as Record<string, unknown>;
      const rawSignal = this.extractSignalFromDevice(d);
      const rawType = (d['kismet.device.base.type'] as string) || 'Unknown';

      return {
        mac: (d['kismet.device.base.macaddr'] as string) || 'Unknown',
        last_seen: ((d['kismet.device.base.last_time'] as number) || 0) * 1000,
        signal: {
          last_signal: rawSignal,
          max_signal: rawSignal,
          min_signal: rawSignal
        },
        manufacturer: (d['kismet.device.base.manuf'] as string) || 'Unknown',
        type: rawType.toLowerCase(),
        channel: (d['kismet.device.base.channel'] as number) || 0,
        frequency: ((d['kismet.device.base.channel'] as number) || 0) * 5 + 2400,
        packets: (d['kismet.device.base.packets.total'] as number) || 0,
        datasize: (d['kismet.device.base.packets.total'] as number) || 0,
        location: {
          lat: ((d['kismet.device.base.location'] as Record<string, unknown>)?.['kismet.common.location.lat'] as number) ||
               gpsPosition.latitude + (Math.random() - 0.5) * this.LOCATION_VARIANCE,
          lon: ((d['kismet.device.base.location'] as Record<string, unknown>)?.['kismet.common.location.lon'] as number) ||
               gpsPosition.longitude + (Math.random() - 0.5) * this.LOCATION_VARIANCE
        }
      };
    });
  }

  private static extractSignalFromDevice(device: Record<string, unknown>): number {
    const signalField = device['kismet.device.base.signal'];
    
    if (typeof signalField === 'object' && signalField !== null) {
      const signalObj = signalField as Record<string, unknown>;
      return (signalObj['kismet.common.signal.last_signal'] as number) ||
             (signalObj['kismet.common.signal.max_signal'] as number) ||
             this.DEFAULT_SIGNAL;
    }
    
    return (signalField as number) || this.DEFAULT_SIGNAL;
  }

  private static createFallbackDevices(gpsPosition: GPSPosition): KismetDevice[] {
    return this.FALLBACK_DEVICES.map(device => ({
      mac: device.mac,
      last_seen: Date.now(),
      signal: {
        last_signal: device.signal,
        max_signal: device.signal,
        min_signal: device.signal
      },
      manufacturer: device.manufacturer,
      type: device.type,
      channel: device.channel,
      frequency: device.frequency,
      packets: Math.floor(Math.random() * 1000),
      datasize: Math.floor(Math.random() * 1000),
      location: {
        lat: gpsPosition.latitude + (Math.random() - 0.5) * this.LOCATION_VARIANCE,
        lon: gpsPosition.longitude + (Math.random() - 0.5) * this.LOCATION_VARIANCE
      }
    }));
  }
}