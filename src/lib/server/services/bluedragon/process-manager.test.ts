import { describe, expect, it } from 'vitest';

import { buildArgs } from './process-manager';

describe('buildArgs', () => {
	it('emits center+channels for the default 40-ch path', () => {
		const args = buildArgs('volume');
		expect(args).toContain('-c');
		expect(args).toContain('-C');
		expect(args).not.toContain('--all-channels');
	});

	it('replaces -c/-C with --all-channels when allChannels is true', () => {
		const args = buildArgs('volume', { allChannels: true });
		expect(args).toContain('--all-channels');
		expect(args).not.toContain('-c');
		expect(args).not.toContain('-C');
	});

	it('appends each opted-in option flag', () => {
		const args = buildArgs('volume', {
			activeScan: true,
			gpsd: true,
			codedScan: true
		});
		expect(args).toContain('--active-scan');
		expect(args).toContain('--gpsd');
		expect(args).toContain('--coded-scan');
	});

	it('skips option flags when the option is false or absent', () => {
		const args = buildArgs('volume', { activeScan: false });
		expect(args).not.toContain('--active-scan');
		expect(args).not.toContain('--gpsd');
		expect(args).not.toContain('--coded-scan');
	});

	it('rejects truthy non-boolean values (strict === true)', () => {
		const args = buildArgs('volume', {
			activeScan: 'yes' as unknown as boolean
		});
		expect(args).not.toContain('--active-scan');
	});

	it('uses gain from the selected profile', () => {
		const clean = buildArgs('clean');
		const max = buildArgs('max');
		const cleanGain = clean[clean.indexOf('-g') + 1];
		const maxGain = max[max.indexOf('-g') + 1];
		expect(cleanGain).toBe('40');
		expect(maxGain).toBe('55');
	});
});
