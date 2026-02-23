import { describe, expect, it } from 'vitest';

import { execFileAsync } from './exec';

describe('execFileAsync', () => {
	it('executes a command and returns stdout', async () => {
		const { stdout } = await execFileAsync('/bin/echo', ['hello', 'world']);
		expect(stdout.trim()).toBe('hello world');
	});

	it('returns stderr when present', async () => {
		// /bin/sh -c writes to stderr via >&2 redirection
		const { stderr } = await execFileAsync('/bin/sh', ['-c', 'echo warning >&2']);
		expect(stderr.trim()).toBe('warning');
	});

	it('rejects on non-existent command', async () => {
		await expect(execFileAsync('/nonexistent/command')).rejects.toThrow();
	});

	it('rejects on non-zero exit code', async () => {
		await expect(execFileAsync('/bin/sh', ['-c', 'exit 1'])).rejects.toThrow();
	});

	it('accepts timeout option', async () => {
		await expect(execFileAsync('/bin/sleep', ['10'], { timeout: 100 })).rejects.toThrow();
	});

	it('works with empty args array', async () => {
		const { stdout } = await execFileAsync('/bin/pwd');
		expect(stdout.trim()).toBeTruthy();
	});

	it('works with no args (default empty array)', async () => {
		const { stdout } = await execFileAsync('/bin/pwd');
		expect(stdout.trim()).toBeTruthy();
	});
});
