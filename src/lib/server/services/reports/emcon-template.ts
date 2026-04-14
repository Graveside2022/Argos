/**
 * EMCON survey Quarto template builder.
 *
 * Produces the full `.qmd` string for an EMCON survey report from a baseline
 * capture, posture capture, and diff result. Injects a LOADOUT MISMATCH
 * banner if the sensor loadouts do not hash-match.
 */

import type { DiffResult, EmitterDelta, EmitterRow } from './emcon-diff';
import { dtgZulu } from './sitrep-template';
import type { CaptureEmitterRow, CaptureRow, Mission } from './types';

export interface EmconInput {
	mission: Mission;
	baseline: CaptureRow;
	posture: CaptureRow;
	diff: DiffResult;
	baselineEmitters: CaptureEmitterRow[];
	postureEmitters: CaptureEmitterRow[];
	narrative?: string;
	serial: string;
}

function escapeMd(s: string | null | undefined): string {
	if (s === null || s === undefined) return '—';
	return s.replace(/\|/g, '\\|');
}

function freqMhz(hz: number | null): string {
	if (hz === null) return '—';
	return (hz / 1e6).toFixed(3);
}

function powerDbm(dbm: number | null): string {
	if (dbm === null) return '—';
	return dbm.toFixed(1);
}

function topEmitterLabel(diff: DiffResult): string {
	const best = diff.critical[0] ?? diff.notable[0];
	if (!best) return 'none';
	return best.posture.identifier ?? best.posture.fingerprint_key;
}

function renderFrontmatter(input: EmconInput): string {
	const title = `EMCON SURVEY ${input.serial} — ${input.mission.name}`;
	const dtg = dtgZulu(input.posture.start_dtg);
	return [
		'---',
		`title: "${title}"`,
		`subtitle: "DTG ${dtg}"`,
		`date: "${new Date(input.posture.start_dtg).toISOString()}"`,
		'format:',
		'  argos-reports-html: default',
		'  argos-reports-typst: default',
		'  argos-reports-revealjs: default',
		'---',
		''
	].join('\n');
}

function renderLoadoutWarning(diff: DiffResult): string {
	if (diff.loadout.matched) return '';
	const only = [
		diff.loadout.baseline_only.length
			? `baseline-only: ${diff.loadout.baseline_only.join(', ')}`
			: '',
		diff.loadout.posture_only.length
			? `posture-only: ${diff.loadout.posture_only.join(', ')}`
			: ''
	]
		.filter(Boolean)
		.join(' — ');
	return [
		'::: {.loadout-warning}',
		`**LOADOUT MISMATCH.** Baseline and posture sensor suites differ. Diff restricted to intersection (${diff.loadout.intersection.join(', ') || 'none'}). ${only}`,
		':::',
		''
	].join('\n');
}

function renderBluf(input: EmconInput): string {
	const d = input.diff;
	const auto = `${d.new.length} new signatures, ${d.critical.length} critical power-ups, top emitter: ${topEmitterLabel(d)}.`;
	return ['## BLUF', '', '::: {.bluf}', input.narrative ?? auto, ':::', ''].join('\n');
}

function metricCell(label: string, value: number | string): string {
	return `<div class="metric-cell"><span class="label">${label}</span><span class="value">${value}</span></div>`;
}

function renderHeadlineMetrics(d: DiffResult): string {
	const cells = [
		metricCell('NEW', d.new.length),
		metricCell('MISSING', d.missing.length),
		metricCell('CRITICAL', d.critical.length),
		metricCell('NOTABLE', d.notable.length),
		metricCell('UNCHANGED', d.unchanged.length),
		metricCell('LOADOUT', d.loadout.matched ? 'MATCH' : 'DIFF')
	];
	return ['## Headline Metrics', '', '<div class="metrics-grid">', ...cells, '</div>', ''].join(
		'\n'
	);
}

function renderEmitterRow(e: EmitterRow, idx: number): string {
	return `| ${idx + 1} | ${freqMhz(e.freq_hz)} | ${powerDbm(e.power_dbm)} | ${escapeMd(e.identifier)} | ${escapeMd(e.mgrs)} |`;
}

function renderEmitterSection(title: string, rows: EmitterRow[]): string {
	const header = [
		`## ${title}`,
		'',
		'| # | FREQ MHZ | PWR DBM | IDENTIFIER | MGRS |',
		'|---|----------|---------|------------|------|'
	];
	if (rows.length === 0) {
		return [header[0], '', 'None.', ''].join('\n');
	}
	return [...header, ...rows.map((e, i) => renderEmitterRow(e, i)), ''].join('\n');
}

function renderDeltaRow(d: EmitterDelta, idx: number, cls: string): string {
	const e = d.posture;
	const delta = d.delta_db >= 0 ? `+${d.delta_db.toFixed(1)}` : d.delta_db.toFixed(1);
	return `| ${idx + 1} | ${freqMhz(e.freq_hz)} | ${powerDbm(e.power_dbm)} | ${delta} | ${escapeMd(e.identifier)} | ${escapeMd(e.mgrs)} |{.${cls}}`;
}

function renderDeltaSection(title: string, deltas: EmitterDelta[], cls: string): string {
	const header = [
		`## ${title}`,
		'',
		'| # | FREQ MHZ | PWR DBM | ΔDB | IDENTIFIER | MGRS |',
		'|---|----------|---------|-----|------------|------|'
	];
	if (deltas.length === 0) {
		return [header[0], '', 'None.', ''].join('\n');
	}
	return [...header, ...deltas.map((d, i) => renderDeltaRow(d, i, cls)), ''].join('\n');
}

function renderCaptureAppendix(title: string, rows: CaptureEmitterRow[]): string {
	const header = [
		`### ${title}`,
		'',
		'| # | FREQ MHZ | PWR DBM | IDENTIFIER | MGRS |',
		'|---|----------|---------|------------|------|'
	];
	const body = rows.map(
		(e, i) =>
			`| ${i + 1} | ${freqMhz(e.freq_hz)} | ${powerDbm(e.power_dbm)} | ${escapeMd(e.identifier)} | ${escapeMd(e.mgrs)} |`
	);
	return [...header, ...body, ''].join('\n');
}

export function buildEmconQmd(input: EmconInput): string {
	const d = input.diff;
	return [
		renderFrontmatter(input),
		renderLoadoutWarning(d),
		renderBluf(input),
		renderHeadlineMetrics(d),
		renderEmitterSection('New Emitters', d.new),
		renderDeltaSection('Power-Critical', d.critical, 'power-critical'),
		renderDeltaSection('Power-Notable', d.notable, 'power-notable'),
		renderEmitterSection('Missing Emitters', d.missing),
		'## Recommended Actions',
		'',
		'- Investigate critical power-ups for compromise indicators.†',
		'- Review missing emitters for movement or shutdown.',
		'',
		'† AI-suggested mitigation pending operator review.',
		'',
		'## Raw Data Appendix',
		'',
		renderCaptureAppendix('Baseline Capture', input.baselineEmitters),
		renderCaptureAppendix('Posture Capture', input.postureEmitters)
	].join('\n');
}
