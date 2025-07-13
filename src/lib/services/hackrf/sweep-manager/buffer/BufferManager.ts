import { logInfo, logError, logWarn, logDebug } from '$lib/utils/logger';
import type { SpectrumData } from '$lib/server/hackrf/types';

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

export interface ParsedLine {
	data: SpectrumData | null;
	isValid: boolean;
	rawLine: string;
	parseError?: string;
}

/**
 * Manages HackRF stdout buffer processing and data parsing
 */
export class BufferManager {
	private bufferState: BufferState = {
		stdoutBuffer: '',
		maxBufferSize: 1024 * 1024, // 1MB default
		bufferOverflowCount: 0,
		lineCount: 0,
		totalBytesProcessed: 0
	};

	private readonly maxLineLength = 10000; // Maximum line length
	private readonly overflowThreshold = 5; // Max overflow events before warning

	constructor(config: BufferConfig = {}) {
		if (config.maxBufferSize) {
			this.bufferState.maxBufferSize = config.maxBufferSize;
		}
		
		logInfo('📊 BufferManager initialized', {
			maxBufferSize: this.bufferState.maxBufferSize,
			maxLineLength: this.maxLineLength
		});
	}

	/**
	 * Process new data chunk from stdout
	 */
	processDataChunk(
		data: Buffer | string,
		onLineProcessed: (parsedLine: ParsedLine) => void
	): void {
		const chunk = typeof data === 'string' ? data : data.toString();
		this.bufferState.totalBytesProcessed += chunk.length;

		// Add to buffer
		this.bufferState.stdoutBuffer += chunk;

		// Check buffer size
		if (this.bufferState.stdoutBuffer.length > this.bufferState.maxBufferSize) {
			this.handleBufferOverflow();
		}

		// Process complete lines
		this.processCompleteLines(onLineProcessed);
	}

	/**
	 * Process complete lines from buffer
	 */
	private processCompleteLines(onLineProcessed: (parsedLine: ParsedLine) => void): void {
		const lines = this.bufferState.stdoutBuffer.split('\n');
		
		// Keep the last incomplete line in buffer
		this.bufferState.stdoutBuffer = lines.pop() || '';

		for (const line of lines) {
			if (line.trim()) {
				this.bufferState.lineCount++;
				const parsedLine = this.parseLine(line);
				onLineProcessed(parsedLine);

				// Log processing stats periodically
				if (this.bufferState.lineCount % 1000 === 0) {
					logDebug('📊 Buffer processing stats', {
						linesProcessed: this.bufferState.lineCount,
						bytesProcessed: this.bufferState.totalBytesProcessed,
						bufferSize: this.bufferState.stdoutBuffer.length,
						overflows: this.bufferState.bufferOverflowCount
					});
				}
			}
		}
	}

