import { json } from '@sveltejs/kit';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

const DRONEID_DIR = '/home/ubuntu/projects/Argos/RemoteIDReceiver/Receiver';
const PID_FILE = '/home/ubuntu/projects/Argos/droneid.pid';
const LOG_FILE = '/home/ubuntu/projects/Argos/droneid.log';

export async function GET() {
	try {
		// Check if process is running by checking if the process exists
		let isRunning = false;
		
		try {
			// Check if PID file exists
			const pidData = await fs.readFile(PID_FILE, 'utf-8');
			const pid = parseInt(pidData.trim());
			
			// Check if process is still running
			await execAsync(`kill -0 ${pid}`);
			isRunning = true;
		} catch {
			// Process not running or PID file doesn't exist
			isRunning = false;
		}
		
		// Also check by process name as backup
		if (!isRunning) {
			try {
				const { stdout } = await execAsync('pgrep -f "dronesniffer/main.py" || true');
				const pids = stdout.trim();
				if (pids) {
					// Double check the process is actually the right one
					const { stdout: cmdline } = await execAsync(`ps -p ${pids.split('\n')[0]} -o args= || echo ""`);
					isRunning = cmdline.includes('dronesniffer/main.py');
				} else {
					isRunning = false;
				}
			} catch {
				isRunning = false;
			}
		}
		
		return json({ 
			running: isRunning,
			status: isRunning ? 'active' : 'inactive'
		});
	} catch (error) {
		console.error('Error checking DroneID status:', error);
		return json({ 
			running: false, 
			status: 'unknown',
			error: error instanceof Error ? error.message : 'Unknown error'
		});
	}
}

