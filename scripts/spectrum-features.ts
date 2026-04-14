import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { extractSpectrumFeatures } from '../src/lib/server/services/reports/spectrum-features';

function parseMetaObj(obj: Record<string, unknown>): { startHz: number; endHz: number } | null {
	if (obj.type !== 'meta') return null;
	const startHz = Number(obj.startHz);
	const endHz = Number(obj.endHz);
	return Number.isFinite(startHz) && Number.isFinite(endHz) ? { startHz, endHz } : null;
}

function readMetaBand(ndjsonPath: string): { startHz: number; endHz: number } | null {
	const firstLine = readFileSync(ndjsonPath, 'utf8').split('\n', 1)[0];
	if (!firstLine) return null;
	try {
		return parseMetaObj(JSON.parse(firstLine) as Record<string, unknown>);
	} catch {
		return null;
	}
}

function resolveBand(
	ndjsonPath: string,
	startArg: string | undefined,
	endArg: string | undefined
): { startHz: number; endHz: number } {
	const startHz = Number(startArg);
	const endHz = Number(endArg);
	if (Number.isFinite(startHz) && Number.isFinite(endHz)) return { startHz, endHz };
	const meta = readMetaBand(ndjsonPath);
	if (!meta) {
		console.error('no meta line in NDJSON and no start/end override provided');
		process.exit(1);
	}
	return meta;
}

async function main(): Promise<void> {
	const [, , captureId, startArg, endArg] = process.argv;
	if (!captureId) {
		console.error('usage: npx tsx scripts/spectrum-features.ts <captureId> [startHz] [endHz]');
		process.exit(2);
	}
	const ndjsonPath = resolve(join(process.cwd(), 'data', 'captures', captureId, 'sweep.ndjson'));
	if (!existsSync(ndjsonPath)) {
		console.error(`no such capture: ${ndjsonPath}`);
		process.exit(1);
	}
	const { startHz, endHz } = resolveBand(ndjsonPath, startArg, endArg);
	const features = await extractSpectrumFeatures(ndjsonPath, startHz, endHz);
	process.stdout.write(JSON.stringify(features, null, 2) + '\n');
}

main().catch((err: unknown) => {
	console.error('spectrum-features failed:', err instanceof Error ? err.message : String(err));
	process.exit(1);
});
