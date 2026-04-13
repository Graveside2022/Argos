/**
 * SITREP Quarto template builder.
 *
 * Produces the full `.qmd` string for a SITREP report from a mission, capture,
 * and emitter snapshot. Inlines all sections (no `{{< include >}}` shortcodes)
 * so a single file is self-contained for Quarto rendering.
 */

import type { CaptureEmitterRow, CaptureRow, Mission } from './types';

export interface SitrepInput {
	mission: Mission;
	capture: CaptureRow;
	period_start: number;
	period_end: number;
	emitters: CaptureEmitterRow[];
	narrative?: string;
	serial: string;
	spectrum_image_path?: string;
	spectrum_caption?: string;
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function pad2(n: number): string {
	return n.toString().padStart(2, '0');
}

export function dtgZulu(ms: number): string {
	const d = new Date(ms);
	const dd = pad2(d.getUTCDate());
	const hh = pad2(d.getUTCHours());
	const mm = pad2(d.getUTCMinutes());
	const mon = MONTHS[d.getUTCMonth()];
	const yy = d.getUTCFullYear().toString().slice(-2);
	return `${dd}${hh}${mm}Z${mon}${yy}`;
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

const CHIP_MAP: ReadonlyArray<readonly [string, string, string]> = [
	['hostile', 'status-hostile', 'HOSTILE'],
	['suspect', 'status-suspect', 'SUSPECT'],
	['friend', 'status-friend', 'FRIEND'],
	['neutral', 'status-neutral', 'NEUTRAL']
];

function classChip(c: string | null): string {
	const v = (c ?? '').toLowerCase();
	const hit = CHIP_MAP.find(([key]) => v.includes(key));
	if (hit) return `<span class="${hit[1]}">${hit[2]}</span>`;
	return '<span class="status-unknown">UNKNOWN</span>';
}

export function countByClass(emitters: CaptureEmitterRow[]): {
	hostile: number;
	suspect: number;
} {
	let hostile = 0;
	let suspect = 0;
	for (const e of emitters) {
		const c = (e.classification ?? '').toLowerCase();
		if (c.includes('hostile')) hostile++;
		else if (c.includes('suspect')) suspect++;
	}
	return { hostile, suspect };
}

function escapeYamlString(s: string): string {
	return s
		.replace(/\\/g, '\\\\')
		.replace(/"/g, '\\"')
		.replace(/[\r\n]+/g, ' ');
}

function renderFrontmatter(input: SitrepInput): string {
	const title = escapeYamlString(`SITREP ${input.serial} — ${input.mission.name}`);
	const dtg = escapeYamlString(`DTG ${dtgZulu(input.period_end)}`);
	return [
		'---',
		`title: "${title}"`,
		`subtitle: "${dtg}"`,
		`date: "${new Date(input.period_end).toISOString()}"`,
		'format:',
		'  argos-reports-html: default',
		'  argos-reports-typst: default',
		'  argos-reports-revealjs: default',
		'---',
		''
	].join('\n');
}

function renderExecutiveSummary(input: SitrepInput): string {
	const { hostile, suspect } = countByClass(input.emitters);
	const minutes = Math.round((input.period_end - input.period_start) / 60000);
	const auto = `${input.emitters.length} emitters observed in ${minutes}-minute window. ${hostile} hostile, ${suspect} suspect.`;
	const body = input.narrative ?? auto;
	return ['## Executive Summary', '', `::: {.bluf}`, body, ':::', ''].join('\n');
}

function renderSpectrumSection(input: SitrepInput): string {
	if (!input.spectrum_image_path) return '';
	const caption = input.spectrum_caption ?? 'NovaSDR waterfall — site survey snapshot';
	return [
		'## Spectrum Site Survey',
		'',
		`![${caption}](${input.spectrum_image_path})`,
		'',
		''
	].join('\n');
}

function renderLoadout(capture: CaptureRow): string {
	const sensors = Array.isArray(capture.loadout?.sensors) ? capture.loadout.sensors : [];
	const rows = sensors
		.map((s) => `| ${s.tool} | ${s.interface ?? '—'} | ${s.gain ?? '—'} |`)
		.join('\n');
	const body = rows.length > 0 ? rows : '| — | — | — |';
	return [
		'## Collection Posture',
		'',
		'| TOOL | INTERFACE | GAIN |',
		'|------|-----------|------|',
		body,
		''
	].join('\n');
}

function renderEmitterRow(e: CaptureEmitterRow, idx: number): string {
	return `| ${idx + 1} | ${freqMhz(e.freq_hz)} | ${powerDbm(e.power_dbm)} | ${escapeMd(e.identifier)} | ${escapeMd(e.mgrs)} | ${classChip(e.classification)} |`;
}

function renderEmitterTable(emitters: CaptureEmitterRow[]): string {
	const header = [
		'## Emitter Table',
		'',
		'| # | FREQ MHZ | PWR DBM | IDENTIFIER | MGRS | CLASS |',
		'|---|----------|---------|------------|------|-------|'
	];
	const rows = emitters.map((e, i) => renderEmitterRow(e, i));
	return [...header, ...rows, ''].join('\n');
}

function renderMijifeeder(e: CaptureEmitterRow, idx: number): string {
	return [
		'::: {.mijifeeder}',
		`#### MIJIFEEDER ${idx + 1} — ${escapeMd(e.identifier)}`,
		'',
		`- **Freq:** ${freqMhz(e.freq_hz)} MHz`,
		`- **Power:** ${powerDbm(e.power_dbm)} dBm`,
		`- **MGRS:** ${escapeMd(e.mgrs)}`,
		`- **Class:** ${classChip(e.classification)}`,
		`- **Sensor:** ${escapeMd(e.sensor_tool)}`,
		':::',
		''
	].join('\n');
}

function renderHostileBlocks(emitters: CaptureEmitterRow[]): string {
	const targets = emitters.filter((e) => {
		const c = (e.classification ?? '').toLowerCase();
		return c.includes('hostile') || c.includes('suspect');
	});
	const header = ['## Hostile / Unknown', ''];
	if (targets.length === 0) {
		return [...header, 'None in this tick.', ''].join('\n');
	}
	const blocks = targets.map((e, i) => renderMijifeeder(e, i));
	return [...header, ...blocks].join('\n');
}

function renderAssessment(emitters: CaptureEmitterRow[]): string {
	const { hostile, suspect } = countByClass(emitters);
	const body = `${hostile} confirmed hostile, ${suspect} suspect emitters in the current tick. See Section 4 for MIJIFEEDER breakdown.`;
	return ['## Assessment', '', body, ''].join('\n');
}

export function buildSitrepQmd(input: SitrepInput): string {
	return [
		renderFrontmatter(input),
		renderExecutiveSummary(input),
		renderSpectrumSection(input),
		renderLoadout(input.capture),
		renderEmitterTable(input.emitters),
		renderHostileBlocks(input.emitters),
		'## Pattern Analysis',
		'',
		'None in this tick.',
		'',
		renderAssessment(input.emitters),
		'## Recommended Actions',
		'',
		'- Continue current collection posture.',
		'- Review MIJIFEEDER blocks for prioritization.',
		'',
		'## Distribution',
		'',
		'EWCC, Higher, File',
		''
	].join('\n');
}
