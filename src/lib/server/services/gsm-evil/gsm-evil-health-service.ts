import Database from 'better-sqlite3';
import { execFile } from 'child_process';
import { promisify } from 'util';

import { validateNumericParam } from '$lib/server/security/input-sanitizer';

const execFileAsync = promisify(execFile);

export interface GsmEvilHealth {
	grgsm: {
		running: boolean;
		pid: number | null;
		runtime: number;
		status: string;
	};
	gsmevil: {
		running: boolean;
		pid: number | null;
		webInterface: boolean;
		port8080: boolean;
		status: string;
	};
	dataFlow: {
		gsmtapActive: boolean;
		port4729Active: boolean;
		databaseAccessible: boolean;
		recentData: boolean;
		status: string;
	};
	overall: {
		status: string;
		pipelineHealthy: boolean;
		issues: string[];
		recommendations: string[];
	};
}

export async function checkGsmEvilHealth(): Promise<GsmEvilHealth> {
	const health: GsmEvilHealth = {
		grgsm: {
			running: false,
			pid: null,
			runtime: 0,
			status: 'unknown'
		},
		gsmevil: {
			running: false,
			pid: null,
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
			issues: [],
			recommendations: []
		}
	};

	try {
		// Check GRGSM process
		try {
			const { stdout: grgsmCheck } = await execFileAsync('/usr/bin/pgrep', [
				'-af',
				'grgsm_livemon_headless'
			]);
			const grgsmLine = grgsmCheck
				.split('\n')
				.filter((line) => line.trim() && !line.includes('timeout'))
				.at(0);

			if (grgsmLine) {
				const parts = grgsmLine.trim().split(/\s+/);
				const pid = parseInt(parts[0]);
				if (!isNaN(pid)) {
					try {
						const validPid = validateNumericParam(pid, 'pid', 1, 4194304);
						const { stdout: pidTime } = await execFileAsync('/usr/bin/ps', [
							'-o',
							'etimes=',
							'-p',
							String(validPid)
						]);
						const runtime = parseInt(pidTime.trim()) || 0;

						if (runtime > 10) {
							health.grgsm.running = true;
							health.grgsm.pid = validPid;
							health.grgsm.runtime = runtime;
							health.grgsm.status = 'running';
						} else {
							health.grgsm.status = 'scan-process';
						}
					} catch (error: unknown) {
						const msg = error instanceof Error ? error.message : String(error);
						console.warn('[gsm-evil-health] PID runtime check failed', { error: msg });
					}
				}
			} else {
				health.grgsm.status = 'stopped';
			}
		} catch {
			health.grgsm.status = 'stopped';
		}

		// Check GSM Evil process and web interface
		try {
			const { stdout: gsmevilCheck } = await execFileAsync('/usr/bin/pgrep', [
				'-af',
				'GsmEvil.*\\.py'
			]);
			const gsmevilLine = gsmevilCheck
				.split('\n')
				.filter((line) => line.trim())
				.at(0);

			if (gsmevilLine) {
				const parts = gsmevilLine.trim().split(/\s+/);
				const pid = parseInt(parts[0]);
				if (!isNaN(pid)) {
					health.gsmevil.running = true;
					health.gsmevil.pid = pid;
					health.gsmevil.status = 'running';

					// Check port 8080 listener
					try {
						const { stdout: portCheck } = await execFileAsync('/usr/bin/sudo', [
							'/usr/bin/lsof',
							'-i',
							':8080'
						]);
						health.gsmevil.port8080 = portCheck
							.split('\n')
							.some((line) => line.includes('LISTEN'));
					} catch (error: unknown) {
						const msg = error instanceof Error ? error.message : String(error);
						console.warn('[gsm-evil-health] Port 8080 check failed', { error: msg });
					}

					// Check HTTP response
					if (health.gsmevil.port8080) {
						try {
							const response = await fetch('http://localhost:8080', {
								signal: AbortSignal.timeout(3000)
							});
							health.gsmevil.webInterface = response.status === 200;
						} catch (error: unknown) {
							const msg = error instanceof Error ? error.message : String(error);
							console.warn('[gsm-evil-health] HTTP check failed', { error: msg });
						}
					}
				}
			} else {
				health.gsmevil.status = 'stopped';
			}
		} catch {
			health.gsmevil.status = 'stopped';
		}

		// Check data flow components - GSMTAP port 4729
		try {
			const { stdout: ssOut } = await execFileAsync('/usr/bin/ss', ['-u', '-n']);
			const portCount = ssOut.split('\n').filter((line) => line.includes(':4729')).length;
			health.dataFlow.port4729Active = portCount > 0;
			health.dataFlow.gsmtapActive = portCount > 0;
		} catch (error: unknown) {
			const msg = error instanceof Error ? error.message : String(error);
			console.warn('[gsm-evil-health] GSMTAP port check failed', { error: msg });
		}

		// Database accessibility check
		try {
			const { resolveGsmDatabasePath } = await import('$lib/server/gsm-database-path');
			const dbPath = await resolveGsmDatabasePath();

			if (dbPath) {
				try {
					const db = new Database(dbPath, { readonly: true });
					db.close();
					health.dataFlow.databaseAccessible = true;
				} catch (error: unknown) {
					const msg = error instanceof Error ? error.message : String(error);
					console.warn('[gsm-evil-health] Database connectivity test failed', {
						error: msg
					});
				}

				if (health.dataFlow.databaseAccessible) {
					const db = new Database(dbPath, { readonly: true });
					try {
						const row = db
							.prepare(
								"SELECT COUNT(*) as count FROM imsi_data WHERE datetime(date_time) > datetime('now', '-10 minutes')"
							)
							.get() as { count: number } | undefined;
						health.dataFlow.recentData = (row?.count ?? 0) > 0;
					} catch (error: unknown) {
						const msg = error instanceof Error ? error.message : String(error);
						console.warn('[gsm-evil-health] Recent data check failed', { error: msg });
					} finally {
						db.close();
					}
				}
			}
		} catch (dbError: unknown) {
			const msg = dbError instanceof Error ? dbError.message : String(dbError);
			console.warn('[gsm-evil-health] Database health check failed', { error: msg });
			health.dataFlow.databaseAccessible = false;
		}

		// Determine data flow status
		if (health.dataFlow.gsmtapActive && health.dataFlow.databaseAccessible) {
			health.dataFlow.status = health.dataFlow.recentData ? 'active' : 'idle';
		} else {
			health.dataFlow.status = 'broken';
		}

		// Determine overall health and issues
		const issues: string[] = [];
		const recommendations: string[] = [];

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

		health.overall.pipelineHealthy =
			health.grgsm.running &&
			health.gsmevil.running &&
			health.gsmevil.webInterface &&
			health.dataFlow.gsmtapActive &&
			health.dataFlow.databaseAccessible;

		health.overall.issues = issues;
		health.overall.recommendations = recommendations;

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
}
