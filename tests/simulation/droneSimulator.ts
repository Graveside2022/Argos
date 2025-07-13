export interface DroneSimulatorConfig {
  startPosition: { lat: number; lon: number };
  flightPattern: 'grid' | 'orbit' | 'linear' | 'random' | 'surveillance';
  speed: number; // m/s
  altitude: number; // meters
  duration: number; // seconds
  signalStrength?: number; // dBm
  frequency?: number; // Hz
  environmentFactors?: {
    windSpeed?: number; // m/s
    windDirection?: number; // degrees
    signalNoise?: number; // dB
    urbanDensity?: number; // 0-1
  };
}

export interface SimulatedSignal {
  timestamp: number;
  latitude: number;
  longitude: number;
  altitude: number;
  strength: number;
  frequency: number;
  velocity: { x: number; y: number; z: number };
  metadata: {
    droneId: string;
    pattern: string;
    batteryLevel: number;
    gpsAccuracy: number;
  };
}

export class DroneSimulator {
  private config: DroneSimulatorConfig;
  private currentPosition: { lat: number; lon: number; alt: number };
  private currentTime: number;
  private signals: SimulatedSignal[] = [];
  private droneId: string;
  
  constructor(config: DroneSimulatorConfig) {
    this.config = config;
    this.currentPosition = {
      lat: config.startPosition.lat,
      lon: config.startPosition.lon,
      alt: config.altitude
    };
    this.currentTime = Date.now();
    this.droneId = `drone_${Math.random().toString(36).substr(2, 9)}`;
  }

  simulate(): SimulatedSignal[] {
    const timeStep = 1000; // 1 second intervals
    const steps = Math.floor(this.config.duration * 1000 / timeStep);
    
    for (let i = 0; i < steps; i++) {
      this.updatePosition(timeStep / 1000);
      this.generateSignal();
      this.currentTime += timeStep;
      
      // Add some randomness for realism
      if (Math.random() < 0.1) {
        // 10% chance of missing signal
        continue;
      }
    }
    
    return this.signals;
  }

  private updatePosition(_deltaTime: number): void {
    switch (this.config.flightPattern) {
      case 'grid':
        this.updateGridPattern(_deltaTime);
        break;
      case 'orbit':
        this.updateOrbitPattern(_deltaTime);
        break;
      case 'linear':
        this.updateLinearPattern(_deltaTime);
        break;
      case 'surveillance':
        this.updateSurveillancePattern(_deltaTime);
        break;
      case 'random':
        this.updateRandomPattern(_deltaTime);
        break;
    }
    
    // Apply environmental factors
    if (this.config.environmentFactors) {
      this.applyWind(_deltaTime);
      this.applyGPSDrift();
    }
  }

  private updateGridPattern(_deltaTime: number): void {
    // Implement lawn mower pattern
    const gridSize = 0.001; // ~100m in latitude
    const speed = this.config.speed;
    const distance = speed * _deltaTime;
    
    // Convert to approximate lat/lon change
    const _latChange = (distance / 111320) * Math.cos(this.currentPosition.lat * Math.PI / 180);
    const lonChange = distance / 111320;
    
    // Simple back-and-forth pattern
    const row = Math.floor((this.currentTime - Date.now()) / 10000) % 10;
    if (row % 2 === 0) {
      this.currentPosition.lon += lonChange;
    } else {
      this.currentPosition.lon -= lonChange;
    }
    
    // Move to next row at boundaries
    if (Math.abs(this.currentPosition.lon - this.config.startPosition.lon) > gridSize * 5) {
      this.currentPosition.lat += gridSize;
    }
  }

  private updateOrbitPattern(_deltaTime: number): void {
    const radius = 0.0005; // ~50m radius
    const angularSpeed = this.config.speed / (radius * 111320);
    const angle = (this.currentTime - Date.now()) * angularSpeed / 1000;
    
    this.currentPosition.lat = this.config.startPosition.lat + radius * Math.cos(angle);
    this.currentPosition.lon = this.config.startPosition.lon + radius * Math.sin(angle);
  }

