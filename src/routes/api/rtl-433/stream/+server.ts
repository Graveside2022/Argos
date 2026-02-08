import type { RequestHandler } from './$types';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { getCorsHeaders } from '$lib/server/security/cors';

const execAsync = promisify(exec);

export const GET: RequestHandler = async ({ request }) => {
	const encoder = new TextEncoder();

	const stream = new ReadableStream({
		async start(controller) {
			// Clean up any orphaned tail processes before starting
			try {
				await execAsync('pkill -f "tail.*rtl433" 2>/dev/null || true');
				// Wait a moment for cleanup
				await new Promise((resolve) => setTimeout(resolve, 100));
			} catch (_e) {
				// Continue if cleanup fails
			}

			try {
				const { stdout } = await execAsync(
					'ps aux | grep "[r]tl_433" | grep -v grep || echo ""'
				);
				const lines = stdout
					.trim()
					.split('\n')
					.filter((line) => line && line.length > 0);

				if (lines.length === 0) {
					controller.enqueue(
						encoder.encode(
							'data: {"type":"console","message":"RTL_433 is not running. Start it to see output."}\n\n'
						)
					);
					controller.close();
					return;
				}

				const rtlPid = lines[0].trim().split(/\s+/)[1];
				controller.enqueue(
					encoder.encode(
						`data: {"type":"console","message":"[CRITICAL] RTL_433 Active (PID: ${rtlPid}) - Live Signal Feed"}\n\n`
					)
				);

				// Find RTL_433 log file (prioritize web interface log)
				const logFiles = [
					'/tmp/rtl433_web.log',
					'/tmp/rtl433_sudo.log',
					'/tmp/rtl433_production.log',
					'/tmp/rtl433_emergency.log'
				];
				let activeLogFile = null;

				for (const logFile of logFiles) {
					if (existsSync(logFile)) {
						activeLogFile = logFile;
						break;
					}
				}

				if (!activeLogFile) {
					controller.enqueue(
						encoder.encode(
							'data: {"type":"console","message":"[WARN] No RTL_433 log file found. Output not available."}\n\n'
						)
					);
					controller.close();
					return;
				}

				controller.enqueue(
					encoder.encode(
						`data: {"type":"console","message":"[RF] Streaming from: ${activeLogFile}"}\n\n`
					)
				);

				// Use tail -f to stream the log file
				const tailProcess = spawn('tail', ['-f', activeLogFile]);

				tailProcess.stdout?.on('data', (data) => {
					const lines = data
						.toString()
						.split('\n')
						.filter((line: string) => line.trim());
					lines.forEach((line: string) => {
						const message = {
							type: 'console',
							message: line,
							timestamp: new Date().toISOString()
						};
						controller.enqueue(encoder.encode(`data: ${JSON.stringify(message)}\n\n`));
					});
				});

				tailProcess.stderr?.on('data', (data) => {
					const message = {
						type: 'console',
						message: `ERROR: ${data.toString()}`,
						timestamp: new Date().toISOString()
					};
					controller.enqueue(encoder.encode(`data: ${JSON.stringify(message)}\n\n`));
				});

				// Clean up on close or error
				const cleanup = () => {
					if (tailProcess && !tailProcess.killed) {
						tailProcess.kill();
					}
					controller.close();
				};

				tailProcess.on('error', cleanup);
				tailProcess.on('exit', cleanup);

				// Auto-cleanup after 10 minutes
				setTimeout(cleanup, 600000);
			} catch (_error) {
				controller.enqueue(
					encoder.encode(
						'data: {"type":"console","message":"Error starting RTL_433 stream"}\n\n'
					)
				);
				controller.close();
			}
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive',
			...getCorsHeaders(request.headers.get('Origin'))
		}
	});
};
