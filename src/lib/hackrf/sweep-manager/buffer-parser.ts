/**
 * HackRF spectrum data parsing logic.
 * Extracted from buffer-manager.ts for constitutional compliance (Article 2.2).
 */

import { errMsg } from '$lib/server/api/error-utils';
import type { SpectrumData } from '$lib/server/hackrf/types';
import { logger } from '$lib/utils/logger';

export interface ParsedLine {
	data: SpectrumData | null;
	isValid: boolean;
	rawLine: string;
	parseError?: string;
}

/** Non-data line patterns from HackRF output (debug, info, error messages) */
const NON_DATA_PATTERNS = [
	/^Found HackRF/,
	/^call_result is/,
	/^Reading samples/,
	/^Streaming samples/,
	/^Stop with Ctrl-C/,
	/^hackrf_sweep version/,
	/^bandwidth_hz/,
	/^sample_rate_hz/,
	/^baseband_filter_bw_hz/,
	/^RSSI:/,
	/^No HackRF boards found/,
	/^hackrf_open\(\) failed/,
	/^Resource busy/,
	/^Permission denied/,
	/^libusb_open\(\) failed/,
	/^USB error/,
	/^ERROR:/,
	/^WARNING:/,
	/^INFO:/,
	/^DEBUG:/
];

/**
 * Check if line is non-data (debug, info, error messages)
 */
export function isNonDataLine(line: string): boolean {
	return NON_DATA_PATTERNS.some((pattern) => pattern.test(line));
}

function invalidLine(rawLine: string, parseError: string): ParsedLine {
	return { data: null, isValid: false, rawLine, parseError };
}

function tryParseLine(trimmedLine: string): ParsedLine {
	if (isNonDataLine(trimmedLine)) {
		return invalidLine(trimmedLine, 'Non-data line');
	}

	if (trimmedLine.includes(',') && trimmedLine.length > 50) {
		logger.info('[SEARCH] POTENTIAL DATA LINE:', { preview: trimmedLine.substring(0, 200) });
	}

	const spectrumData = parseSpectrumData(trimmedLine);
	return spectrumData
		? { data: spectrumData, isValid: true, rawLine: trimmedLine }
		: invalidLine(trimmedLine, 'Failed to parse spectrum data');
}

/**
 * Parse a single line of HackRF output into a ParsedLine
 */
export function parseLine(line: string, maxLineLength: number): ParsedLine {
	const trimmedLine = line.trim();

	if (trimmedLine.length > maxLineLength) {
		logger.warn('Line too long, truncating', {
			length: trimmedLine.length,
			maxLength: maxLineLength
		});
		return invalidLine(trimmedLine.substring(0, 100) + '...', 'Line too long');
	}

	try {
		return tryParseLine(trimmedLine);
	} catch (error) {
		return invalidLine(trimmedLine, errMsg(error));
	}
}

/**
 * Parse timestamp from date and time strings
 */
function parseTimestamp(dateStr: string, timeStr: string): Date {
	try {
		const fullTimestamp = `${dateStr} ${timeStr}`;
		const parsedDate = new Date(fullTimestamp);
		if (isNaN(parsedDate.getTime())) {
			return new Date();
		}
		return parsedDate;
	} catch (_error: unknown) {
		return new Date();
	}
}

interface ParsedFields {
	timestamp: Date;
	startFreq: number;
	endFreq: number;
	binWidth: number;
	numSamples: number;
	powerStartIndex: number;
}

function hasDatePrefix(firstPart: string): boolean {
	return firstPart.includes('-') && firstPart.length >= 8;
}

function extractFields(parts: string[]): ParsedFields | null {
	const offset = hasDatePrefix(parts[0]) ? 2 : 0;
	const timestamp = offset === 2 ? parseTimestamp(parts[0], parts[1]) : new Date();

	const startFreq = parseInt(parts[offset]);
	const endFreq = parseInt(parts[offset + 1]);
	const binWidth = parseFloat(parts[offset + 2]);
	const numSamples = parseInt(parts[offset + 3]);

	const hasInvalid = [startFreq, endFreq, binWidth, numSamples].some(isNaN);
	if (hasInvalid) return null;

	return { timestamp, startFreq, endFreq, binWidth, numSamples, powerStartIndex: offset + 4 };
}

