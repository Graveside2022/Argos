/**
 * Coral TPU Accelerator Service v2
 * Retooled for LAN deployment with focus on stability
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

export interface CoralPrediction {
  heatMap: number[][];
  confidence: number[][];
  processingTime: number;
}

export class CoralAccelerator extends EventEmitter {
  private coralProcess: ChildProcess | null = null;
  private isReady: boolean = false;
  private commandQueue: Map<string, (result: any) => void> = new Map();
  private restartAttempts: number = 0;
  private readonly MAX_RESTART_ATTEMPTS = 3;
  private healthCheckInterval?: NodeJS.Timeout;
  private lastHealthCheck: number = Date.now();
  
  constructor(private modelPath: string = './models/rssi_predictor.tflite') {
    super();
  }
  
  async initialize(): Promise<void> {
    return this.startProcess();
  }
  
  private async startProcess(): Promise<void> {
    return new Promise(async (resolve, reject) => {
      // Check if Python 3.9 environment exists
      const pythonPath = '/home/ubuntu/projects/Argos/.coral_env/bin/python';
      const fallbackPython = 'python3'; // Use system Python as fallback
      
      // Try Coral environment first, fall back to system Python
      const fs = (await import('fs')).default;
      const pythonExe = fs.existsSync(pythonPath) ? pythonPath : fallbackPython;
      
      console.log(`Starting Coral worker with ${pythonExe}`);
      
      this.coralProcess = spawn(pythonExe, [
        '/home/ubuntu/projects/Argos/src/lib/services/localization/coral/coral_worker.py',
        this.modelPath
      ]);
      
      // Set up stdout handler
      let buffer = '';
      this.coralProcess.stdout?.on('data', (data) => {
        buffer += data.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer
        
        for (const line of lines) {
          if (!line.trim()) continue;
          this.handleMessage(line);
        }
      });
      
      // Error handling
      this.coralProcess.stderr?.on('data', (data) => {
        console.error('Coral stderr:', data.toString());
      });
      
      this.coralProcess.on('exit', (code) => {
        console.log(`Coral process exited with code ${code}`);
        this.handleProcessExit();
      });
      
      this.coralProcess.on('error', (error) => {
        console.error('Failed to start Coral process:', error);
        reject(error);
      });
      
      // Set up initialization timeout
      const timeout = setTimeout(() => {
        if (!this.isReady) {
          this.cleanup();
          reject(new Error('Coral initialization timeout'));
        }
      }, 10000);
      
      // Store resolve callback for when ready message arrives
      this.once('ready', () => {
        clearTimeout(timeout);
        this.startHealthCheck();
        resolve();
      });
    });
  }
  
  private handleMessage(line: string): void {
    try {
      const message = JSON.parse(line);
      
      switch (message.type) {
        case 'ready':
          this.isReady = true;
          this.restartAttempts = 0; // Reset on successful start
          this.emit('ready');
          break;
          
        case 'result': {
          const callback = this.commandQueue.get(message.id);
          if (callback) {
            callback(message.data);
            this.commandQueue.delete(message.id);
          }
          break;
        }
          
        case 'error':
          console.error('Coral error:', message.error);
          if (message.id) {
            const callback = this.commandQueue.get(message.id);
            if (callback) {
              callback(null);
              this.commandQueue.delete(message.id);
            }
          }
          break;
          
        case 'health':
          this.lastHealthCheck = Date.now();
          break;
      }
    } catch (e) {
      console.error('Failed to parse Coral message:', line, e);
    }
  }
  
  private handleProcessExit(): void {
    this.isReady = false;
    this.cleanup();
    
    // Clear pending commands
    for (const [_id, callback] of this.commandQueue) {
      callback(null);
    }
    this.commandQueue.clear();
    
    // Attempt restart if not manually shutdown
    if (this.restartAttempts < this.MAX_RESTART_ATTEMPTS) {
      this.restartAttempts++;
      console.log(`Attempting to restart Coral process (${this.restartAttempts}/${this.MAX_RESTART_ATTEMPTS})...`);
      
      setTimeout(() => {
        this.startProcess().catch(err => {
          console.error('Failed to restart Coral process:', err);
          this.emit('fatal-error', err);
        });
      }, 1000 * this.restartAttempts); // Exponential backoff
    } else {
      console.error('Max restart attempts reached. Coral acceleration disabled.');
      this.emit('fatal-error', new Error('Coral process failed to restart'));
    }
  }
  
  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(() => {
      const timeSinceLastCheck = Date.now() - this.lastHealthCheck;
      
      if (timeSinceLastCheck > 60000) { // 1 minute without health response
        console.warn('Coral process unresponsive, restarting...');
        this.coralProcess?.kill();
      } else {
        // Send health check ping
        this.sendCommand({ type: 'health', id: 'health-check', data: {} });
      }
    }, 30000); // Check every 30 seconds
  }
  
  private cleanup(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
  }
  
  private sendCommand(command: any): void {
    if (this.coralProcess?.stdin?.writable) {
      this.coralProcess.stdin.write(JSON.stringify(command) + '\n');
    }
  }
  
  async predictHeatMap(
    measurements: Array<{lat: number, lon: number, rssi: number}>,
    bounds: {north: number, south: number, east: number, west: number},
    resolution: number = 32
  ): Promise<CoralPrediction> {
    if (!this.isReady) {
      throw new Error('Coral accelerator not ready');
    }
    
    // Limit queue size to prevent memory issues
    if (this.commandQueue.size > 50) {
      throw new Error('Coral command queue full - system overloaded');
    }
    
    return new Promise((resolve, reject) => {
      const commandId = crypto.randomUUID();
      
      const timeoutHandle = setTimeout(() => {
        this.commandQueue.delete(commandId);
        reject(new Error('Coral prediction timeout'));
      }, 5000);
      
      this.commandQueue.set(commandId, (result) => {
        clearTimeout(timeoutHandle);
        if (result) {
          resolve(result);
        } else {
          reject(new Error('Coral prediction failed'));
        }
      });
      
      this.sendCommand({
        id: commandId,
        type: 'predict',
        data: { measurements, bounds, resolution }
      });
    });
  }
  
  async shutdown(): Promise<void> {
    this.cleanup();
    
    if (this.coralProcess) {
      // Send shutdown command
      this.sendCommand({ type: 'shutdown', id: 'shutdown', data: {} });
      
      // Give process time to cleanup
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Force kill if still running
      if (!this.coralProcess.killed) {
        this.coralProcess.kill();
      }
      
      this.coralProcess = null;
    }
    
    this.isReady = false;
    this.restartAttempts = this.MAX_RESTART_ATTEMPTS; // Prevent restart on shutdown
  }
  
  getStatus(): { ready: boolean; queueSize: number; uptime: number } {
    return {
      ready: this.isReady,
      queueSize: this.commandQueue.size,
      uptime: this.isReady ? Date.now() - this.lastHealthCheck : 0
    };
  }
}

/**
 * Factory function with better error handling
 */
export async function createCoralAccelerator(modelPath?: string): Promise<CoralAccelerator | null> {
  try {
    const accelerator = new CoralAccelerator(modelPath);
    await accelerator.initialize();
    
    // Set up error handling
    accelerator.on('fatal-error', (error) => {
      console.error('Coral TPU fatal error:', error);
      // Could emit event to UI to show TPU unavailable
    });
    
    console.log('[OK] Coral TPU accelerator initialized successfully');
    return accelerator;
  } catch (error) {
    console.warn('[WARN] Coral TPU not available, will use CPU fallback:', error);
    return null;
  }
}