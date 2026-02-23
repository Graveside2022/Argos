#!/usr/bin/env node
/**
 * System Inspector MCP Server (Enhanced for Development)
 * Provides diagnostic tools for Docker, services, memory, and system health
 */

import { config } from 'dotenv';

import { logger } from '$lib/utils/logger';

import { apiFetch } from '../shared/api-client';
import { BaseMCPServer, type ToolDefinition } from '../shared/base-server';
import {
	categorizeErrors,
	generateErrorRecommendations,
	generateMemoryRecommendations,
	verifyDevEnvironment
} from './system-inspector-tools';

// Load .env for ARGOS_API_KEY
config();

/** Analyze Docker status into recommendations. */
function analyzeDocker(docker: Record<string, unknown>, recs: string[]): void {
	if (!docker.success || !docker.docker_running) {
		recs.push(
			'Docker not running. Only needed for third-party tools (OpenWebRX, Bettercap). Start with: sudo systemctl start docker'
		);
	}
}

/** Analyze service health and return severity status. */
function analyzeServices(services: Record<string, unknown>, recs: string[]): 'DEGRADED' | null {
	if (services.overall_health !== 'degraded') return null;
	const degraded = (
		services.services as Array<{ name: string; status: string; port: number }>
	).filter((s) => s.status !== 'healthy');
	for (const svc of degraded) {
		const msg =
			svc.status === 'stopped'
				? `Service ${svc.name} not running on port ${svc.port}`
				: `Service ${svc.name} process running but port ${svc.port} not listening`;
		recs.push(msg);
	}
	return 'DEGRADED';
}

/** Analyze memory pressure and return severity status. */
function analyzeMemory(
	memory: Record<string, unknown>,
	recs: string[]
): 'CRITICAL' | 'DEGRADED' | null {
	const riskLevel = memory.risk_level as string;
	const reasons = (memory.risk_reasons as string[]) || [];
	if (riskLevel === 'CRITICAL') {
		recs.push('CRITICAL: Memory pressure high!');
		recs.push(...reasons.map((r) => `  - ${r}`));
		recs.push('Consider: Restart services, kill unused processes');
		return 'CRITICAL';
	}
	if (riskLevel === 'HIGH') {
		recs.push('HIGH memory usage detected');
		recs.push(...reasons.map((r) => `  - ${r}`));
		return 'DEGRADED';
	}
	if (riskLevel === 'MEDIUM') {
		recs.push('Moderate memory usage');
		recs.push(...reasons.map((r) => `  - ${r}`));
	}
	return null;
}

/** Analyze logs and return severity status. */
function analyzeLogs(logs: Record<string, unknown> | null, recs: string[]): 'DEGRADED' | null {
	if (!logs || (logs.total_errors as number) <= 10) return null;
	recs.push(`${logs.total_errors} errors in last ${logs.minutes} minutes`);
	recs.push('Use get_recent_errors tool for detailed error analysis');
	return 'DEGRADED';
}

/** Resolve overall status from component statuses. */
function resolveSystemStatus(statuses: Array<string | null>): string {
	if (statuses.includes('CRITICAL')) return 'CRITICAL';
	if (statuses.includes('DEGRADED')) return 'DEGRADED';
	return 'HEALTHY';
}

/** Classify heap usage severity. */
function classifyHeapStatus(heapPct: number): string {
	if (heapPct > 75) return 'CRITICAL';
	if (heapPct > 60) return 'HIGH';
	return 'NORMAL';
}

/** Summarize stopped Docker containers into recommendations. */
function analyzeStoppedContainers(
	containers: Array<{ name: string; status: string; state: string }>,
	recs: string[]
): void {
	const stopped = containers.filter((c) => c.state !== 'running');
	if (stopped.length > 0) {
		recs.push('Stopped containers detected:');
		for (const c of stopped) {
			recs.push(`  - ${c.name} (${c.status})`);
			recs.push(`    Restart: docker start ${c.name}`);
		}
	}
}

/** Summarize Docker as OK/FAILED. */
function summarizeDockerHealth(docker: Record<string, unknown>): string {
	return docker.success ? 'OK' : 'FAILED';
}

/** Count total errors from logs, defaulting to 0. */
function countErrors(logs: Record<string, unknown> | null): number {
	return logs ? (logs.total_errors as number) : 0;
}

/** Build Docker details section. */
function buildDockerDetails(docker: Record<string, unknown>) {
	return {
		running: docker.docker_running,
		containers: docker.argos_containers || 0,
		services: docker.containers || []
	};
}

/** Extract a numeric percentage from a nested record, defaulting to 0. */
function pct(obj: Record<string, unknown> | undefined, key: string): number {
	return (obj?.[key] as number) || 0;
}

/** Build memory details section. */
function buildMemoryDetails(memory: Record<string, unknown>) {
	const sys = memory.system as Record<string, unknown> | undefined;
	const node = memory.nodejs as Record<string, unknown> | undefined;
	return {
		system_usage: `${pct(sys, 'memory_percentage')}%`,
		heap_usage: `${pct(node, 'heap_percentage')}%`,
		protections: memory.protection || {}
	};
}

/** Summarize log sources. */
function summarizeLogSources(
	logs: Record<string, unknown> | null
): Array<{ source: string; count: number }> {
	if (!logs?.sources) return [];
	return (logs.sources as Array<{ source: string; entries: unknown[] }>).map((src) => ({
		source: src.source,
		count: src.entries.length
	}));
}

/** Get stopped containers from data. */
function getStoppedContainers(
	containers: Array<{ state: string }> | undefined
): Array<{ state: string }> {
	return containers?.filter((c) => c.state !== 'running') || [];
}