function extractPowerValues(parts: string[], startIndex: number): number[] {
	const values: number[] = [];
	for (let i = startIndex; i < parts.length; i++) {
		const power = parseFloat(parts[i]);
		if (!isNaN(power)) values.push(power);
	}
	return values;
}

function buildSpectrumData(fields: ParsedFields, powerValues: number[]): SpectrumData {
	const startFreqMHz = fields.startFreq / 1000000;
	const endFreqMHz = fields.endFreq / 1000000;

	return {
		timestamp: fields.timestamp,
		frequency: startFreqMHz + (endFreqMHz - startFreqMHz) / 2,
		power: Math.max(...powerValues),
		unit: 'MHz',
		startFreq: startFreqMHz,
		endFreq: endFreqMHz,
		powerValues,
		metadata: {
			sampleCount: powerValues.length,
			minPower: Math.min(...powerValues),
			maxPower: Math.max(...powerValues),
			avgPower: powerValues.reduce((sum, val) => sum + val, 0) / powerValues.length,
			binWidth: fields.binWidth,
			numSamples: fields.numSamples
		}
	};
}

function tryParseSpectrumData(parts: string[]): SpectrumData | null {
	const fields = extractFields(parts);
	if (!fields) return null;

	const powerValues = extractPowerValues(parts, fields.powerStartIndex);
	if (powerValues.length === 0) return null;

	return buildSpectrumData(fields, powerValues);
}

/**
 * Parse spectrum data from HackRF output line.
 * Handles both real hackrf_sweep format (with date/time) and simplified format.
 */
export function parseSpectrumData(line: string): SpectrumData | null {
	try {
		const parts = line.split(',').map((part) => part.trim());
		if (parts.length < 7) return null;
		return tryParseSpectrumData(parts);
	} catch (error) {
		logger.error('Error parsing spectrum data', {
			error: errMsg(error),
			line: line.substring(0, 100) + (line.length > 100 ? '...' : '')
		});
		return null;
	}
}

function validateFrequencyRange(data: SpectrumData): string | null {
	if (
		data.startFreq !== undefined &&
		data.endFreq !== undefined &&
		data.startFreq >= data.endFreq
	) {
		return 'Invalid frequency range';
	}
	return null;
}

function checkPowerRange(powerValues: number[]): string | null {
	const unreasonable = powerValues.filter((p) => p < -150 || p > 50);
	return unreasonable.length > 0 ? `${unreasonable.length} unreasonable power values` : null;
}

function checkPowerDiversity(powerValues: number[]): string | null {
	if (new Set(powerValues).size === 1 && powerValues.length > 10) {
		return 'All power values identical (possible stuck device)';
	}
	return null;
}

function validatePowerValues(powerValues: number[] | undefined): string[] {
	if (!powerValues) return [];
	if (powerValues.length === 0) return ['No power values'];
	return [checkPowerRange(powerValues), checkPowerDiversity(powerValues)].filter(
		(issue): issue is string => issue !== null
	);
}

function validateTimestamp(timestamp: Date): string | null {
	const drift = Math.abs(Date.now() - timestamp.getTime());
	return drift > 86400000 ? 'Timestamp far from current time' : null;
}

/**
 * Validate spectrum data quality
 */
export function validateSpectrumData(data: SpectrumData): {
	isValid: boolean;
	issues: string[];
} {
	const issues = [
		validateFrequencyRange(data),
		...validatePowerValues(data.powerValues),
		validateTimestamp(data.timestamp)
	].filter((issue): issue is string => issue !== null);

	return { isValid: issues.length === 0, issues };
}
