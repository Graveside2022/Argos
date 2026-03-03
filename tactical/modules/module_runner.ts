#!/usr/bin/env npx tsx
/**
 * Tactical Module Runner — TypeScript orchestrator for Python modules.
 *
 * Runs any Python module from tactical/modules/, captures JSON output,
 * logs execution to the module_runs table, and emits the result.
 *
 * Usage:
 *   npx tsx tactical/modules/module_runner.ts <module> [args...]
 *
 * Examples:
 *   npx tsx tactical/modules/module_runner.ts wifi_recon --min-signal -60
 *   npx tsx tactical/modules/module_runner.ts port_scanner --target 192.168.1.1
 *   npx tsx tactical/modules/module_runner.ts ssh_bruter --host 10.0.0.1 --port 22
 *
 * The runner:
 *   1. Resolves the Python module path (tactical/modules/<name>.py)
 *   2. Spawns python3 with the module and forwarded args
 *   3. Captures stdout (JSON) and stderr (logs)
 *   4. Parses and validates the JSON output
 *   5. Logs the execution to module_runs table in rf_signals.db
 *   6. Prints the module's JSON output to stdout
 *
 * Exit codes mirror the module: 0 for success, 1 for error.
 */

import Database from 'better-sqlite3';
import { spawn } from 'child_process';
import { existsSync, readdirSync } from 'fs';
import { join, resolve } from 'path';

// ── Constants ────────────────────────────────────────────────────────

const MODULES_DIR = resolve(import.meta.dirname ?? __dirname, '.');
const PROJECT_ROOT = resolve(MODULES_DIR, '../..');
const DEFAULT_DB_PATH = join(PROJECT_ROOT, 'rf_signals.db');
const DEFAULT_TIMEOUT_MS = 120_000; // 2 minutes
const MAX_OUTPUT_BYTES = 10_000_000; // 10MB stdout cap
const PYTHON = 'python3';

// ── Types ────────────────────────────────────────────────────────────

interface ModuleResult {
	status: 'success' | 'error';
	module: string;
	timestamp: string;
	[key: string]: unknown;
}

interface RunOutcome {
	exitCode: number;
	stdout: string;
	stderr: string;
	durationMs: number;
	parsed: ModuleResult | null;
}

// ── Module resolution ────────────────────────────────────────────────

function resolveModule(name: string): string {
	// Strip .py extension if provided
	const baseName = name.replace(/\.py$/, '');

	// Only allow alphanumeric + underscores (prevent path traversal)
	if (!/^[a-z0-9_]+$/.test(baseName)) {
		fatal(`Invalid module name: "${name}". Use only lowercase letters, digits, underscores.`);
	}

	const modulePath = join(MODULES_DIR, `${baseName}.py`);
	if (!existsSync(modulePath)) {
		fatal(`Module not found: ${modulePath}`);
	}

	return modulePath;
}

// ── Module execution ─────────────────────────────────────────────────