  private updateLinearPattern(_deltaTime: number): void {
    const bearing = 45; // degrees
    const distance = this.config.speed * _deltaTime;
    
    const latChange = (distance / 111320) * Math.cos(bearing * Math.PI / 180);
    const lonChange = (distance / 111320) * Math.sin(bearing * Math.PI / 180);
    
    this.currentPosition.lat += latChange;
    this.currentPosition.lon += lonChange;
  }

  private updateSurveillancePattern(_deltaTime: number): void {
    // Figure-8 pattern for surveillance
    const t = (this.currentTime - Date.now()) / 10000;
    const scale = 0.001;
    
    this.currentPosition.lat = this.config.startPosition.lat + scale * Math.sin(t);
    this.currentPosition.lon = this.config.startPosition.lon + scale * Math.sin(2 * t) / 2;
  }

  private updateRandomPattern(_deltaTime: number): void {
    const maxChange = 0.0001;
    this.currentPosition.lat += (Math.random() - 0.5) * maxChange;
    this.currentPosition.lon += (Math.random() - 0.5) * maxChange;
    this.currentPosition.alt += (Math.random() - 0.5) * 5;
    
    // Keep altitude in bounds
    this.currentPosition.alt = Math.max(10, Math.min(400, this.currentPosition.alt));
  }

  private applyWind(_deltaTime: number): void {
    if (!this.config.environmentFactors?.windSpeed) return;
    
    const windSpeed = this.config.environmentFactors.windSpeed;
    const windDirection = this.config.environmentFactors.windDirection || 0;
    
    const windEffect = windSpeed * _deltaTime / 111320;
    this.currentPosition.lat += windEffect * Math.cos(windDirection * Math.PI / 180);
    this.currentPosition.lon += windEffect * Math.sin(windDirection * Math.PI / 180);
  }

  private applyGPSDrift(): void {
    const drift = 0.00001; // ~1m drift
    this.currentPosition.lat += (Math.random() - 0.5) * drift;
    this.currentPosition.lon += (Math.random() - 0.5) * drift;
  }

  private generateSignal(): void {
    const baseStrength = this.config.signalStrength || -40;
    const noise = this.config.environmentFactors?.signalNoise || 5;
    
    // Calculate velocity
    const lastSignal = this.signals[this.signals.length - 1];
    let velocity = { x: 0, y: 0, z: 0 };
    
    if (lastSignal) {
      const dt = (this.currentTime - lastSignal.timestamp) / 1000;
      velocity = {
        x: (this.currentPosition.lon - lastSignal.longitude) * 111320 / dt,
        y: (this.currentPosition.lat - lastSignal.latitude) * 111320 / dt,
        z: (this.currentPosition.alt - lastSignal.altitude) / dt
      };
    }
    
    const signal: SimulatedSignal = {
      timestamp: this.currentTime,
      latitude: this.currentPosition.lat,
      longitude: this.currentPosition.lon,
      altitude: this.currentPosition.alt,
      strength: baseStrength + (Math.random() - 0.5) * noise,
      frequency: this.config.frequency || 2437000000, // 2.437 GHz
      velocity,
      metadata: {
        droneId: this.droneId,
        pattern: this.config.flightPattern,
        batteryLevel: 100 - (this.signals.length / 10), // Simulate battery drain
        gpsAccuracy: 5 + Math.random() * 10 // 5-15m accuracy
      }
    };
    
    this.signals.push(signal);
  }

  // Utility methods for testing
  getFlightPath(): Array<{ lat: number; lon: number; alt: number }> {
    return this.signals.map(s => ({
      lat: s.latitude,
      lon: s.longitude,
      alt: s.altitude
    }));
  }

  getAverageSpeed(): number {
    if (this.signals.length < 2) return 0;
    
    let totalDistance = 0;
    for (let i = 1; i < this.signals.length; i++) {
      const prev = this.signals[i - 1];
      const curr = this.signals[i];
      const distance = this.calculateDistance(
        prev.latitude, prev.longitude,
        curr.latitude, curr.longitude
      );
      totalDistance += distance;
    }
    
    const totalTime = (this.signals[this.signals.length - 1].timestamp - this.signals[0].timestamp) / 1000;
    return totalDistance / totalTime;
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }
}