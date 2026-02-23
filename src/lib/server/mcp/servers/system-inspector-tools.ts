/**
 * System Inspector MCP Server — tool handler helpers.
 * Extracted from system-inspector.ts for constitutional compliance (Article 2.2).
 */

import { apiFetch } from '../shared/api-client';

/**
 * Generate memory-pressure recommendations based on risk level.
 */
/** Memory risk level messages. */
const MEMORY_RISK_MESSAGES: Record<string, string[]> = {
	CRITICAL: [
		'IMMEDIATE ACTION REQUIRED:',
		'1. Stop non-essential services',
		'2. Restart Argos dev server: npm run dev:clean',
		'3. Check for memory leaks in active operations',
		'4. Consider reducing concurrent operations'
	],
	HIGH: [
		'PREVENTIVE ACTIONS:',
		'1. Avoid starting new memory-intensive operations',
		'2. Consider restarting services after current tasks complete',
		'3. Monitor closely for OOM events'
	],
	MEDIUM: [
		'ADVISORY:',
		'1. Memory usage elevated but manageable',
		'2. Be cautious with large dataset operations'
	]
};

/** Check memory protection services and return any warnings. */
function checkProtectionWarnings(
	protection: { earlyoom_running?: boolean; zram_enabled?: boolean } | undefined
): string[] {
	const warnings: string[] = [];
	if (!protection?.earlyoom_running)
		warnings.push('earlyoom not running - start with: sudo systemctl start earlyoom');
	if (!protection?.zram_enabled) warnings.push('zram not enabled - compressed swap unavailable');
	return warnings;
}

export function generateMemoryRecommendations(
	riskLevel: string,
	protection: { earlyoom_running?: boolean; zram_enabled?: boolean } | undefined
): string[] {
	const riskMessages = MEMORY_RISK_MESSAGES[riskLevel] ?? ['System memory healthy'];
	return [...riskMessages, ...checkProtectionWarnings(protection)];
}

/**
 * Categorize error log entries by severity based on keyword analysis.
 */
const CRITICAL_KEYWORDS = ['fatal', 'critical', 'segfault', 'out of memory'];
const HIGH_KEYWORDS = ['exception', 'unhandled', 'failed to start'];

/** Classify a single log entry by severity. */
function classifySeverity(entry: string): 'critical' | 'high' | 'medium' {
	const lower = entry.toLowerCase();
	if (CRITICAL_KEYWORDS.some((k) => lower.includes(k))) return 'critical';
	if (HIGH_KEYWORDS.some((k) => lower.includes(k))) return 'high';
	return 'medium';
}

export function categorizeErrors(sources: Array<{ source: string; entries: string[] }>): {
	critical: string[];
	high: string[];
	medium: string[];
} {
	const categorized = { critical: [] as string[], high: [] as string[], medium: [] as string[] };
	for (const source of sources) {
		for (const entry of source.entries) {
			categorized[classifySeverity(entry)].push(`[${source.source}] ${entry}`);
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

interface EnvCheck {
	item: string;
	status: string;
	details: string;
}

/** Fetch all environment data from API. */
async function fetchEnvData() {
	const [dockerResp, servicesResp, hardwareResp] = await Promise.all([
		apiFetch('/api/system/docker'),
		apiFetch('/api/system/services'),
		apiFetch('/api/hardware/scan')
	]);
	return {
		docker: await dockerResp.json(),
		services: await servicesResp.json(),
		hardware: await hardwareResp.json()
	};
}

/** Check Docker daemon status. */
function checkDocker(docker: Record<string, unknown>): EnvCheck {
	if (!docker.docker_running)
		return {
			item: 'Docker daemon (third-party tools)',
			status: 'WARN',
			details: 'Not running (optional - only needed for OpenWebRX/Bettercap)'
		};
	return {
		item: 'Docker daemon (third-party tools)',
		status: 'PASS',
		details: `Running - ${docker.argos_containers || 0} tool containers`
	};
}

/** Check core services health. */
function checkServices(services: Record<string, unknown>): EnvCheck {
	return {
		item: 'Core services',
		status: services.overall_health === 'healthy' ? 'PASS' : 'WARN',
		details: `${services.healthy_count}/${services.total_count} healthy`
	};
}

/** Check hardware detection status. */
function checkHardware(hardware: Record<string, unknown>): EnvCheck {
	if (!hardware.success)
		return {
			item: 'Hardware detection',
			status: 'FAIL',
			details: (hardware.error as string) || 'Scan failed'
		};
	return {
		item: 'Hardware detection',
		status: 'PASS',
		details: `${Object.keys((hardware.hardware as object) || {}).length} categories detected`
	};
}

/** Build environment check list from fetched data. */
function buildEnvChecks(data: {
	docker: Record<string, unknown>;
	services: Record<string, unknown>;
	hardware: Record<string, unknown>;
}): EnvCheck[] {
	return [
		{ item: 'Argos dev server (localhost:5173)', status: 'PASS', details: 'Server responding' },
		checkDocker(data.docker),
		checkServices(data.services),
		checkHardware(data.hardware)
	];
}

/** Determine overall status and recommendations from checks. */
function evaluateEnvChecks(checks: EnvCheck[]): {
	overallStatus: string;
	recommendations: string[];
} {
	const failed = checks.filter((c) => c.status === 'FAIL');
	const warned = checks.filter((c) => c.status === 'WARN');
	if (failed.length > 0) {
		return {
			overallStatus: 'NOT_READY',
			recommendations: [
				'Critical issues detected - fix before development:',
				...failed.map((c) => `  - ${c.item}: ${c.details}`)
			]
		};
	}
	if (warned.length > 0) {
		return {
			overallStatus: 'DEGRADED',
			recommendations: [
				'Warnings detected - development possible but degraded:',
				...warned.map((c) => `  - ${c.item}: ${c.details}`)
			]
		};
	}
	return { overallStatus: 'READY', recommendations: ['Development environment ready'] };
}

export async function verifyDevEnvironment() {
	const data = await fetchEnvData();
	const checks = buildEnvChecks(data);
	const { overallStatus, recommendations } = evaluateEnvChecks(checks);
	return {
		overall_status: overallStatus,
		checks,
		fail_count: checks.filter((c) => c.status === 'FAIL').length,
		warn_count: checks.filter((c) => c.status === 'WARN').length,
		pass_count: checks.filter((c) => c.status === 'PASS').length,
		recommendations
	};
}
