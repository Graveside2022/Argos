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
				const logs = logsResp ? await logsResp.json() : null;

				const recommendations: string[] = [];
				let overallStatus = 'HEALTHY';

				if (!docker.success || !docker.docker_running) {
					recommendations.push(
						'Docker not running. Only needed for third-party tools (OpenWebRX, Bettercap). Start with: sudo systemctl start docker'
					);
				}

				if (services.overall_health === 'degraded') {
					if (overallStatus === 'HEALTHY') overallStatus = 'DEGRADED';
					const degraded = services.services.filter(
						(s: { status: string }) => s.status !== 'healthy'
					);
					for (const svc of degraded) {
						if (svc.status === 'stopped') {
							recommendations.push(
								`Service ${svc.name} not running on port ${svc.port}`
							);
						} else if (svc.status === 'degraded') {
							recommendations.push(
								`Service ${svc.name} process running but port ${svc.port} not listening`
							);
						}
					}
				}

				if (memory.risk_level === 'CRITICAL') {
					overallStatus = 'CRITICAL';
					recommendations.push('CRITICAL: Memory pressure high!');
					recommendations.push(...memory.risk_reasons.map((r: string) => `  - ${r}`));
					recommendations.push('Consider: Restart services, kill unused processes');
				} else if (memory.risk_level === 'HIGH') {
					if (overallStatus === 'HEALTHY') overallStatus = 'DEGRADED';
					recommendations.push('HIGH memory usage detected');
					recommendations.push(...memory.risk_reasons.map((r: string) => `  - ${r}`));
				} else if (memory.risk_level === 'MEDIUM') {
					recommendations.push('Moderate memory usage');
					recommendations.push(...memory.risk_reasons.map((r: string) => `  - ${r}`));
				}

				if (logs && logs.total_errors > 10) {
					if (overallStatus === 'HEALTHY') overallStatus = 'DEGRADED';
					recommendations.push(
						`${logs.total_errors} errors in last ${logs.minutes} minutes`
					);
					recommendations.push('Use get_recent_errors tool for detailed error analysis');
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
							logs?.sources?.map((src: { source: string; entries: unknown[] }) => ({
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

				const stoppedContainers =
					data.containers?.filter((c: { state: string }) => c.state !== 'running') || [];
				const recommendations: string[] = [];

				if (stoppedContainers.length > 0) {
					recommendations.push('Stopped containers detected:');
					for (const c of stoppedContainers) {
						recommendations.push(`  - ${c.name} (${c.status})`);
						recommendations.push(`    Restart: docker start ${c.name}`);
					}
				}

				if (data.argos_containers === 0) {
					recommendations.push(
						'No tool containers running. Start tools with: docker compose -f docker/docker-compose.portainer-dev.yml --profile tools up -d'
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

				if (!data.success) {
					return { status: 'ERROR', error: data.error };
				}

				const categorized = categorizeErrors(data.sources || []);
				const recommendations = generateErrorRecommendations(
					categorized,
					data.total_errors,
					minutes
				);

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
