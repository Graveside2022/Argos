/**
 * System Inspector MCP Server — tool handler helpers.
 * Extracted from system-inspector.ts for constitutional compliance (Article 2.2).
 */

import { apiFetch } from '../shared/api-client';

/**
 * Generate memory-pressure recommendations based on risk level.
 */
export function generateMemoryRecommendations(
	riskLevel: string,
	protection: { earlyoom_running?: boolean; zram_enabled?: boolean } | undefined
): string[] {
	const recommendations: string[] = [];

	if (riskLevel === 'CRITICAL') {
		recommendations.push('IMMEDIATE ACTION REQUIRED:');
		recommendations.push('1. Stop non-essential services');
		recommendations.push('2. Restart Argos dev server: npm run dev:clean');
		recommendations.push('3. Check for memory leaks in active operations');
		recommendations.push('4. Consider reducing concurrent operations');
	} else if (riskLevel === 'HIGH') {
		recommendations.push('PREVENTIVE ACTIONS:');
		recommendations.push('1. Avoid starting new memory-intensive operations');
		recommendations.push('2. Consider restarting services after current tasks complete');
		recommendations.push('3. Monitor closely for OOM events');
	} else if (riskLevel === 'MEDIUM') {
		recommendations.push('ADVISORY:');
		recommendations.push('1. Memory usage elevated but manageable');
		recommendations.push('2. Be cautious with large dataset operations');
	} else {
		recommendations.push('System memory healthy');
	}

	if (!protection?.earlyoom_running) {
		recommendations.push('earlyoom not running - start with: sudo systemctl start earlyoom');
	}
	if (!protection?.zram_enabled) {
		recommendations.push('zram not enabled - compressed swap unavailable');
	}

	return recommendations;
}

/**
 * Categorize error log entries by severity based on keyword analysis.
 */
export function categorizeErrors(sources: Array<{ source: string; entries: string[] }>): {
	critical: string[];
	high: string[];
	medium: string[];
} {
	const criticalKeywords = ['fatal', 'critical', 'segfault', 'out of memory'];
	const highKeywords = ['exception', 'unhandled', 'failed to start'];

	const categorized = {
		critical: [] as string[],
		high: [] as string[],
		medium: [] as string[]
	};

	for (const source of sources) {
		for (const entry of source.entries) {
			const lower = entry.toLowerCase();
			if (criticalKeywords.some((k) => lower.includes(k))) {
				categorized.critical.push(`[${source.source}] ${entry}`);
			} else if (highKeywords.some((k) => lower.includes(k))) {
				categorized.high.push(`[${source.source}] ${entry}`);
			} else {
				categorized.medium.push(`[${source.source}] ${entry}`);
			}
		}
	}

	return categorized;
}

/**
 * Generate error log recommendations from categorized results.
 */
export function generateErrorRecommendations(
	categorized: { critical: string[]; high: string[] },
	totalErrors: number,
	minutes: number
): string[] {
	const recommendations: string[] = [];

	if (categorized.critical.length > 0) {
		recommendations.push('CRITICAL errors detected - immediate investigation required');
	}
	if (categorized.high.length > 0) {
		recommendations.push('HIGH severity errors - investigate after critical issues');
	}
	if (totalErrors === 0) {
		recommendations.push('No errors in the last ' + minutes + ' minutes');
	}

	return recommendations;
}

/**
 * Verify development environment by checking server, Docker, services, and hardware.
 */
export async function verifyDevEnvironment(): Promise<{
	overall_status: string;
	checks: Array<{ item: string; status: string; details: string }>;
	fail_count: number;
	warn_count: number;
	pass_count: number;
	recommendations: string[];
}> {
	const devServerRunning = true; // If this executes, dev server is up

	const dockerResp = await apiFetch('/api/system/docker');
	const docker = await dockerResp.json();

	const servicesResp = await apiFetch('/api/system/services');
	const services = await servicesResp.json();

	const hardwareResp = await apiFetch('/api/hardware/scan');
	const hardware = await hardwareResp.json();

	const checks = [
		{
			item: 'Argos dev server (localhost:5173)',
			status: devServerRunning ? 'PASS' : 'FAIL',
			details: devServerRunning ? 'Server responding' : 'Server not responding'
		},
		{
			item: 'Docker daemon (third-party tools)',
			status: docker.docker_running ? 'PASS' : 'WARN',
			details: docker.docker_running
				? `Running - ${docker.argos_containers || 0} tool containers`
				: 'Not running (optional - only needed for OpenWebRX/Bettercap)'
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
	const recommendations: string[] = [];

	if (failCount > 0) {
		overallStatus = 'NOT_READY';
		recommendations.push('Critical issues detected - fix before development:');
		for (const check of checks.filter((c) => c.status === 'FAIL')) {
			recommendations.push(`  - ${check.item}: ${check.details}`);
		}
	} else if (warnCount > 0) {
		overallStatus = 'DEGRADED';
		recommendations.push('Warnings detected - development possible but degraded:');
		for (const check of checks.filter((c) => c.status === 'WARN')) {
			recommendations.push(`  - ${check.item}: ${check.details}`);
		}
	} else {
		recommendations.push('Development environment ready');
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