	/**
	 * Parse a single line of HackRF output
	 */
	private parseLine(line: string): ParsedLine {
		const trimmedLine = line.trim();

		// Check line length
		if (trimmedLine.length > this.maxLineLength) {
			logWarn('Line too long, truncating', { 
				length: trimmedLine.length, 
				maxLength: this.maxLineLength 
			});
			return {
				data: null,
				isValid: false,
				rawLine: trimmedLine.substring(0, 100) + '...',
				parseError: 'Line too long'
			};
		}

		try {
			// Skip non-data lines
			if (this.isNonDataLine(trimmedLine)) {
				return {
					data: null,
					isValid: false,
					rawLine: trimmedLine,
					parseError: 'Non-data line'
				};
			}

			// Parse spectrum data
			const spectrumData = this.parseSpectrumData(trimmedLine);
			
			if (spectrumData) {
				return {
					data: spectrumData,
					isValid: true,
					rawLine: trimmedLine
				};
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
	 * Check if line is non-data (debug, info, error messages)
	 */
	private isNonDataLine(line: string): boolean {
		const nonDataPatterns = [
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

		return nonDataPatterns.some(pattern => pattern.test(line));
	}

	/**
	 * Parse spectrum data from HackRF output line
	 */
	private parseSpectrumData(line: string): SpectrumData | null {
		try {
			// Expected format: timestamp, freq_hz, freq_hz, power_db, power_db, ...
			// Example: 2023-11-20, 15:30:45, 88000000, 89000000, -45.2, -46.1, -47.0, ...
			
			const parts = line.split(',').map(part => part.trim());
			
			if (parts.length < 5) {
				return null; // Not enough data
			}

			// Parse timestamp (first two parts: date and time)
			const dateStr = parts[0];
			const timeStr = parts[1];
			const timestamp = this.parseTimestamp(dateStr, timeStr);

			// Parse frequency range
			const startFreq = parseInt(parts[2]);
			const endFreq = parseInt(parts[3]);

			if (isNaN(startFreq) || isNaN(endFreq)) {
				return null;
			}

			// Parse power values (remaining parts)
			const powerValues: number[] = [];
			for (let i = 4; i < parts.length; i++) {
				const power = parseFloat(parts[i]);
				if (!isNaN(power)) {
					powerValues.push(power);
				}
			}

			if (powerValues.length === 0) {
				return null;
			}

			// Calculate frequency step
			const _frequencyStep = powerValues.length > 1 
				? (endFreq - startFreq) / (powerValues.length - 1) 
				: 0;

			// Create spectrum data
			const spectrumData: SpectrumData = {
				timestamp: new Date(timestamp),
				frequency: startFreq + (endFreq - startFreq) / 2, // Center frequency
				power: Math.max(...powerValues), // Peak power
				unit: 'MHz',
				startFreq,
				endFreq,
				powerValues,
				metadata: {
					sampleCount: powerValues.length,
					minPower: Math.min(...powerValues),
					maxPower: Math.max(...powerValues),
					avgPower: powerValues.reduce((sum, val) => sum + val, 0) / powerValues.length
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
	 * Parse timestamp from date and time strings
	 */
	private parseTimestamp(dateStr: string, timeStr: string): Date {
		try {
			// Try to parse the timestamp
			const fullTimestamp = `${dateStr} ${timeStr}`;
			const parsedDate = new Date(fullTimestamp);
			
			// If parsing fails, use current time
			if (isNaN(parsedDate.getTime())) {
				return new Date();
			}
			
			return parsedDate;
		} catch {
			return new Date(); // Fallback to current time
		}
	}

	/**
	 * Handle buffer overflow
	 */
	private handleBufferOverflow(): void {
		this.bufferState.bufferOverflowCount++;
		
		logWarn('📊 Buffer overflow detected', {
			bufferSize: this.bufferState.stdoutBuffer.length,
			maxSize: this.bufferState.maxBufferSize,
			overflowCount: this.bufferState.bufferOverflowCount
		});

		// Keep only the last portion of the buffer
		const keepSize = Math.floor(this.bufferState.maxBufferSize * 0.5);
		this.bufferState.stdoutBuffer = this.bufferState.stdoutBuffer.slice(-keepSize);

		// Log warning if too many overflows
		if (this.bufferState.bufferOverflowCount >= this.overflowThreshold) {
			logError('⚠️ Excessive buffer overflows detected', {
				overflowCount: this.bufferState.bufferOverflowCount,
				threshold: this.overflowThreshold,
				recommendation: 'Consider increasing buffer size or reducing data rate'
			});
		}
	}

	/**
	 * Get current buffer statistics
	 */
	getBufferStats(): BufferState & {
		currentBufferLength: number;
		bufferUtilization: number;
		averageLineLength: number;
	} {
		const currentBufferLength = this.bufferState.stdoutBuffer.length;
		const bufferUtilization = (currentBufferLength / this.bufferState.maxBufferSize) * 100;
		const averageLineLength = this.bufferState.lineCount > 0 
			? this.bufferState.totalBytesProcessed / this.bufferState.lineCount 
			: 0;

		return {
			...this.bufferState,
			currentBufferLength,
			bufferUtilization,
			averageLineLength
		};
	}

	/**
	 * Clear buffer and reset stats
	 */
	clearBuffer(): void {
		const oldStats = this.getBufferStats();
		
		this.bufferState.stdoutBuffer = '';
		this.bufferState.bufferOverflowCount = 0;
		this.bufferState.lineCount = 0;
		this.bufferState.totalBytesProcessed = 0;

		logInfo('🧹 Buffer cleared', {
			previousStats: {
				lineCount: oldStats.lineCount,
				totalBytes: oldStats.totalBytesProcessed,
				overflows: oldStats.bufferOverflowCount
			}
		});
	}

	/**
	 * Update buffer configuration
	 */
	updateConfig(config: BufferConfig): void {
		if (config.maxBufferSize) {
			this.bufferState.maxBufferSize = config.maxBufferSize;
		}

		logInfo('⚙️ Buffer configuration updated', {
			maxBufferSize: this.bufferState.maxBufferSize
		});
	}

	/**
	 * Validate spectrum data quality
	 */
	validateSpectrumData(data: SpectrumData): {
		isValid: boolean;
		issues: string[];
	} {
		const issues: string[] = [];

		// Check frequency range
		if (data.startFreq !== undefined && data.endFreq !== undefined && data.startFreq >= data.endFreq) {
			issues.push('Invalid frequency range');
		}

		// Check power values
		if (data.powerValues && data.powerValues.length === 0) {
			issues.push('No power values');
		}

		// Check for reasonable power values (-150 to +50 dBm)
		if (data.powerValues) {
			const unreasonablePowers = data.powerValues.filter(p => p < -150 || p > 50);
			if (unreasonablePowers.length > 0) {
				issues.push(`${unreasonablePowers.length} unreasonable power values`);
			}

			// Check for too many identical values (potential stuck device)
			const uniqueValues = new Set(data.powerValues);
			if (uniqueValues.size === 1 && data.powerValues.length > 10) {
				issues.push('All power values identical (possible stuck device)');
			}
		}

		// Check timestamp validity
		const now = Date.now();
		const dataTime = data.timestamp.getTime();
		if (Math.abs(now - dataTime) > 60000) { // More than 1 minute off
			issues.push('Timestamp far from current time');
		}

		return {
			isValid: issues.length === 0,
			issues
		};
	}

	/**
	 * Get buffer health status
	 */
	getHealthStatus(): {
		status: 'healthy' | 'warning' | 'critical';
		issues: string[];
		recommendations: string[];
	} {
		const stats = this.getBufferStats();
		const issues: string[] = [];
		const recommendations: string[] = [];

		// Check buffer utilization
		if (stats.bufferUtilization > 90) {
			issues.push('High buffer utilization');
			recommendations.push('Increase buffer size or reduce data rate');
		}

		// Check overflow count
		if (stats.bufferOverflowCount > this.overflowThreshold) {
			issues.push('Excessive buffer overflows');
			recommendations.push('Increase buffer size');
		}

		// Check processing rate
		if (stats.lineCount > 0 && stats.averageLineLength > 1000) {
			issues.push('Very long average line length');
			recommendations.push('Check data format');
		}

		// Determine status
		let status: 'healthy' | 'warning' | 'critical' = 'healthy';
		if (issues.length > 0) {
			status = stats.bufferUtilization > 95 || stats.bufferOverflowCount > this.overflowThreshold * 2 
				? 'critical' 
				: 'warning';
		}

		return { status, issues, recommendations };
	}

	/**
	 * Parse spectrum line (alias for existing parseLine method)
	 */
	parseSpectrumLine(line: string): ParsedLine {
		return this.parseLine(line);
	}

	/**
	 * Clean up resources
	 */
	cleanup(): void {
		this.clearBuffer();
		logInfo('🧹 BufferManager cleanup completed');
	}
}