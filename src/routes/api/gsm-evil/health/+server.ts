import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Comprehensive health check for GSM Evil pipeline
const performHealthCheck = async () => {
	const health = {
		grgsm: {
			running: false,
			pid: null as number | null,
			runtime: 0,
			status: 'unknown'
		},
		gsmevil: {
			running: false,
			pid: null as number | null,
			webInterface: false,
			port8080: false,
			status: 'unknown'
		},
		dataFlow: {
			gsmtapActive: false,
			port4729Active: false,
			databaseAccessible: false,
			recentData: false,
			status: 'unknown'
		},
		overall: {
			status: 'unknown',
			pipelineHealthy: false,
			issues: [] as string[],
			recommendations: [] as string[]
		}
	};

	try {
		// Check GRGSM process
		const { stdout: grgsmCheck } = await execAsync(
			'ps aux | grep -E "grgsm_livemon_headless" | grep -v grep | grep -v "timeout" | head -1'
		).catch(() => ({ stdout: '' }));
		if (grgsmCheck.trim()) {
			const parts = grgsmCheck.trim().split(/\s+/);
			const pid = parseInt(parts[1]);
			if (!isNaN(pid)) {
				// Check runtime to distinguish from scans
				const { stdout: pidTime } = await execAsync(
					`ps -o etimes= -p ${pid} 2>/dev/null || echo 0`
				).catch(() => ({ stdout: '0' }));
				const runtime = parseInt(pidTime.trim()) || 0;

				if (runtime > 10) {
					health.grgsm.running = true;
					health.grgsm.pid = pid;
					health.grgsm.runtime = runtime;
					health.grgsm.status = 'running';
				} else {
					health.grgsm.status = 'scan-process';
				}
			}
		} else {
			health.grgsm.status = 'stopped';
		}

		// Check GSM Evil process and web interface
		const { stdout: gsmevilCheck } = await execAsync(
			'ps aux | grep -E "python3? GsmEvil[_a-zA-Z0-9]*\\.py" | grep -v grep | head -1'
		).catch(() => ({ stdout: '' }));
		if (gsmevilCheck.trim()) {
			const parts = gsmevilCheck.trim().split(/\s+/);
			const pid = parseInt(parts[1]);
			if (!isNaN(pid)) {
				health.gsmevil.running = true;
				health.gsmevil.pid = pid;
				health.gsmevil.status = 'running';

				// Check port 8080 listener
				const { stdout: portCheck } = await execAsync('lsof -i :8080 | grep LISTEN').catch(
					() => ({ stdout: '' })
				);
				health.gsmevil.port8080 = portCheck.trim().length > 0;

				// Check HTTP response
				if (health.gsmevil.port8080) {
					const { stdout: httpCheck } = await execAsync(
						'timeout 3 curl -s -o /dev/null -w "%{http_code}" http://localhost:8080 2>/dev/null || echo "000"'
					).catch(() => ({ stdout: '000' }));
					health.gsmevil.webInterface = httpCheck.trim() === '200';
				}
			}
		} else {
			health.gsmevil.status = 'stopped';
		}

		// Check data flow components
		// GSMTAP port 4729
		const { stdout: gsmtapPort } = await execAsync(
			'ss -u -n | grep -c ":4729" || echo "0"'
		).catch(() => ({ stdout: '0' }));
		health.dataFlow.port4729Active = parseInt(gsmtapPort.trim()) > 0;
		health.dataFlow.gsmtapActive = health.dataFlow.port4729Active;

		// Database accessibility check
		try {
			const { resolveGsmDatabasePath } = await import('$lib/server/gsm-database-path');
			const dbPath = await resolveGsmDatabasePath();

			if (dbPath) {
				// Quick database connectivity test
				const { stdout: dbCheck } = await execAsync(
					`python3 -c "import sqlite3; conn = sqlite3.connect('${dbPath}'); conn.close(); print('ok')" 2>/dev/null || echo "error"`
				).catch(() => ({ stdout: 'error' }));
				health.dataFlow.databaseAccessible = dbCheck.trim() === 'ok';

				// Check for recent data (last 10 minutes)
				if (health.dataFlow.databaseAccessible) {
					const { stdout: recentData } = await execAsync(
						`python3 -c "import sqlite3; from datetime import datetime, timedelta; conn = sqlite3.connect('${dbPath}'); cursor = conn.cursor(); cursor.execute('SELECT COUNT(*) FROM imsi_data WHERE datetime(date_time) > datetime(\\'now\\', \\'-10 minutes\\')'); print(cursor.fetchone()[0]); conn.close()" 2>/dev/null || echo "0"`
					).catch(() => ({ stdout: '0' }));
					health.dataFlow.recentData = parseInt(recentData.trim()) > 0;
				}
			}
		} catch (dbError) {
			console.warn('Database health check failed:', dbError);
			health.dataFlow.databaseAccessible = false;
		}

		// Determine data flow status
		if (health.dataFlow.gsmtapActive && health.dataFlow.databaseAccessible) {
			health.dataFlow.status = health.dataFlow.recentData ? 'active' : 'idle';
		} else {
			health.dataFlow.status = 'broken';
		}

		// Determine overall health and issues
		const issues = [];
		const recommendations = [];

		if (!health.grgsm.running) {
			issues.push('GRGSM monitor not running');
			recommendations.push('Start GRGSM process to capture RF signals');
		}

		if (!health.gsmevil.running) {
			issues.push('GSM Evil service not running');
			recommendations.push('Start GSM Evil web service');
		} else if (!health.gsmevil.webInterface) {
			issues.push('GSM Evil web interface not responding');
			recommendations.push('Check GSM Evil service configuration');
		}

		if (!health.dataFlow.gsmtapActive) {
			issues.push('GSMTAP data flow inactive');
			recommendations.push('Verify GRGSM is sending data to port 4729');
		}

		if (!health.dataFlow.databaseAccessible) {
			issues.push('Database not accessible');
			recommendations.push('Check database path and permissions');
		}

		// Overall pipeline health
		health.overall.pipelineHealthy =
			health.grgsm.running &&
			health.gsmevil.running &&
			health.gsmevil.webInterface &&
			health.dataFlow.gsmtapActive &&
			health.dataFlow.databaseAccessible;

		health.overall.issues = issues;
		health.overall.recommendations = recommendations;

		// Overall status determination
		if (health.overall.pipelineHealthy) {
			health.overall.status = health.dataFlow.recentData ? 'healthy' : 'healthy-idle';
		} else if (health.grgsm.running || health.gsmevil.running) {
			health.overall.status = 'partial';
		} else {
			health.overall.status = 'stopped';
		}
	} catch (error) {
		console.error('Health check error:', error);
		health.overall.status = 'error';
		health.overall.issues.push('Health check failed');
	}

	return health;
};

export const GET: RequestHandler = async () => {
	try {
		const health = await performHealthCheck();

		return json({
			timestamp: new Date().toISOString(),
			health,
			summary: {
				status: health.overall.status,
				pipelineHealthy: health.overall.pipelineHealthy,
				componentsRunning: {
					grgsm: health.grgsm.running,
					gsmevil: health.gsmevil.running,
					webInterface: health.gsmevil.webInterface,
					dataFlow:
						health.dataFlow.status === 'active' || health.dataFlow.status === 'idle'
				},
				issueCount: health.overall.issues.length,
				uptime: {
					grgsm: health.grgsm.runtime,
					gsmevil: health.gsmevil.pid ? 'running' : 'stopped'
				}
			}
		});
	} catch (error: unknown) {
		console.error('Health check endpoint error:', error);
		return json(
			{
				timestamp: new Date().toISOString(),
				health: null,
				error: 'Health check failed',
				message: (error as Error).message
			},
			{ status: 500 }
		);
	}
};