function runModule(modulePath: string, args: string[], timeoutMs: number): Promise<RunOutcome> {
	return new Promise((resolvePromise) => {
		const start = performance.now();
		const stdoutChunks: Buffer[] = [];
		const stderrChunks: Buffer[] = [];
		let stdoutBytes = 0;
		let killed = false;

		const child = spawn(PYTHON, [modulePath, ...args], {
			stdio: ['ignore', 'pipe', 'pipe'],
			env: { ...process.env },
			cwd: PROJECT_ROOT
		});

		const timer = setTimeout(() => {
			killed = true;
			child.kill('SIGTERM');
			// Force kill after 5s if SIGTERM doesn't work
			setTimeout(() => child.kill('SIGKILL'), 5000);
		}, timeoutMs);

		child.stdout.on('data', (chunk: Buffer) => {
			stdoutBytes += chunk.length;
			if (stdoutBytes <= MAX_OUTPUT_BYTES) {
				stdoutChunks.push(chunk);
			}
		});

		child.stderr.on('data', (chunk: Buffer) => {
			stderrChunks.push(chunk);
			// Stream stderr to our stderr in real time
			process.stderr.write(chunk);
		});

		child.on('close', (code) => {
			clearTimeout(timer);
			const durationMs = Math.round(performance.now() - start);
			const stdout = Buffer.concat(stdoutChunks).toString('utf-8').trim();
			const stderr = Buffer.concat(stderrChunks).toString('utf-8').trim();

			if (killed) {
				resolvePromise({
					exitCode: 1,
					stdout: '',
					stderr: `Module timed out after ${timeoutMs}ms\n${stderr}`,
					durationMs,
					parsed: null
				});
				return;
			}

			// Parse JSON from stdout
			let parsed: ModuleResult | null = null;
			if (stdout) {
				try {
					parsed = JSON.parse(stdout) as ModuleResult;
				} catch {
					log(`Warning: Module output is not valid JSON`);
				}
			}

			resolvePromise({
				exitCode: code ?? 1,
				stdout,
				stderr,
				durationMs,
				parsed
			});
		});

		child.on('error', (err) => {
			clearTimeout(timer);
			const durationMs = Math.round(performance.now() - start);
			resolvePromise({
				exitCode: 1,
				stdout: '',
				stderr: `Failed to spawn: ${err.message}`,
				durationMs,
				parsed: null
			});
		});
	});
}

// ── DB logging ───────────────────────────────────────────────────────

