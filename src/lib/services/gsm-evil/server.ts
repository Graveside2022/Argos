import express, { type Request, type Response } from 'express';
import { WebSocketServer } from 'ws';
import { spawn, ChildProcess, execSync } from 'child_process';
import { createServer } from 'http';
import cors from 'cors';
import { EventEmitter } from 'events';

interface GSMData {
  timestamp: Date;
  frequency: number;
  channel: number;
  cell_id?: string;
  lai?: string;
  mcc?: string;
  mnc?: string;
  signal_strength?: number;
  data: string;
}

class GSMEvilServer extends EventEmitter {
  private app: express.Application;
  private server: ReturnType<typeof createServer>;
  private wss: WebSocketServer;
  private grgsm_process: ChildProcess | null = null;
  private capturedData: GSMData[] = [];
  private maxDataPoints = 1000;
  
  constructor() {
    super();
    this.app = express();
    this.setupRoutes();
    this.server = createServer(this.app);
    this.wss = new WebSocketServer({ server: this.server });
    this.setupWebSocket();
  }

  private setupRoutes() {
    this.app.use(cors());
    this.app.use(express.json());
    
    // Serve static HTML for the GSM Evil interface
    this.app.get('/', (req: Request, res: Response) => {
      res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>GSM Evil Monitor</title>
            <style>
              body {
                background-color: #1a1a1a;
                color: #ff0000;
                font-family: 'Courier New', monospace;
                margin: 0;
                padding: 20px;
              }
              #status {
                background-color: #2a0000;
                border: 1px solid #ff0000;
                padding: 10px;
                margin-bottom: 20px;
                border-radius: 5px;
              }
              #data-container {
                background-color: #0a0a0a;
                border: 1px solid #ff0000;
                padding: 10px;
                height: 400px;
                overflow-y: auto;
                font-size: 12px;
                white-space: pre-wrap;
              }
              .data-entry {
                margin-bottom: 5px;
                padding: 5px;
                border-bottom: 1px solid #330000;
              }
              .timestamp {
                color: #ff6666;
              }
              .frequency {
                color: #ffaa00;
              }
              .signal {
                color: #00ff00;
              }
              h1 {
                color: #ff0000;
                text-shadow: 0 0 10px #ff0000;
              }
              #stats {
                display: flex;
                gap: 20px;
                margin-bottom: 20px;
              }
              .stat-box {
                background-color: #2a0000;
                border: 1px solid #ff0000;
                padding: 10px;
                border-radius: 5px;
              }
            </style>
          </head>
          <body>
            <h1>[CRITICAL] GSM Evil Monitor [CRITICAL]</h1>
            <div id="status">Connecting...</div>
            <div id="stats">
              <div class="stat-box">
                <strong>Frequency:</strong> <span id="freq">--</span> MHz
              </div>
              <div class="stat-box">
                <strong>Captured:</strong> <span id="count">0</span> packets
              </div>
              <div class="stat-box">
                <strong>Active Cells:</strong> <span id="cells">0</span>
              </div>
            </div>
            <div id="data-container"></div>
            
            <script>
              const ws = new WebSocket('ws://' + window.location.host);
              const dataContainer = document.getElementById('data-container');
              const statusDiv = document.getElementById('status');
              const freqSpan = document.getElementById('freq');
              const countSpan = document.getElementById('count');
              const cellsSpan = document.getElementById('cells');
              
              let packetCount = 0;
              const activeCells = new Set();
              
              ws.onopen = () => {
                statusDiv.textContent = '[PASS] Connected to GSM Evil Server';
                statusDiv.style.color = '#00ff00';
              };
              
