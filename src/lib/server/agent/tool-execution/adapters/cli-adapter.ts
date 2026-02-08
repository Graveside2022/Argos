/**
 * CLI Backend Adapter
 *
 * Executes tools by running command-line utilities
 */

import { spawn } from 'child_process';
import type {
	ToolBackendAdapter,
	ToolDefinition,
	ToolExecutionResult,
	ExecutionContext,
	CLIBackendConfig
} from '$lib/server/agent/tool-execution/types';

export class CLIAdapter implements ToolBackendAdapter {
	readonly type = 'cli' as const;
	private initialized = false;

	async initialize(): Promise<void> {
		console.log('[CLIAdapter] Initializing CLI adapter...');
		this.initialized = true;
	}

	async execute(
		tool: ToolDefinition,
		parameters: Record<string, any>,
		_context?: ExecutionContext
	): Promise<ToolExecutionResult> {
		const startTime = Date.now();
		const config = tool.backendConfig as CLIBackendConfig;

		try {
			// Build command arguments with parameter interpolation
			const args = this.buildArgs(config.args || [], parameters);

			console.log(`[CLIAdapter] Executing: ${config.command} ${args.join(' ')}`);

			// Execute command
			const result = await this.executeCommand(
				config.command,
				args,
				config.cwd,
				config.env,
				config.timeout || 30000,
				config.shell
			);

			return {
				status: 'success',
				toolName: tool.name,
				data: {
					stdout: result.stdout,
					stderr: result.stderr,
					exitCode: result.exitCode
				},
				duration: Date.now() - startTime,
				timestamp: Date.now(),
				backend: this.type
			};
		} catch (error) {
			const duration = Date.now() - startTime;

			return {
				status: 'error',
				toolName: tool.name,
				error: error instanceof Error ? error.message : String(error),
				errorDetails: error,
				duration,
				timestamp: Date.now(),
				backend: this.type
			};
		}
	}

	async healthCheck(): Promise<boolean> {
		return this.initialized;
	}

	async cleanup(): Promise<void> {
		console.log('[CLIAdapter] Cleaning up CLI adapter...');
		this.initialized = false;
	}

	/**
	 * Build command arguments with parameter interpolation
	 * Example: ["--device", "{{deviceId}}"] + {deviceId: "ABC"} -> ["--device", "ABC"]
	 */
	private buildArgs(argTemplate: string[], parameters: Record<string, any>): string[] {
		return argTemplate.map((arg) => {
			let interpolated = arg;

			// Replace {{param}} with actual values
			for (const [key, value] of Object.entries(parameters)) {
				const placeholder = `{{${key}}}`;
				if (interpolated.includes(placeholder)) {
					interpolated = interpolated.replace(placeholder, String(value));
				}
			}

			return interpolated;
		});
	}

	/**
	 * Execute a command and return stdout/stderr
	 */
	private executeCommand(
		command: string,
		args: string[],
		cwd?: string,
		env?: Record<string, string>,
		timeout: number = 30000,
		useShell: boolean = false
	): Promise<{ stdout: string; stderr: string; exitCode: number }> {
		return new Promise((resolve, reject) => {
			const childEnv = { ...process.env, ...(env || {}) };

			const child = spawn(command, args, {
				cwd: cwd || process.cwd(),
				env: childEnv,
				shell: useShell,
				timeout
			});

			let stdout = '';
			let stderr = '';

			child.stdout?.on('data', (data) => {
				stdout += data.toString();
			});

			child.stderr?.on('data', (data) => {
				stderr += data.toString();
			});

			child.on('error', (error) => {
				reject(new Error(`Failed to execute command: ${error.message}`));
			});

			child.on('close', (code) => {
				if (code === 0) {
					resolve({ stdout, stderr, exitCode: code || 0 });
				} else {
					reject(
						new Error(
							`Command exited with code ${code}\nstdout: ${stdout}\nstderr: ${stderr}`
						)
					);
				}
			});

			// Timeout handling
			setTimeout(() => {
				if (!child.killed) {
					child.kill('SIGTERM');
					reject(new Error(`Command timed out after ${timeout}ms`));
				}
			}, timeout);
		});
	}
}
