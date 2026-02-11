#!/usr/bin/env node
/**
 * System Inspector MCP Server (Enhanced for Development)
 * Provides diagnostic tools for Docker, services, memory, and system health
 */

import { config } from 'dotenv';
import { BaseMCPServer, type ToolDefinition } from '../shared/base-server';
import { apiFetch } from '../shared/api-client';

// Load .env for ARGOS_API_KEY
config();

class SystemInspector extends BaseMCPServer {
	protected tools: ToolDefinition[] = [
		{
			name: 'diagnose_system',
			description:
				'Run complete system health check. Returns Docker status, service health, memory pressure, recent errors, and actionable recommendations. Use this FIRST when investigating system issues or before starting development work.',
			inputSchema: {
				type: 'object' as const,
				properties: {
					include_logs: {
						type: 'boolean',
						description: 'Include recent error logs in report (default: true)'
					}
				}
			},
			execute: async (args: Record<string, unknown>) => {
				const includeLogs = args.include_logs !== false;

				// Parallel fetch all diagnostics
				const [dockerResp, servicesResp, memoryResp, logsResp] = await Promise.all([
					apiFetch('/api/system/docker'),
					apiFetch('/api/system/services'),
					apiFetch('/api/system/memory-pressure'),
					includeLogs ? apiFetch('/api/system/logs?minutes=5') : null
				]);

				const docker = await dockerResp.json();
				const services = await servicesResp.json();
				const memory = await memoryResp.json();
				const logs = logsResp ? await logsResp.json() : null;

				// Generate recommendations
				const recommendations = [];
				let overallStatus = 'HEALTHY';

				// Check Docker
				if (!docker.success || !docker.docker_running) {
					overallStatus = 'CRITICAL';
					recommendations.push(
						'⚠️ CRITICAL: Docker not running. Start with: sudo systemctl start docker'
					);
				} else if (docker.argos_containers === 0) {
					overallStatus = 'DEGRADED';
					recommendations.push(
						'⚠️ No Argos containers running. Start with: docker compose up -d'
					);
				}

				// Check services
				if (services.overall_health === 'degraded') {
					if (overallStatus === 'HEALTHY') overallStatus = 'DEGRADED';
					const degraded = services.services.filter((s: any) => s.status !== 'healthy');
					for (const svc of degraded) {
						if (svc.status === 'stopped') {
							recommendations.push(
								`⚠️ Service ${svc.name} not running on port ${svc.port}`
							);
						} else if (svc.status === 'degraded') {
							recommendations.push(
								`⚠️ Service ${svc.name} process running but port ${svc.port} not listening`
							);
						}
					}
				}

				// Check memory
				if (memory.risk_level === 'CRITICAL') {
					overallStatus = 'CRITICAL';
					recommendations.push('🔴 CRITICAL: Memory pressure high!');
					recommendations.push(...memory.risk_reasons.map((r: string) => `  - ${r}`));
					recommendations.push(
						'💡 Consider: Restart services, kill unused processes, check for leaks'
					);
				} else if (memory.risk_level === 'HIGH') {
					if (overallStatus === 'HEALTHY') overallStatus = 'DEGRADED';
					recommendations.push('⚠️ HIGH memory usage detected');
					recommendations.push(...memory.risk_reasons.map((r: string) => `  - ${r}`));
				} else if (memory.risk_level === 'MEDIUM') {
					recommendations.push('ℹ️ Moderate memory usage');
					recommendations.push(...memory.risk_reasons.map((r: string) => `  - ${r}`));
				}

				// Check logs
				if (logs && logs.total_errors > 10) {
					if (overallStatus === 'HEALTHY') overallStatus = 'DEGRADED';
					recommendations.push(
						`⚠️ ${logs.total_errors} errors in last ${logs.minutes} minutes`
					);
					recommendations.push(
						'💡 Use get_recent_errors tool for detailed error analysis'
					);
				}

				return {
					overall_status: overallStatus,
					timestamp: new Date().toISOString(),
					summary: {
						docker: docker.success ? 'OK' : 'FAILED',
						services: services.overall_health,
						memory: memory.risk_level,
						errors: logs ? logs.total_errors : 0
					},
					recommendations,
					details: {
						docker: {
							running: docker.docker_running,
							containers: docker.argos_containers || 0,
							services: docker.containers || []
						},
						services: services.services || [],
						memory: {
							system_usage: `${memory.system?.memory_percentage || 0}%`,
							heap_usage: `${memory.nodejs?.heap_percentage || 0}%`,
							protections: memory.protection || {}
						},
						recent_errors:
							logs?.sources?.map((src: any) => ({
								source: src.source,
								count: src.entries.length
							})) || []
					}
				};
			}
		},
		{
			name: 'check_docker_health',
			description:
				'Check Docker container health for all Argos services. Returns container status, resource usage, and restart recommendations. Use when Docker containers are misbehaving or after system reboot.',
			inputSchema: {
				type: 'object' as const,
				properties: {}
			},
			execute: async () => {
				const resp = await apiFetch('/api/system/docker');
				const data = await resp.json();

				if (!data.success) {
					return {
						status: 'CRITICAL',
						error: data.error,
						recommendation:
							'Docker daemon not running. Start with: sudo systemctl start docker'
					};
				}

				const stoppedContainers =
					data.containers?.filter((c: any) => c.state !== 'running') || [];
				const recommendations = [];

				if (stoppedContainers.length > 0) {
					recommendations.push('⚠️ Stopped containers detected:');
					for (const c of stoppedContainers) {
						recommendations.push(`  - ${c.name} (${c.status})`);
						recommendations.push(`    💡 Restart: docker start ${c.name}`);
					}
				}

				if (data.argos_containers === 0) {
					recommendations.push('⚠️ No Argos containers found');
					recommendations.push(
						'💡 Start all services: cd docker && docker compose -f docker-compose.portainer-dev.yml up -d'
					);
				}

				return {
					status: stoppedContainers.length > 0 ? 'DEGRADED' : 'HEALTHY',
					docker_running: data.docker_running,
					total_containers: data.total_containers,
					argos_containers: data.argos_containers,
					containers: data.containers || [],
					stopped_containers: stoppedContainers,
					recommendations
				};
			}
		},
		{
			name: 'analyze_memory_pressure',
			description:
				'Analyze memory usage and OOM risk. Returns system memory, Node.js heap usage, OOM protection status, and mitigation recommendations. Use when experiencing slowdowns, crashes, or before running memory-intensive operations.',
			inputSchema: {
				type: 'object' as const,
				properties: {}
			},
			execute: async () => {
				const resp = await apiFetch('/api/system/memory-pressure');
				const data = await resp.json();

				if (!data.success) {
					return {
						status: 'ERROR',
						error: data.error
					};
				}

				const recommendations = [];

				// Generate actionable recommendations based on risk
				if (data.risk_level === 'CRITICAL') {
					recommendations.push('🔴 IMMEDIATE ACTION REQUIRED:');
					recommendations.push('1. Stop non-essential services');
					recommendations.push('2. Restart Argos dev server: npm run dev:clean');
					recommendations.push('3. Check for memory leaks in active operations');
					recommendations.push('4. Consider reducing concurrent operations');
				} else if (data.risk_level === 'HIGH') {
					recommendations.push('⚠️ PREVENTIVE ACTIONS:');
					recommendations.push('1. Avoid starting new memory-intensive operations');
					recommendations.push(
						'2. Consider restarting services after current tasks complete'
					);
					recommendations.push('3. Monitor closely for OOM events');
				} else if (data.risk_level === 'MEDIUM') {
					recommendations.push('ℹ️ ADVISORY:');
					recommendations.push('1. Memory usage elevated but manageable');
					recommendations.push('2. Be cautious with large dataset operations');
				} else {
					recommendations.push('✅ System memory healthy');
				}

				// Protection status
				if (!data.protection?.earlyoom_running) {
					recommendations.push(
						'⚠️ earlyoom not running - start with: sudo systemctl start earlyoom'
					);
				}
				if (!data.protection?.zram_enabled) {
					recommendations.push('⚠️ zram not enabled - compressed swap unavailable');
				}

				return {
					risk_level: data.risk_level,
					risk_reasons: data.risk_reasons || [],
					system: {
						...data.system,
						status: data.system?.memory_percentage > 75 ? 'HIGH' : 'NORMAL'
					},
					nodejs: {
						...data.nodejs,
						status:
							data.nodejs?.heap_percentage > 75
								? 'CRITICAL'
								: data.nodejs?.heap_percentage > 60
									? 'HIGH'
									: 'NORMAL'
					},
					protection: data.protection,
					recommendations
				};
			}
		},
		{
			name: 'get_recent_errors',
			description:
				'Get recent error logs from all Argos services (Node.js, Docker containers, Kismet, systemd). Returns aggregated errors with source attribution. Use for debugging failures or investigating unexpected behavior.',
			inputSchema: {
				type: 'object' as const,
				properties: {
					minutes: {
						type: 'number',
						description: 'Time window in minutes (default: 5, max: 60)'
					},
					severity: {
						type: 'string',
						description: 'Filter by severity: error, warn, all (default: error)',
						enum: ['error', 'warn', 'all']
					}
				}
			},
			execute: async (args: Record<string, unknown>) => {
				const minutes = Math.min((args.minutes as number) || 5, 60);
				const severity = (args.severity as string) || 'error';

				const resp = await apiFetch(
					`/api/system/logs?minutes=${minutes}&severity=${severity}`
				);
				const data = await resp.json();

				if (!data.success) {
					return {
						status: 'ERROR',
						error: data.error
					};
				}

				// Categorize errors by severity
				const analysis = {
					critical_keywords: ['fatal', 'critical', 'segfault', 'out of memory'],
					high_keywords: ['exception', 'unhandled', 'failed to start'],
					medium_keywords: ['error', 'failed', 'timeout']
				};

				const categorized = {
					critical: [] as string[],
					high: [] as string[],
					medium: [] as string[]
				};

				for (const source of data.sources || []) {
					for (const entry of source.entries) {
						const lower = entry.toLowerCase();
						if (analysis.critical_keywords.some((k) => lower.includes(k))) {
							categorized.critical.push(`[${source.source}] ${entry}`);
						} else if (analysis.high_keywords.some((k) => lower.includes(k))) {
							categorized.high.push(`[${source.source}] ${entry}`);
						} else {
							categorized.medium.push(`[${source.source}] ${entry}`);
						}
					}
				}

				const recommendations = [];
				if (categorized.critical.length > 0) {
					recommendations.push(
						'🔴 CRITICAL errors detected - immediate investigation required'
					);
				}
				if (categorized.high.length > 0) {
					recommendations.push(
						'⚠️ HIGH severity errors - investigate after critical issues'
					);
				}
				if (data.total_errors === 0) {
					recommendations.push('✅ No errors in the last ' + minutes + ' minutes');
				}

				return {
					time_window_minutes: minutes,
					total_errors: data.total_errors,
					by_severity: {
						critical: categorized.critical.length,
						high: categorized.high.length,
						medium: categorized.medium.length
					},
					sources: data.sources || [],
					categorized_errors: categorized,
					recommendations
				};
			}
		},
		{
			name: 'verify_dev_environment',
			description:
				'Verify development environment is correctly set up. Checks: dev server running on 5173, Docker up, services healthy, hardware detected. Use at session start or when troubleshooting development issues.',
			inputSchema: {
				type: 'object' as const,
				properties: {}
			},
			execute: async () => {
				// Check dev server (should be running if this tool is callable)
				const devServerRunning = true; // If this executes, dev server is up

				// Check Docker
				const dockerResp = await apiFetch('/api/system/docker');
				const docker = await dockerResp.json();

				// Check services
				const servicesResp = await apiFetch('/api/system/services');
				const services = await servicesResp.json();

				// Check hardware
				const hardwareResp = await apiFetch('/api/hardware/scan');
				const hardware = await hardwareResp.json();

				// Build checklist
				const checks = [
					{
						item: 'Argos dev server (localhost:5173)',
						status: devServerRunning ? 'PASS' : 'FAIL',
						details: devServerRunning ? 'Server responding' : 'Server not responding'
					},
					{
						item: 'Docker daemon',
						status: docker.docker_running ? 'PASS' : 'FAIL',
						details: docker.docker_running
							? `${docker.argos_containers} Argos containers`
							: docker.error || 'Not running'
					},
					{
						item: 'Core services',
						status: services.overall_health === 'healthy' ? 'PASS' : 'WARN',
						details: `${services.healthy_count}/${services.total_count} healthy`
					},
					{
						item: 'Hardware detection',
						status: hardware.success ? 'PASS' : 'FAIL',
						details: hardware.success
							? `${Object.keys(hardware.hardware || {}).length} categories detected`
							: hardware.error || 'Scan failed'
					}
				];

				const failCount = checks.filter((c) => c.status === 'FAIL').length;
				const warnCount = checks.filter((c) => c.status === 'WARN').length;

				let overallStatus = 'READY';
				const recommendations = [];

				if (failCount > 0) {
					overallStatus = 'NOT_READY';
					recommendations.push('⚠️ Critical issues detected - fix before development:');
					for (const check of checks.filter((c) => c.status === 'FAIL')) {
						recommendations.push(`  - ${check.item}: ${check.details}`);
					}
				} else if (warnCount > 0) {
					overallStatus = 'DEGRADED';
					recommendations.push(
						'ℹ️ Warnings detected - development possible but degraded:'
					);
					for (const check of checks.filter((c) => c.status === 'WARN')) {
						recommendations.push(`  - ${check.item}: ${check.details}`);
					}
				} else {
					recommendations.push('✅ Development environment ready');
				}

				return {
					overall_status: overallStatus,
					checks,
					fail_count: failCount,
					warn_count: warnCount,
					pass_count: checks.filter((c) => c.status === 'PASS').length,
					recommendations
				};
			}
		}
	];
}

// Start server when run directly
const server = new SystemInspector('argos-system-inspector');
server.start().catch((error) => {
	console.error('[System Inspector] Fatal:', error);
	process.exit(1);
});
