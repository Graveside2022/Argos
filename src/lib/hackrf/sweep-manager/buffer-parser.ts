/**
 * HackRF spectrum data parsing logic.
 * Extracted from buffer-manager.ts for constitutional compliance (Article 2.2).
 */

import type { SpectrumData } from '$lib/server/hackrf/types';
import { logError, logInfo, logWarn } from '$lib/utils/logger';

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

/**
 * Parse a single line of HackRF output into a ParsedLine
 */
export function parseLine(line: string, maxLineLength: number): ParsedLine {
	const trimmedLine = line.trim();

	if (trimmedLine.length > maxLineLength) {
		logWarn('Line too long, truncating', {
			length: trimmedLine.length,
			maxLength: maxLineLength
		});
		return {
			data: null,
			isValid: false,
			rawLine: trimmedLine.substring(0, 100) + '...',
			parseError: 'Line too long'
		};
	}

	try {
		if (isNonDataLine(trimmedLine)) {
			return {
				data: null,
				isValid: false,
				rawLine: trimmedLine,
				parseError: 'Non-data line'
			};
		}

		if (trimmedLine.includes(',') && trimmedLine.length > 50) {
			logInfo('[SEARCH] POTENTIAL DATA LINE:', {
				preview: trimmedLine.substring(0, 200)
			});
		}

		const spectrumData = parseSpectrumData(trimmedLine);

		if (spectrumData) {
			return { data: spectrumData, isValid: true, rawLine: trimmedLine };
		} else {
			return {
				data: null,
				isValid: false,
				rawLine: trimmedLine,
				parseError: 'Failed to parse spectrum data'
			};
		}
	} catch (error) {
		return {
			data: null,
			isValid: false,
			rawLine: trimmedLine,
			parseError: error instanceof Error ? error.message : String(error)
		};
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

/**
 * Parse spectrum data from HackRF output line.
 * Handles both real hackrf_sweep format (with date/time) and simplified format.
 */
export function parseSpectrumData(line: string): SpectrumData | null {
	try {
		const parts = line.split(',').map((part) => part.trim());

		if (parts.length < 7) {
			return null;
		}

		let startFreq: number,
			endFreq: number,
			binWidth: number,
			numSamples: number,
			powerStartIndex: number;
		let timestamp = new Date();

		const firstPart = parts[0];
		if (firstPart.includes('-') && firstPart.length >= 8) {
			if (parts.length < 7) {
				return null;
			}
			const dateStr = parts[0];
			const timeStr = parts[1];
			timestamp = parseTimestamp(dateStr, timeStr);

			startFreq = parseInt(parts[2]);
			endFreq = parseInt(parts[3]);
			binWidth = parseFloat(parts[4]);
			numSamples = parseInt(parts[5]);
			powerStartIndex = 6;
		} else {
			startFreq = parseInt(parts[0]);
			endFreq = parseInt(parts[1]);
			binWidth = parseFloat(parts[2]);
			numSamples = parseInt(parts[3]);
			powerStartIndex = 4;
		}

		if (isNaN(startFreq) || isNaN(endFreq) || isNaN(binWidth) || isNaN(numSamples)) {
			return null;
		}

		const startFreqMHz = startFreq / 1000000;
		const endFreqMHz = endFreq / 1000000;

		const powerValues: number[] = [];
		for (let i = powerStartIndex; i < parts.length; i++) {
			const power = parseFloat(parts[i]);
			if (!isNaN(power)) {
				powerValues.push(power);
			}
		}

		if (powerValues.length === 0) {
			return null;
		}

		const spectrumData: SpectrumData = {
			timestamp: timestamp,
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
				binWidth: binWidth,
				numSamples: numSamples
			}
		};

		return spectrumData;
	} catch (error) {
		logError('Error parsing spectrum data', {
			error: error instanceof Error ? error.message : String(error),
			line: line.substring(0, 100) + (line.length > 100 ? '...' : '')
		});
		return null;
	}
}

/**
 * Validate spectrum data quality
 */
export function validateSpectrumData(data: SpectrumData): {
	isValid: boolean;
	issues: string[];
} {
	const issues: string[] = [];

	if (
		data.startFreq !== undefined &&
		data.endFreq !== undefined &&
		data.startFreq >= data.endFreq
	) {
		issues.push('Invalid frequency range');
	}

	if (data.powerValues && data.powerValues.length === 0) {
		issues.push('No power values');
	}

	if (data.powerValues) {
		const unreasonablePowers = data.powerValues.filter((p) => p < -150 || p > 50);
		if (unreasonablePowers.length > 0) {
			issues.push(`${unreasonablePowers.length} unreasonable power values`);
		}

		const uniqueValues = new Set(data.powerValues);
		if (uniqueValues.size === 1 && data.powerValues.length > 10) {
			issues.push('All power values identical (possible stuck device)');
		}
	}

	const now = Date.now();
	const dataTime = data.timestamp.getTime();
	if (Math.abs(now - dataTime) > 86400000) {
		issues.push('Timestamp far from current time');
	}

	return { isValid: issues.length === 0, issues };
}
