// Corresponds to the 'devices' table
export interface Device {
  id: number;
  device_id: string;
  type: string;
  manufacturer: string | null;
  first_seen: number;
  last_seen: number;
  avg_power: number | null;
  freq_min: number | null;
  freq_max: number | null;
  metadata: string | null; // JSON string
}

// Corresponds to the 'signals' table
export interface Signal {
  id: number;
  signal_id: string;
  device_id: string | null;
  timestamp: number;
  latitude: number;
  longitude: number;
  altitude?: number; // Added based on actual schema
  power: number;
  frequency: number;
  bandwidth: number | null;
  modulation: string | null;
  source: string;
  metadata: string | null; // JSON string
}