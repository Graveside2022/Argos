import type { SpectrumData } from '$lib/server/hackrf/types';
import { logger } from '$lib/utils/logger';

import { type ParsedLine, parseLine, validateSpectrumData } from './buffer-parser';

// Re-export ParsedLine for backward compatibility
export type { ParsedLine } from './buffer-parser';

export interface BufferState {
	stdoutBuffer: string;
	maxBufferSize: number;
	bufferOverflowCount: number;
	lineCount: number;
	totalBytesProcessed: number;
}

export interface BufferConfig {
	maxBufferSize?: number;
	maxLineLength?: number;
	overflowThreshold?: number;
}

/**
 * Manages HackRF stdout buffer processing and data parsing
 */
export class BufferManager {
	private bufferState: BufferState = {
		stdoutBuffer: '',
		maxBufferSize: 1024 * 1024,
		bufferOverflowCount: 0,
		lineCount: 0,
		totalBytesProcessed: 0
	};

	private readonly maxLineLength = 10000;
	private readonly overflowThreshold = 5;

	constructor(config: BufferConfig = {}) {
		if (config.maxBufferSize) {
			this.bufferState.maxBufferSize = config.maxBufferSize;
		}
		logger.info('[STATUS] BufferManager initialized', {
			maxBufferSize: this.bufferState.maxBufferSize,
			maxLineLength: this.maxLineLength
		});
	}

	/** Process new data chunk from stdout */
	processDataChunk(
		data: Buffer | string,
		onLineProcessed: (parsedLine: ParsedLine) => void
	): void {
		const chunk = typeof data === 'string' ? data : data.toString();
		this.bufferState.totalBytesProcessed += chunk.length;
		this.bufferState.stdoutBuffer += chunk;

		if (this.bufferState.stdoutBuffer.length > this.bufferState.maxBufferSize) {
			this.handleBufferOverflow();
		}

		this.processCompleteLines(onLineProcessed);
	}

	private logPeriodicStats(): void {
		if (this.bufferState.lineCount % 1000 !== 0) return;
		logger.debug('[STATUS] Buffer processing stats', {
			linesProcessed: this.bufferState.lineCount,
			bytesProcessed: this.bufferState.totalBytesProcessed,
			bufferSize: this.bufferState.stdoutBuffer.length,
			overflows: this.bufferState.bufferOverflowCount
		});
	}

	/** Process complete lines from buffer */
	private processCompleteLines(onLineProcessed: (parsedLine: ParsedLine) => void): void {
		const lines = this.bufferState.stdoutBuffer.split('\n');
		this.bufferState.stdoutBuffer = lines.pop() || '';

		for (const line of lines) {
			if (!line.trim()) continue;
			this.bufferState.lineCount++;
			const parsed = parseLine(line, this.maxLineLength);
			onLineProcessed(parsed);
			this.logPeriodicStats();
		}
	}

	/** Handle buffer overflow */
	private handleBufferOverflow(): void {
		this.bufferState.bufferOverflowCount++;
		logger.warn('[STATUS] Buffer overflow detected', {
			bufferSize: this.bufferState.stdoutBuffer.length,
			maxSize: this.bufferState.maxBufferSize,
			overflowCount: this.bufferState.bufferOverflowCount
		});

		const keepSize = Math.floor(this.bufferState.maxBufferSize * 0.5);
		this.bufferState.stdoutBuffer = this.bufferState.stdoutBuffer.slice(-keepSize);

		if (this.bufferState.bufferOverflowCount >= this.overflowThreshold) {
			logger.warn('[WARN] Excessive buffer overflows detected', {
				overflowCount: this.bufferState.bufferOverflowCount,
				threshold: this.overflowThreshold,
				recommendation: 'Consider increasing buffer size or reducing data rate'
			});
		}
	}

	/** Get current buffer statistics */
	getBufferStats(): BufferState & {
		currentBufferLength: number;
		bufferUtilization: number;
		averageLineLength: number;
	} {
		const currentBufferLength = this.bufferState.stdoutBuffer.length;
		const bufferUtilization = (currentBufferLength / this.bufferState.maxBufferSize) * 100;
		const averageLineLength =
			this.bufferState.lineCount > 0
				? this.bufferState.totalBytesProcessed / this.bufferState.lineCount
				: 0;

		return {
			...this.bufferState,
			currentBufferLength,
			bufferUtilization,
			averageLineLength
		};
	}

	/** Clear buffer and reset stats */
	clearBuffer(): void {
		const oldStats = this.getBufferStats();
		this.bufferState.stdoutBuffer = '';
		this.bufferState.bufferOverflowCount = 0;
		this.bufferState.lineCount = 0;
		this.bufferState.totalBytesProcessed = 0;

		logger.info('[CLEANUP] Buffer cleared', {
			previousStats: {
				lineCount: oldStats.lineCount,
				totalBytes: oldStats.totalBytesProcessed,
				overflows: oldStats.bufferOverflowCount
			}
		});
	}

	/** Update buffer configuration */
	updateConfig(config: BufferConfig): void {
		if (config.maxBufferSize) {
			this.bufferState.maxBufferSize = config.maxBufferSize;
		}
		logger.info('[CONFIG] Buffer configuration updated', {
			maxBufferSize: this.bufferState.maxBufferSize
		});
	}

	/** Validate spectrum data quality (delegates to buffer-parser) */
	validateSpectrumData(data: SpectrumData): { isValid: boolean; issues: string[] } {
		return validateSpectrumData(data);
	}

	private collectHealthIssues(): { issues: string[]; recommendations: string[] } {
		const stats = this.getBufferStats();
		const issues: string[] = [];
		const recommendations: string[] = [];

		if (stats.bufferUtilization > 90) {
			issues.push('High buffer utilization');
			recommendations.push('Increase buffer size or reduce data rate');
		}
		if (stats.bufferOverflowCount > this.overflowThreshold) {
			issues.push('Excessive buffer overflows');
			recommendations.push('Increase buffer size');
		}
		if (stats.lineCount > 0 && stats.averageLineLength > 1000) {
			issues.push('Very long average line length');
			recommendations.push('Check data format');
		}
		return { issues, recommendations };
	}

	private deriveHealthStatus(): 'healthy' | 'warning' | 'critical' {
		const stats = this.getBufferStats();
		const isCritical =
			stats.bufferUtilization > 95 || stats.bufferOverflowCount > this.overflowThreshold * 2;
		return isCritical ? 'critical' : 'warning';
	}

	/** Get buffer health status */
	getHealthStatus(): {
		status: 'healthy' | 'warning' | 'critical';
		issues: string[];
		recommendations: string[];
	} {
		const { issues, recommendations } = this.collectHealthIssues();
		const status = issues.length === 0 ? 'healthy' : this.deriveHealthStatus();
		return { status, issues, recommendations };
	}

	/** Parse spectrum line (alias for parseLine) */
	parseSpectrumLine(line: string): ParsedLine {
		return parseLine(line, this.maxLineLength);
	}

	/** Clean up resources */
	cleanup(): void {
		this.clearBuffer();
		logger.info('[CLEANUP] BufferManager cleanup completed');
	}
}
