// Kismet API type definitions
import type { KismetAlert } from '$lib/types/kismet';

export interface KismetServiceStatus {
  running: boolean;
  pid?: number;
  uptime?: number;
  memory?: number;
  cpu?: number;
  error?: string;
}

export interface KismetDevice {
  mac: string;
  ssid?: string;
  manufacturer?: string;
  type: 'AP' | 'Client' | 'Bridge' | 'Unknown';
  channel?: number;
  frequency?: number;
  signal?: number;
  lastSeen: string;
  firstSeen: string;
  packets: number;
  dataPackets?: number;
  encryptionType?: string[];
  location?: {
    lat?: number;
    lon?: number;
    alt?: number;
  };
}

export interface KismetScript {
  name: string;
  path: string;
  description?: string;
  executable: boolean;
  running?: boolean;
  pid?: number;
}

export interface KismetConfig {
  interfaces: string[];
  channels: number[];
  hopRate: number;
  logLevel: string;
  logPath: string;
  alertsEnabled: boolean;
  gpsEnabled: boolean;
  remoteCapture?: {
    enabled: boolean;
    sources: string[];
  };
}

export interface ScriptExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
  pid?: number;
  exitCode?: number;
}

export interface DeviceFilter {
  type?: 'AP' | 'Client' | 'Bridge' | 'Unknown';
  manufacturer?: string;
  ssid?: string;
  minSignal?: number;
  maxSignal?: number;
  encryptionType?: string;
  seenWithin?: number; // minutes
}

export interface DeviceStats {
  total: number;
  byType: {
    AP: number;
    Client: number;
    Bridge: number;
    Unknown: number;
  };
  byEncryption: Record<string, number>;
  byManufacturer: Record<string, number>;
  activeInLast5Min: number;
  activeInLast15Min: number;
}

export interface KismetApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface WebSocketMessage {
  type: 'device_update' | 'alert' | 'status_change' | 'log' | 'error';
  data: KismetDevice | KismetAlert | KismetServiceStatus | string | Record<string, unknown>;
  timestamp: string;
}