/** Check if no Argos tool containers are running. */
function checkNoToolContainers(argosContainers: number, recs: string[]): void {
	if (argosContainers === 0) {
		recs.push(
			'No tool containers running. Start tools with: docker compose -f docker/docker-compose.portainer-dev.yml --profile tools up -d'
		);
	}
}

/** Classify Docker health from stopped container count. */
function classifyDockerHealth(stoppedCount: number): string {
	return stoppedCount > 0 ? 'DEGRADED' : 'HEALTHY';
}

/** Classify system memory status. */
function classifySystemMemory(sys: Record<string, unknown> | undefined): string {
	return ((sys?.memory_percentage as number) || 0) > 75 ? 'HIGH' : 'NORMAL';
}

/** Fetch logs conditionally. */
async function fetchLogsIfEnabled(
	logsResp: Response | null
): Promise<Record<string, unknown> | null> {
	return logsResp ? await logsResp.json() : null;
}

class SystemInspector extends BaseMCPServer {
	protected tools: ToolDefinition[] = [
		{
			name: 'diagnose_system',
			description:
				'Run complete system health check. Returns Docker status, service health, memory pressure, recent errors, and actionable recommendations.',
			inputSchema: {
				type: 'object' as const,
				properties: {
					include_logs: {
						type: 'boolean',
						description: 'Include recent error logs (default: true)'
					}
				}
			},
			execute: async (args: Record<string, unknown>) => {
				const includeLogs = args.include_logs !== false;

				const [dockerResp, servicesResp, memoryResp, logsResp] = await Promise.all([
					apiFetch('/api/system/docker'),
					apiFetch('/api/system/services'),
					apiFetch('/api/system/memory-pressure'),
					includeLogs ? apiFetch('/api/system/logs?minutes=5') : null
				]);

				const docker = await dockerResp.json();
				const services = await servicesResp.json();
				const memory = await memoryResp.json();
				const logs = await fetchLogsIfEnabled(logsResp);

				const recs: string[] = [];
				analyzeDocker(docker, recs);
				const svcStatus = analyzeServices(services, recs);
				const memStatus = analyzeMemory(memory, recs);
				const logStatus = analyzeLogs(logs, recs);

				return {
					overall_status: resolveSystemStatus([svcStatus, memStatus, logStatus]),
					timestamp: new Date().toISOString(),
					summary: {
						docker: summarizeDockerHealth(docker),
						services: services.overall_health,
						memory: memory.risk_level,
						errors: countErrors(logs)
					},
					recommendations: recs,
					details: {
						docker: buildDockerDetails(docker),
						services: services.services || [],
						memory: buildMemoryDetails(memory),
						recent_errors: summarizeLogSources(logs)
					}
				};
			}
		},
		{
			name: 'check_docker_health',
			description:
				'Check Docker status for third-party tools (OpenWebRX, Bettercap). Argos runs natively.',
			inputSchema: { type: 'object' as const, properties: {} },
			execute: async () => {
				const resp = await apiFetch('/api/system/docker');
				const data = await resp.json();

				if (!data.success) {
					return {
						status: 'CRITICAL',
						error: data.error,
						recommendation:
							'Docker daemon not running. Start: sudo systemctl start docker'
					};
				}

				const stoppedContainers = getStoppedContainers(data.containers);
				const recommendations: string[] = [];
				analyzeStoppedContainers(data.containers || [], recommendations);
				checkNoToolContainers(data.argos_containers || 0, recommendations);

				return {
					status: classifyDockerHealth(stoppedContainers.length),
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
				'Analyze memory usage and OOM risk. Returns system memory, Node.js heap, protections.',
			inputSchema: { type: 'object' as const, properties: {} },
			execute: async () => {
				const resp = await apiFetch('/api/system/memory-pressure');
				const data = await resp.json();

				if (!data.success) {
					return { status: 'ERROR', error: data.error };
				}

				return {
					risk_level: data.risk_level,
					risk_reasons: data.risk_reasons || [],
					system: {
						...data.system,
						status: classifySystemMemory(data.system)
					},
					nodejs: {
						...data.nodejs,
						status: classifyHeapStatus(pct(data.nodejs, 'heap_percentage'))
					},
					protection: data.protection,
					recommendations: generateMemoryRecommendations(data.risk_level, data.protection)
				};
			}
		},
		{
			name: 'get_recent_errors',
			description:
				'Get recent error logs from all Argos services. Returns aggregated errors with source attribution.',
			inputSchema: {
				type: 'object' as const,
				properties: {
					minutes: {
						type: 'number',
						description: 'Time window in minutes (default: 5, max: 60)'
					},
					severity: {
						type: 'string',
						description: 'Filter: error, warn, all',
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
				if (!data.success) return { status: 'ERROR', error: data.error };

				const sources = data.sources || [];
				const categorized = categorizeErrors(sources);

				return {
					time_window_minutes: minutes,
					total_errors: data.total_errors,
					by_severity: {
						critical: categorized.critical.length,
						high: categorized.high.length,
						medium: categorized.medium.length
					},
					sources,
					categorized_errors: categorized,
					recommendations: generateErrorRecommendations(
						categorized,
						data.total_errors,
						minutes
					)
				};
			}
		},
		{
			name: 'verify_dev_environment',
			description:
				'Verify development environment setup. Checks dev server, Docker, services, hardware.',
			inputSchema: { type: 'object' as const, properties: {} },
			execute: async () => verifyDevEnvironment()
		}
	];
}

// Start server when run directly
const server = new SystemInspector('argos-system-inspector');
server.start().catch((error) => {
	logger.error('System Inspector fatal error', {
		error: error instanceof Error ? error.message : String(error)
	});
	process.exit(1);
});