              ws.onmessage = (event) => {
                const data = JSON.parse(event.data);

                if (data.type === 'gsm_data') {
                  packetCount++;
                  countSpan.textContent = packetCount;

                  if (data.frequency) {
                    freqSpan.textContent = (data.frequency / 1e6).toFixed(1);
                  }

                  if (data.cell_id) {
                    activeCells.add(data.cell_id);
                    cellsSpan.textContent = activeCells.size;
                  }

                  // Create entry safely using DOM methods (prevents XSS)
                  const entry = document.createElement('div');
                  entry.className = 'data-entry';

                  // Timestamp
                  const timestampSpan = document.createElement('span');
                  timestampSpan.className = 'timestamp';
                  timestampSpan.textContent = \`[\${new Date(data.timestamp).toLocaleTimeString()}]\`;
                  entry.appendChild(timestampSpan);
                  entry.appendChild(document.createTextNode(' '));

                  // Frequency
                  const freqSpan = document.createElement('span');
                  freqSpan.className = 'frequency';
                  freqSpan.textContent = \`Freq: \${(data.frequency / 1e6).toFixed(1)} MHz\`;
                  entry.appendChild(freqSpan);
                  entry.appendChild(document.createTextNode(' '));

                  // Channel (optional)
                  if (data.channel) {
                    entry.appendChild(document.createTextNode(\`Ch: \${data.channel} \`));
                  }

                  // Cell ID (optional) - sanitized
                  if (data.cell_id) {
                    entry.appendChild(document.createTextNode(\`Cell: \${data.cell_id} \`));
                  }

                  // Signal strength (optional)
                  if (data.signal_strength) {
                    const signalSpan = document.createElement('span');
                    signalSpan.className = 'signal';
                    signalSpan.textContent = \`Signal: \${data.signal_strength} dB\`;
                    entry.appendChild(signalSpan);
                  }

                  // Line break
                  entry.appendChild(document.createElement('br'));

                  // Data content - sanitized
                  entry.appendChild(document.createTextNode(\`Data: \${data.data || ''}\`));

                  dataContainer.insertBefore(entry, dataContainer.firstChild);

                  // Keep only last 100 entries in view
                  while (dataContainer.children.length > 100) {
                    dataContainer.removeChild(dataContainer.lastChild);
                  }
                }
              };
              
              ws.onclose = () => {
                statusDiv.textContent = '[FAIL] Disconnected from server';
                statusDiv.style.color = '#ff0000';
              };
              
              ws.onerror = (error) => {
                statusDiv.textContent = '[FAIL] Connection error';
                statusDiv.style.color = '#ff0000';
              };
            </script>
          </body>
        </html>
      `);
    });
    
    // API endpoints
    this.app.get('/api/status', (req: Request, res: Response) => {
      res.json({
        running: this.grgsm_process !== null,
        dataPoints: this.capturedData.length,
        connected_clients: this.wss.clients.size
      });
    });
    
    this.app.get('/api/data', (req: Request, res: Response) => {
      res.json(this.capturedData.slice(-100)); // Last 100 data points
    });
  }

  private setupWebSocket() {
    this.wss.on('connection', (ws) => {
      // Send recent data to new client
      this.capturedData.slice(-20).forEach(data => {
        ws.send(JSON.stringify({ type: 'gsm_data', ...data }));
      });

      ws.on('close', () => {
        // Client disconnected
      });
    });
  }

  public startCapture(frequency: number = 935.2e6, sampleRate: number = 2e6, gain: number = 40) {
    if (this.grgsm_process) {
      return;
    }

    // Auto-detect device and start grgsm_livemon_headless
    let adjustedGain = gain;
    let adjustedSampleRate = sampleRate;

    // Check if USRP B205 Mini is available
    let deviceArgs: string[] = [];
    try {
      execSync('uhd_find_devices 2>/dev/null | grep -q "B205"');
      // USRP found, adjust parameters
      deviceArgs = ['--args', 'type=b200'];
      adjustedGain = Math.min(gain + 10, 60); // USRP needs higher gain
      adjustedSampleRate = 2e6; // B205 Mini works best at 2 MSPS for GSM
    } catch (_error) {
      // Using HackRF for GSM capture (default)
    }
    
    const args = [
      ...deviceArgs,
      '-f', frequency.toString(),
      '-s', adjustedSampleRate.toString(),
      '-g', adjustedGain.toString()
    ];
    
    this.grgsm_process = spawn('grgsm_livemon_headless', args);

    this.grgsm_process.stdout?.on('data', (data) => {
      const output = data.toString();
      this.parseGSMData(output, frequency);
    });

    this.grgsm_process.stderr?.on('data', (data) => {
      console.error('grgsm_livemon error:', data.toString());
    });

    this.grgsm_process.on('close', (_code) => {
      this.grgsm_process = null;
    });

    // Also monitor UDP packets if possible (future enhancement)
    // This would require setting up a UDP listener on port 4729
  }

  private parseGSMData(output: string, frequency: number) {
    // Parse the output from grgsm_livemon_headless
    // This is a simplified parser - actual format depends on gr-gsm output
    const lines = output.split('\n');
    
    lines.forEach(line => {
      if (line.trim()) {
        const gsmData: GSMData = {
          timestamp: new Date(),
          frequency: frequency,
          channel: 0,
          data: line.trim()
        };

        // Try to extract specific GSM information from the line
        // This would need to be adapted based on actual gr-gsm output format
        const cellMatch = line.match(/Cell ID: (\w+)/);
        if (cellMatch) {
          gsmData.cell_id = cellMatch[1];
        }

        const signalMatch = line.match(/Signal: ([-\d.]+)/);
        if (signalMatch) {
          gsmData.signal_strength = parseFloat(signalMatch[1]);
        }

        this.capturedData.push(gsmData);
        
        // Maintain max data points
        if (this.capturedData.length > this.maxDataPoints) {
          this.capturedData.shift();
        }

        // Broadcast to all connected WebSocket clients
        this.broadcast({ type: 'gsm_data', ...gsmData });
      }
    });
  }

  private broadcast(data: Record<string, unknown>) {
    const message = JSON.stringify(data);
    this.wss.clients.forEach(client => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(message);
      }
    });
  }

  public stopCapture() {
    if (this.grgsm_process) {
      this.grgsm_process.kill();
      this.grgsm_process = null;
    }
  }

  public start(port: number = 8080) {
    this.server.listen(port);
  }

  public stop() {
    this.stopCapture();
    this.server.close();
    this.wss.close();
  }
}

export default GSMEvilServer;