export async function POST({ request }) {
	try {
		const { action } = await request.json();
		
		if (action === 'start') {
			console.log('Starting DroneID backend...');
			
			// First check if already running
			try {
				const { stdout } = await execAsync('pgrep -f "dronesniffer/main.py" || true');
				if (stdout.trim()) {
					// Double check it's actually our process
					const pid = stdout.trim().split('\n')[0];
					try {
						const { stdout: cmdline } = await execAsync(`ps -p ${pid} -o args= 2>/dev/null || echo ""`);
						if (cmdline.includes('dronesniffer/main.py')) {
							return json({ success: true, message: 'DroneID already running' });
						}
					} catch {}
				}
			} catch {}
			
			// Find Alfa interface
			let alfaInterface = '';
			try {
				const { stdout } = await execAsync('ip link show | grep -E "wlx[a-f0-9]{12}" | cut -d: -f2 | tr -d " " | head -n1');
				alfaInterface = stdout.trim();
			} catch {}
			
			if (!alfaInterface) {
				return json({ success: false, error: 'No Alfa WiFi adapter found' }, { status: 400 });
			}
			
			// Create a simple start script that doesn't require sudo from web context
			const startScript = `#!/bin/bash
cd ${DRONEID_DIR}

# Set up Alfa in monitor mode on channel 6 (Remote ID channel)
echo "Setting ${alfaInterface} to monitor mode on channel 6..." >> ${LOG_FILE}
sudo ip link set ${alfaInterface} down 2>> ${LOG_FILE}
sudo iw dev ${alfaInterface} set type monitor 2>> ${LOG_FILE}
sudo iw dev ${alfaInterface} set channel 6 2>> ${LOG_FILE}
sudo ip link set ${alfaInterface} up 2>> ${LOG_FILE}

# Check if frontend is built
if [ ! -d "frontend/dist" ]; then
    echo "Building frontend..." >> ${LOG_FILE}
    cd frontend
    npm install >> ${LOG_FILE} 2>&1
    npm run build >> ${LOG_FILE} 2>&1
    cd ..
fi

# Start with virtual environment python (sudo preserves path)
echo "Starting DroneID backend on interface ${alfaInterface}..." >> ${LOG_FILE}
# Use the venv python directly with sudo on port 8081 to avoid conflict
sudo -E nohup ${DRONEID_DIR}/venv/bin/python3 ./backend/dronesniffer/main.py -p 8081 >> ${LOG_FILE} 2>&1 &
echo $! > ${PID_FILE}
echo "Started with PID $(cat ${PID_FILE})" >> ${LOG_FILE}
`;

			const scriptPath = '/tmp/start-droneid-temp.sh';
			await fs.writeFile(scriptPath, startScript, { mode: 0o755 });
			
			// Execute with proper environment
			await execAsync(`sudo bash ${scriptPath}`);
			
			// Clean up
			await fs.unlink(scriptPath);
			
			// Wait a moment for startup
			await new Promise(resolve => setTimeout(resolve, 3000));
			
			// Verify it started
			try {
				const { stdout: checkPid } = await execAsync(`ps -p $(cat ${PID_FILE} 2>/dev/null) 2>/dev/null || echo ""`);
				if (!checkPid.trim()) {
					// Check log for errors
					const { stdout: logTail } = await execAsync(`tail -n 10 ${LOG_FILE} 2>/dev/null || echo "No logs"`);
					return json({ 
						success: false, 
						error: 'Failed to start DroneID backend. Check logs for details.',
						logs: logTail
					}, { status: 500 });
				}
			} catch (e) {
				console.error('Error verifying startup:', e);
			}
			
			return json({ success: true, message: 'Started DroneID backend' });
			
		} else if (action === 'stop') {
			console.log('Stopping DroneID backend...');
			
			// Try multiple methods to stop the process
			let stopped = false;
			
			// Method 1: Kill by PID if available
			try {
				const pidData = await fs.readFile(PID_FILE, 'utf-8');
				const pid = parseInt(pidData.trim());
				// First try graceful shutdown
				await execAsync(`sudo kill ${pid} 2>/dev/null || true`);
				// Also kill any child python processes
				await execAsync(`sudo pkill -P ${pid} 2>/dev/null || true`);
				// Wait a moment for graceful shutdown
				await new Promise(resolve => setTimeout(resolve, 1000));
				// Force kill if still running
				await execAsync(`sudo kill -9 ${pid} 2>/dev/null || true`);
				await execAsync(`sudo pkill -9 -P ${pid} 2>/dev/null || true`);
				await fs.unlink(PID_FILE).catch(() => {});
				stopped = true;
			} catch {
				// PID method failed, continue
			}
			
			// Method 2: Use pkill with sudo (process runs as root) - be more aggressive
			if (!stopped) {
				try {
					// Kill by process name pattern
					await execAsync('sudo pkill -f "dronesniffer/main.py" 2>/dev/null || true');
					// Also try killing by python processes running main.py
					await execAsync('sudo pkill -f "python.*main.py.*8081" 2>/dev/null || true');
					// Wait for processes to die
					await new Promise(resolve => setTimeout(resolve, 2000));
					// Force kill if still there
					await execAsync('sudo pkill -9 -f "dronesniffer/main.py" 2>/dev/null || true');
					await execAsync('sudo pkill -9 -f "python.*main.py.*8081" 2>/dev/null || true');
					stopped = true;
				} catch {
					// Continue
				}
			}
			
			// Method 3: Find and kill python processes (backup method)
			if (!stopped) {
				try {
					const { stdout } = await execAsync('pgrep -f "python.*main.py" || true');
					const pids = stdout.trim().split('\n').filter(pid => pid);
					for (const pid of pids) {
						await execAsync(`sudo kill ${pid} 2>/dev/null || true`);
						await new Promise(resolve => setTimeout(resolve, 500));
						await execAsync(`sudo kill -9 ${pid} 2>/dev/null || true`);
					}
				} catch {
					// Ignore errors
				}
			}
			
			// Stop channel hopping script if running
			try {
				await execAsync('sudo pkill -f "droneid-channel-hop.sh" 2>/dev/null || true');
			} catch {
				// Ignore errors
			}
			
			// Reset Alfa card to managed mode
			try {
				const { stdout } = await execAsync('ip link show | grep -E "wlx[a-f0-9]{12}" | cut -d: -f2 | tr -d " " | head -n1');
				const alfaInterface = stdout.trim();
				if (alfaInterface) {
					await execAsync(`sudo ip link set ${alfaInterface} down 2>/dev/null || true`);
					await execAsync(`sudo iw dev ${alfaInterface} set type managed 2>/dev/null || true`);
					// Bring it back up in managed mode
					await execAsync(`sudo ip link set ${alfaInterface} up 2>/dev/null || true`);
				}
			} catch {
				// Ignore errors on cleanup
			}
			
			return json({ success: true, message: 'DroneID service stopped' });
			
		} else {
			return json({ success: false, error: 'Invalid action' }, { status: 400 });
		}
	} catch (error) {
		console.error('DroneID control error:', error);
		return json({ 
			success: false, 
			error: error instanceof Error ? error.message : 'Unknown error' 
		}, { status: 500 });
	}
}