function openDbIfReady(dbPath: string): Database.Database | null {
	if (!existsSync(dbPath)) {
		log(`DB not found at ${dbPath}, skipping log`);
		return null;
	}

	const db = new Database(dbPath);
	db.pragma('journal_mode = WAL');

	const tableCheck = db
		.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='module_runs'`)
		.get();

	if (!tableCheck) {
		log('module_runs table does not exist, skipping DB log');
		db.close();
		return null;
	}

	return db;
}

function logRunToDb(
	dbPath: string,
	moduleName: string,
	args: string[],
	outcome: RunOutcome,
	engagementId?: number
): number | null {
	try {
		const db = openDbIfReady(dbPath);
		if (!db) return null;

		const stmt = db.prepare(`
			INSERT INTO module_runs (engagement_id, module_name, args, exit_code, stdout, stderr, duration_ms)
			VALUES (?, ?, ?, ?, ?, ?, ?)
		`);

		const result = stmt.run(
			engagementId ?? null,
			moduleName,
			JSON.stringify(args),
			outcome.exitCode,
			outcome.stdout.slice(0, 10_000),
			outcome.stderr.slice(0, 10_000),
			outcome.durationMs
		);

		db.close();
		return Number(result.lastInsertRowid);
	} catch (err) {
		log(`DB log failed: ${err instanceof Error ? err.message : String(err)}`);
		return null;
	}
}

// ── Helpers ──────────────────────────────────────────────────────────

function log(msg: string): void {
	const ts = new Date().toISOString();
	process.stderr.write(`[${ts}] [module_runner] ${msg}\n`);
}

/** Write JSON to stdout — this is the module runner's output channel */
function emit(data: ModuleResult): void {
	// eslint-disable-next-line no-console
	console.log(JSON.stringify(data));
}

function fatal(msg: string): never {
	emit({
		status: 'error',
		module: 'module_runner',
		timestamp: new Date().toISOString(),
		message: msg
	});
	process.exit(1);
}

function printUsage(): void {
	// List .py files in modules dir (excluding base_module and __pycache__)
	const files = readdirSync(MODULES_DIR)
		.filter((f) => f.endsWith('.py') && f !== 'base_module.py' && f !== '__init__.py')
		.map((f) => f.replace('.py', ''))
		.sort();

	const moduleList =
		files.length > 0
			? files.map((f) => `  ${f}`).join('\n')
			: '  (none yet — modules are added in Phase 2-4)';

	process.stdout.write(`Tactical Module Runner

Usage:
  npx tsx tactical/modules/module_runner.ts <module> [args...]

Options:
  --runner-db-path <path>     Path to rf_signals.db (default: ./rf_signals.db)
  --runner-timeout <ms>       Execution timeout in ms (default: 120000)
  --runner-engagement <id>    Link this run to an engagement ID
  --runner-help               Show this help message

All other arguments are forwarded to the Python module.

Available modules:
${moduleList}\n`);
	process.exit(0);
}

// ── Arg parsing ─────────────────────────────────────────────────────

interface ParsedArgs {
	moduleName: string;
	moduleArgs: string[];
	dbPath: string;
	timeoutMs: number;
	engagementId: number | undefined;
}

function parseIntSafe(value: string, min: number, fallback: number): number {
	const n = parseInt(value, 10);
	return isNaN(n) || n < min ? fallback : n;
}

function extractRunnerFlags(argv: string[]): { flags: Record<string, string>; rest: string[] } {
	const flags: Record<string, string> = {};
	const rest: string[] = [];

	for (let i = 0; i < argv.length; i++) {
		if (argv[i].startsWith('--runner-') && argv[i + 1]) {
			flags[argv[i]] = argv[++i];
		} else {
			rest.push(argv[i]);
		}
	}

	return { flags, rest };
}

function resolveRunnerConfig(flags: Record<string, string>) {
	return {
		dbPath: flags['--runner-db-path'] ?? DEFAULT_DB_PATH,
		timeoutMs: flags['--runner-timeout']
			? parseIntSafe(flags['--runner-timeout'], 1000, DEFAULT_TIMEOUT_MS)
			: DEFAULT_TIMEOUT_MS,
		engagementId: flags['--runner-engagement']
			? parseIntSafe(flags['--runner-engagement'], 0, NaN) || undefined
			: undefined
	};
}

function parseArgs(argv: string[]): ParsedArgs {
	const { flags, rest } = extractRunnerFlags(argv);
	const moduleName = rest[0]?.startsWith('--') ? '' : (rest[0] ?? '');

	return {
		moduleName,
		moduleArgs: moduleName ? rest.slice(1) : rest,
		...resolveRunnerConfig(flags)
	};
}

// ── Output formatting ───────────────────────────────────────────────

function emitOutcome(cleanName: string, outcome: RunOutcome): void {
	if (outcome.parsed) {
		emit(outcome.parsed);
		return;
	}
	if (outcome.stdout) {
		emit({
			status: 'error',
			module: cleanName,
			timestamp: new Date().toISOString(),
			message: 'Module produced non-JSON output',
			raw_output: outcome.stdout.slice(0, 5000)
		});
		return;
	}
	emit({
		status: 'error',
		module: cleanName,
		timestamp: new Date().toISOString(),
		message: outcome.stderr
			? `Module failed: ${outcome.stderr.split('\n').pop()}`
			: `Module exited with code ${outcome.exitCode} and no output`
	});
}

// ── Main ─────────────────────────────────────────────────────────────

async function executeModule(args: ParsedArgs): Promise<void> {
	const modulePath = resolveModule(args.moduleName);
	const cleanName = args.moduleName.replace(/\.py$/, '');

	log(`Running module: ${cleanName}`);
	log(`Args: ${args.moduleArgs.join(' ') || '(none)'}`);

	const outcome = await runModule(modulePath, args.moduleArgs, args.timeoutMs);
	log(`Exit code: ${outcome.exitCode}, Duration: ${outcome.durationMs}ms`);

	const runId = logRunToDb(args.dbPath, cleanName, args.moduleArgs, outcome, args.engagementId);
	log(runId !== null ? `Logged to module_runs: id=${runId}` : 'DB log skipped');

	emitOutcome(cleanName, outcome);
	process.exit(outcome.exitCode);
}

async function main(): Promise<void> {
	const argv = process.argv.slice(2);

	if (argv.length === 0 || argv.includes('--runner-help')) {
		printUsage();
		return;
	}

	const parsed = parseArgs(argv);

	if (!parsed.moduleName) {
		fatal('No module specified. Usage: module_runner.ts <module> [args...]');
	}

	await executeModule(parsed);
}

main().catch((err) => {
	fatal(`Runner crashed: ${err instanceof Error ? err.message : String(err)}`);
});
