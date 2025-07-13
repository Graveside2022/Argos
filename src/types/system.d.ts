// Type definitions for system information and monitoring

export interface CPUInfo {
  usage: number; // Percentage 0-100
  temperature?: number; // Celsius
  cores?: number;
  model?: string;
  speed?: number; // MHz
  governor?: string;
}

export interface MemoryInfo {
  total: number; // Bytes
  used: number; // Bytes
  free: number; // Bytes
  available: number; // Bytes
  percent: number; // Percentage 0-100
  swap?: {
    total: number;
    used: number;
    free: number;
    percent: number;
  } | null;
}

export interface DiskInfo {
  total: number; // Bytes
  used: number; // Bytes
  free: number; // Bytes
  percent: number; // Percentage 0-100
  mountPoint?: string;
  filesystem?: string;
}

export interface NetworkInterface {
  name: string;
  ip?: string;
  mac?: string;
  type: 'ethernet' | 'wifi' | 'virtual' | 'other';
  status: 'up' | 'down';
  speed?: number; // Mbps
  stats?: {
    bytesReceived: number;
    bytesSent: number;
    packetsReceived: number;
    packetsSent: number;
    errors: number;
    drops: number;
  } | null;
}

export interface ProcessInfo {
  pid: number;
  name: string;
  cpu: number; // Percentage
  memory: number; // Percentage
  status: string;
  user?: string;
  command?: string;
}

export interface SystemInfo {
  hostname: string;
  platform: string;
  kernel: string;
  arch: string;
  uptime: number; // Seconds
  loadAverage?: [number, number, number]; // 1, 5, 15 minute averages
  cpu: CPUInfo;
  memory: MemoryInfo;
  disk: DiskInfo;
  network: NetworkInterface[];
  processes?: ProcessInfo[];
  timestamp: number;
}

export interface GPSInfo {
  lat: number;
  lon: number;
  altitude?: number; // Meters
  speed?: number; // km/h
  heading?: number; // Degrees 0-360
  accuracy?: number; // Meters
  satellites?: number;
  fix?: '2D' | '3D' | 'none';
  timestamp: number;
  mgrs?: string; // Military Grid Reference System coordinates
}

export interface ServiceStatus {
  name: string;
  status: 'running' | 'stopped' | 'error' | 'unknown';
  pid?: number;
  uptime?: number; // Seconds
  memory?: number; // Bytes
  cpu?: number; // Percentage
  error?: string;
}

export interface SystemServices {
  kismet: ServiceStatus;
  hackrf: ServiceStatus;
  websocket: ServiceStatus;
  gps?: ServiceStatus;
  [key: string]: ServiceStatus | undefined;
}

export interface SystemMessage {
  type: 'system';
  data: {
    info?: SystemInfo;
    services?: SystemServices;
    alerts?: SystemAlert[];
  } & { [key: string]: unknown };
  timestamp: number;
}

export interface SystemAlert {
  id: string;
  type: 'warning' | 'error' | 'info';
  category: 'cpu' | 'memory' | 'disk' | 'network' | 'service' | 'other';
  message: string;
  details?: unknown;
  timestamp: number;
  resolved?: boolean;
}

export interface SystemMetrics {
  cpu: {
    current: number;
    average: number;
    max: number;
    history: Array<{ value: number; timestamp: number }>;
  };
  memory: {
    current: number;
    average: number;
    max: number;
    history: Array<{ value: number; timestamp: number }>;
  };
  network: {
    rxRate: number; // Bytes/sec
    txRate: number; // Bytes/sec
    totalRx: number; // Total bytes received
    totalTx: number; // Total bytes sent
  };
  signals: {
    total: number;
    rate: number; // Signals per second
    bySource: Record<string, number>;
  };
}

export interface SystemConfig {
  updateInterval: number; // Milliseconds
  alertThresholds: {
    cpuWarning: number; // Percentage
    cpuError: number;
    memoryWarning: number;
    memoryError: number;
    diskWarning: number;
    diskError: number;
  };
  monitoring: {
    cpu: boolean;
    memory: boolean;
    disk: boolean;
    network: boolean;
    services: boolean;
  };
}