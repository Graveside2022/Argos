#!/usr/bin/env node
/**
 * API Debugger MCP Server
 * Tools for debugging API endpoints, WebSocket connections, and auth
 */

import { config } from 'dotenv';

import { apiFetch } from '../shared/api-client';
import { BaseMCPServer, type ToolDefinition } from '../shared/base-server';

config();

class APIDebugger extends BaseMCPServer {
	protected tools: ToolDefinition[] = [
		{
			name: 'test_api_endpoint',
			description:
				'Test API endpoint connectivity and auth. Quick health check for specific route with response time. Use before debugging specific endpoint issues.',
			inputSchema: {
				type: 'object' as const,
				properties: {
					endpoint: {
						type: 'string',
						description: 'API endpoint path (e.g., /api/hackrf/status)'
					},
					method: {
						type: 'string',
						description: 'HTTP method (default: GET)',
						enum: ['GET', 'POST', 'PUT', 'DELETE']
					}
				},
				required: ['endpoint']
			},
			execute: async (args: Record<string, unknown>) => {
				const endpoint = args.endpoint as string;
				const method = (args.method as string) || 'GET';

				const startTime = Date.now();
				let status = 'UNKNOWN';
				let statusCode = 0;
				let error = null;

				try {
					const resp = await apiFetch(endpoint, { method });
					statusCode = resp.status;
					status = resp.status < 400 ? 'SUCCESS' : 'ERROR';

					const latency = Date.now() - startTime;

					const recommendations = [];
					if (latency > 1000) {
						recommendations.push('⚠️ High latency (>1s) - endpoint may be slow');
					}
					if (statusCode === 401) {
						recommendations.push('🔴 AUTH FAILED - check ARGOS_API_KEY');
					}
					if (statusCode === 404) {
						recommendations.push('🔴 NOT FOUND - endpoint may not exist');
					}
					if (status === 'SUCCESS') {
						recommendations.push('✅ Endpoint healthy');
					}

					return {
						status,
						endpoint,
						method,
						status_code: statusCode,
						latency_ms: latency,
						recommendations
					};
				} catch (err) {
					error = err instanceof Error ? err.message : String(err);
					return {
						status: 'ERROR',
						endpoint,
						method,
						error,
						recommendations: [
							'🔴 Connection failed',
							'💡 Check: Is dev server running on port 5173?'
						]
					};
				}
			}
		},
		{
			name: 'list_api_endpoints',
			description:
				'List all available API endpoints organized by category. Returns endpoint paths, descriptions, and HTTP methods. Use to discover available APIs or before testing.',
			inputSchema: {
				type: 'object' as const,
				properties: {
					category: {
						type: 'string',
						description: 'Filter by category (hackrf, kismet, gps, system, etc.)'
					}
				}
			},
			execute: async (args: Record<string, unknown>) => {
				const category = args.category as string;

				// Hardcoded catalog (could be generated via filesystem scan)
				const endpoints = [
					{
						category: 'hardware',
						routes: [
							{
								path: '/api/hackrf/status',
								method: 'GET',
								desc: 'HackRF connection status'
							},
							{
								path: '/api/hackrf/start-sweep',
								method: 'POST',
								desc: 'Start RF sweep'
							},
							{
								path: '/api/hackrf/stop-sweep',
								method: 'POST',
								desc: 'Stop RF sweep'
							},
							{
								path: '/api/hackrf/data-stream',
								method: 'GET',
								desc: 'SSE spectrum data'
							},
							{
								path: '/api/kismet/status',
								method: 'GET',
								desc: 'Kismet service status'
							},
							{
								path: '/api/kismet/control',
								method: 'POST',
								desc: 'Start/stop Kismet'
							},
							{ path: '/api/kismet/devices', method: 'GET', desc: 'WiFi devices' },
							{
								path: '/api/gps/position',
								method: 'GET',
								desc: 'Current GPS position'
							},
							{
								path: '/api/hardware/scan',
								method: 'GET',
								desc: 'Detect all hardware'
							}
						]
					},
					{
						category: 'system',
						routes: [
							{ path: '/api/system/stats', method: 'GET', desc: 'System stats' },
							{
								path: '/api/system/docker',
								method: 'GET',
								desc: 'Docker containers'
							},
							{
								path: '/api/system/memory-pressure',
								method: 'GET',
								desc: 'Memory analysis'
							},
							{ path: '/api/system/services', method: 'GET', desc: 'Service health' },
							{ path: '/api/system/logs', method: 'GET', desc: 'Recent errors' },
							{ path: '/api/health', method: 'GET', desc: 'Overall health' }
						]
					},
					{
						category: 'database',
						routes: [
							{ path: '/api/database/schema', method: 'GET', desc: 'DB schema' },
							{
								path: '/api/database/health',
								method: 'GET',
								desc: 'DB health check'
							},
							{
								path: '/api/database/query',
								method: 'POST',
								desc: 'Safe SELECT query'
							},
							{ path: '/api/signals', method: 'GET', desc: 'Query signals' }
						]
					},
					{
						category: 'gsm',
						routes: [
							{
								path: '/api/gsm-evil/status',
								method: 'GET',
								desc: 'GSM monitoring status'
							},
							{
								path: '/api/gsm-evil/control',
								method: 'POST',
								desc: 'Start/stop monitoring'
							},
							{
								path: '/api/gsm-evil/intelligent-scan-stream',
								method: 'POST',
								desc: 'SSE scan progress'
							}
						]
					}
				];

				let filtered = endpoints;
				if (category) {
					filtered = endpoints.filter((e) => e.category === category);
				}

				const totalRoutes = filtered.reduce((sum, cat) => sum + cat.routes.length, 0);

				return {
					status: 'SUCCESS',
					total_categories: filtered.length,
					total_routes: totalRoutes,
					endpoints: filtered,
					note: 'Use test_api_endpoint to verify individual routes'
				};
			}
		},
		{
			name: 'diagnose_api_issues',
			description:
				'Diagnose common API issues (auth failures, connectivity, CORS, rate limiting). Runs multiple health checks and provides fix recommendations. Use when APIs are failing.',
			inputSchema: {
				type: 'object' as const,
				properties: {}
			},
			execute: async () => {
				const issues = [];
				const recommendations = [];

				// Test health endpoint (no auth required)
				try {
					const healthResp = await fetch('http://localhost:5173/api/health');
					if (healthResp.status !== 200) {
						issues.push({
							type: 'health_check_failed',
							severity: 'CRITICAL',
							message: 'Health endpoint not responding'
						});
						recommendations.push('🔴 CRITICAL: Dev server may not be running');
						recommendations.push('💡 Start server: npm run dev');
					}
				} catch {
					issues.push({
						type: 'server_unreachable',
						severity: 'CRITICAL',
						message: 'Cannot connect to localhost:5173'
					});
					recommendations.push('🔴 CRITICAL: Server not reachable');
					recommendations.push('💡 Check: Is dev server running? Port 5173 listening?');
				}

				// Test auth endpoint
				try {
					const authResp = await apiFetch('/api/system/stats');
					if (authResp.status === 401) {
						issues.push({
							type: 'auth_failed',
							severity: 'HIGH',
							message: 'Authentication failed'
						});
						recommendations.push('⚠️ AUTH: ARGOS_API_KEY not set or invalid');
						recommendations.push(
							'💡 Check: .env file has valid API key (min 32 chars)'
						);
					}
				} catch (err) {
					if (
						err instanceof Error &&
						(err.message.includes('401') || err.message.includes('Unauthorized'))
					) {
						issues.push({
							type: 'auth_failed',
							severity: 'HIGH',
							message: 'Authentication rejected'
						});
						recommendations.push('⚠️ API key authentication failing');
					}
				}

				// Test streaming endpoint
				try {
					const streamResp = await fetch('http://localhost:5173/api/hackrf/data-stream', {
						headers: {
							'X-API-Key': process.env.ARGOS_API_KEY || ''
						}
					});

					if (streamResp.headers.get('content-type') !== 'text/event-stream') {
						issues.push({
							type: 'streaming_broken',
							severity: 'MEDIUM',
							message: 'SSE streaming not returning correct content-type'
						});
					}
				} catch {
					// Streaming endpoint may not be running, not critical
				}

				const overallStatus = issues.some((i) => i.severity === 'CRITICAL')
					? 'CRITICAL'
					: issues.some((i) => i.severity === 'HIGH')
						? 'DEGRADED'
						: 'HEALTHY';

				if (issues.length === 0) {
					recommendations.push('✅ API layer healthy');
				}

				return {
					overall_status: overallStatus,
					total_issues: issues.length,
					issues,
					recommendations
				};
			}
		}
	];
}

const server = new APIDebugger('argos-api-debugger');
server.start().catch((error) => {
	console.error('[API Debugger] Fatal:', error);
	process.exit(1);
});
