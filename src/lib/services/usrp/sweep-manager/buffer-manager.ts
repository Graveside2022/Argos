import type { SpectrumData } from "$lib/server/hackrf/types";
import { logDebug,logError, logInfo, logWarn } from "$lib/utils/logger";

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
 * Manages USRP stdout buffer processing and data parsing
 * Handles various UHD output formats
 */
export class BufferManager {
	private bufferState: BufferState = {
		stdoutBuffer: "",
		maxBufferSize: 1024 * 1024, // 1MB default
		bufferOverflowCount: 0,
		lineCount: 0,
		totalBytesProcessed: 0,
	};

	private readonly maxLineLength = 10000; // Maximum line length
	private readonly overflowThreshold = 5; // Max overflow events before warning

	constructor(config: BufferConfig = {}) {
		if (config.maxBufferSize) {
			this.bufferState.maxBufferSize = config.maxBufferSize;
		}

		logInfo("[STATUS] USRP BufferManager initialized", {
			maxBufferSize: this.bufferState.maxBufferSize,
			maxLineLength: this.maxLineLength,
		});
	}

	/**
	 * Process new data chunk from stdout
	 */
	processDataChunk(
		data: Buffer | string,
		onLineProcessed: (parsedLine: ParsedLine) => void,
	): void {
		const chunk = typeof data === "string" ? data : data.toString();
		this.bufferState.totalBytesProcessed += chunk.length;

		// Add to buffer
		this.bufferState.stdoutBuffer += chunk;

		// Check buffer size
		if (
			this.bufferState.stdoutBuffer.length >
			this.bufferState.maxBufferSize
		) {
			this.handleBufferOverflow();
		}

		// Process complete lines
		this.processCompleteLines(onLineProcessed);
	}

	/**
	 * Process complete lines from buffer
	 */
	private processCompleteLines(
		onLineProcessed: (parsedLine: ParsedLine) => void,
	): void {
		const lines = this.bufferState.stdoutBuffer.split("\n");

		// Keep the last incomplete line in buffer
		this.bufferState.stdoutBuffer = lines.pop() || "";

		for (const line of lines) {
			if (line.trim()) {
				this.bufferState.lineCount++;
				const parsedLine = this.parseLine(line);
				onLineProcessed(parsedLine);

				// Log processing stats periodically
				if (this.bufferState.lineCount % 1000 === 0) {
					logDebug("[STATUS] USRP Buffer processing stats", {
						linesProcessed: this.bufferState.lineCount,
						bytesProcessed: this.bufferState.totalBytesProcessed,
						bufferSize: this.bufferState.stdoutBuffer.length,
						overflows: this.bufferState.bufferOverflowCount,
					});
				}
			}
		}
	}

	/**
	 * Parse a single line of USRP/UHD output
	 */
	private parseLine(line: string): ParsedLine {
		const trimmedLine = line.trim();

		// Check line length
		if (trimmedLine.length > this.maxLineLength) {
			logWarn("Line too long, truncating", {
				length: trimmedLine.length,
				maxLength: this.maxLineLength,
			});
			return {
				data: null,
				isValid: false,
				rawLine: trimmedLine.substring(0, 100) + "...",
				parseError: "Line too long",
			};
		}

		try {
			// Skip non-data lines
			if (this.isNonDataLine(trimmedLine)) {
				return {
					data: null,
					isValid: false,
					rawLine: trimmedLine,
					parseError: "Non-data line",
				};
			}

			// Log potential data lines for debugging
			if (
				(trimmedLine.includes(",") || trimmedLine.includes(":")) &&
				trimmedLine.length > 20
			) {
				logInfo("[SEARCH] USRP POTENTIAL DATA LINE:", {
					preview: trimmedLine.substring(0, 200),
				});
			}

			// Parse spectrum data based on format
			const spectrumData = this.parseSpectrumData(trimmedLine);

			if (spectrumData) {
				return {
					data: spectrumData,
					isValid: true,
					rawLine: trimmedLine,
				};
			} else {
				return {
					data: null,
					isValid: false,
					rawLine: trimmedLine,
					parseError: "Failed to parse spectrum data",
				};
			}
		} catch (error) {
			return {
				data: null,
				isValid: false,
				rawLine: trimmedLine,
				parseError:
					error instanceof Error ? error.message : String(error),
			};
		}
	}

	/**
	 * Check if line is non-data (debug, info, error messages)
	 */
	private isNonDataLine(line: string): boolean {
		const nonDataPatterns = [
			/^UHD:/,
			/^Creating the usrp device/,
			/^Using Device:/,
			/^Setting RX Rate:/,
			/^Setting RX Freq:/,
			/^Setting RX Gain:/,
			/^Streaming samples/,
			/^Stop with Ctrl-C/,
			/^No UHD Devices Found/,
			/^Error:/,
			/^Warning:/,
			/^Info:/,
			/^Debug:/,
			/^\[/, // UHD log lines often start with [
			/^--/, // Separator lines
		];

		return nonDataPatterns.some((pattern) => pattern.test(line));
	}

	/**
	 * Parse spectrum data from USRP/UHD output line
	 * Supports multiple formats based on the UHD tool being used
	 */
	private parseSpectrumData(line: string): SpectrumData | null {
		try {
			// Format 1: CSV format (frequency, power) - common for custom scripts
			if (line.includes(",") && !line.includes(":")) {
				const parts = line.split(",").map((part) => part.trim());

				if (parts.length >= 2) {
					const frequency = parseFloat(parts[0]);
					const power = parseFloat(parts[1]);

					if (!isNaN(frequency) && !isNaN(power)) {
						// Convert Hz to MHz if needed
						const freqMHz =
							frequency > 1e6 ? frequency / 1e6 : frequency;

						return {
							timestamp: new Date(),
							frequency: freqMHz,
							power: power,
							unit: "MHz",
							metadata: {
								sampleCount: 1,
								minPower: power,
								maxPower: power,
								avgPower: power,
							},
						};
					}
				}
			}

			// Format 2: JSON format - some UHD tools output JSON
			if (line.startsWith("{") && line.endsWith("}")) {
				try {
					const json = JSON.parse(line);
					if (json.frequency && json.power !== undefined) {
						const freqMHz =
							json.frequency > 1e6
								? json.frequency / 1e6
								: json.frequency;
						return {
							timestamp: new Date(json.timestamp || Date.now()),
							frequency: freqMHz,
							power: json.power,
							unit: "MHz",
							startFreq: json.start_freq
								? json.start_freq / 1e6
								: undefined,
							endFreq: json.stop_freq
								? json.stop_freq / 1e6
								: undefined,
							powerValues: json.power_values || [json.power],
							metadata: json.metadata || {
								sampleCount: 1,
								minPower: json.power,
								maxPower: json.power,
								avgPower: json.power,
							},
						};
					}
				} catch (_e) {
					// Not valid JSON, try other formats
				}
			}

			// Format 3: Key-value pairs (freq: X MHz, power: Y dBm)
			if (line.includes(":")) {
				const freqMatch = line.match(
					/freq(?:uency)?:\s*([\d.]+)\s*(MHz|GHz|Hz)?/i,
				);
				const powerMatch = line.match(
					/power:\s*([-\d.]+)\s*(dBm|dB)?/i,
				);

				if (freqMatch && powerMatch) {
					let frequency = parseFloat(freqMatch[1]);
					const power = parseFloat(powerMatch[1]);

					// Convert to MHz based on unit
					if (freqMatch[2]) {
						if (freqMatch[2].toLowerCase() === "ghz") {
							frequency *= 1000; // GHz to MHz
						} else if (freqMatch[2].toLowerCase() === "hz") {
							frequency /= 1e6; // Hz to MHz
						}
					}

					if (!isNaN(frequency) && !isNaN(power)) {
						return {
							timestamp: new Date(),
							frequency: frequency,
							power: power,
							unit: "MHz",
							metadata: {
								sampleCount: 1,
								minPower: power,
								maxPower: power,
								avgPower: power,
							},
						};
					}
				}
			}

			// Format 4: Space-separated values (used by some UHD examples)
			if (!line.includes(",") && !line.includes(":")) {
				const parts = line.split(/\s+/).filter((p) => p);
				if (parts.length >= 2) {
					const frequency = parseFloat(parts[0]);
					const power = parseFloat(parts[1]);

					if (!isNaN(frequency) && !isNaN(power)) {
						// Convert Hz to MHz if needed
						const freqMHz =
							frequency > 1e6 ? frequency / 1e6 : frequency;

						return {
							timestamp: new Date(),
							frequency: freqMHz,
							power: power,
							unit: "MHz",
							metadata: {
								sampleCount: 1,
								minPower: power,
								maxPower: power,
								avgPower: power,
							},
						};
					}
				}
			}

			return null;
		} catch (error) {
			logError("Error parsing USRP spectrum data", {
				error: error instanceof Error ? error.message : String(error),
				line: line.substring(0, 100) + (line.length > 100 ? "..." : ""),
			});
			return null;
		}
	}

	/**
	 * Handle buffer overflow
	 */
	private handleBufferOverflow(): void {
		this.bufferState.bufferOverflowCount++;

		logWarn("[STATUS] USRP Buffer overflow detected", {
			bufferSize: this.bufferState.stdoutBuffer.length,
			maxSize: this.bufferState.maxBufferSize,
			overflowCount: this.bufferState.bufferOverflowCount,
		});

		// Keep only the last portion of the buffer
		const keepSize = Math.floor(this.bufferState.maxBufferSize * 0.5);
		this.bufferState.stdoutBuffer =
			this.bufferState.stdoutBuffer.slice(-keepSize);

		// Log warning if too many overflows
		if (this.bufferState.bufferOverflowCount >= this.overflowThreshold) {
			logError("[WARN] Excessive USRP buffer overflows detected", {
				overflowCount: this.bufferState.bufferOverflowCount,
				threshold: this.overflowThreshold,
				recommendation:
					"Consider increasing buffer size or reducing data rate",
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
		const bufferUtilization =
			(currentBufferLength / this.bufferState.maxBufferSize) * 100;
		const averageLineLength =
			this.bufferState.lineCount > 0
				? this.bufferState.totalBytesProcessed /
					this.bufferState.lineCount
				: 0;

		return {
			...this.bufferState,
			currentBufferLength,
			bufferUtilization,
			averageLineLength,
		};
	}

	/**
	 * Clear buffer and reset stats
	 */
	clearBuffer(): void {
		const oldStats = this.getBufferStats();

		this.bufferState.stdoutBuffer = "";
		this.bufferState.bufferOverflowCount = 0;
		this.bufferState.lineCount = 0;
		this.bufferState.totalBytesProcessed = 0;

		logInfo("[CLEANUP] USRP Buffer cleared", {
			previousStats: {
				lineCount: oldStats.lineCount,
				totalBytes: oldStats.totalBytesProcessed,
				overflows: oldStats.bufferOverflowCount,
			},
		});
	}

	/**
	 * Update buffer configuration
	 */
	updateConfig(config: BufferConfig): void {
		if (config.maxBufferSize) {
			this.bufferState.maxBufferSize = config.maxBufferSize;
		}

		logInfo("[CONFIG] USRP Buffer configuration updated", {
			maxBufferSize: this.bufferState.maxBufferSize,
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
		if (
			data.startFreq !== undefined &&
			data.endFreq !== undefined &&
			data.startFreq >= data.endFreq
		) {
			issues.push("Invalid frequency range");
		}

		// Check power values
		if (data.powerValues && data.powerValues.length === 0) {
			issues.push("No power values");
		}

		// Check for reasonable power values (-150 to +50 dBm)
		if (data.powerValues) {
			const unreasonablePowers = data.powerValues.filter(
				(p) => p < -150 || p > 50,
			);
			if (unreasonablePowers.length > 0) {
				issues.push(
					`${unreasonablePowers.length} unreasonable power values`,
				);
			}

			// Check for too many identical values (potential stuck device)
			const uniqueValues = new Set(data.powerValues);
			if (uniqueValues.size === 1 && data.powerValues.length > 10) {
				issues.push(
					"All power values identical (possible stuck device)",
				);
			}
		}

		// Check timestamp validity
		const now = Date.now();
		const dataTime = data.timestamp.getTime();
		if (Math.abs(now - dataTime) > 60000) {
			// More than 1 minute off
			issues.push("Timestamp far from current time");
		}

		return {
			isValid: issues.length === 0,
			issues,
		};
	}

	/**
	 * Get buffer health status
	 */
	getHealthStatus(): {
		status: "healthy" | "warning" | "critical";
		issues: string[];
		recommendations: string[];
	} {
		const stats = this.getBufferStats();
		const issues: string[] = [];
		const recommendations: string[] = [];

		// Check buffer utilization
		if (stats.bufferUtilization > 90) {
			issues.push("High buffer utilization");
			recommendations.push("Increase buffer size or reduce data rate");
		}

		// Check overflow count
		if (stats.bufferOverflowCount > this.overflowThreshold) {
			issues.push("Excessive buffer overflows");
			recommendations.push("Increase buffer size");
		}

		// Check processing rate
		if (stats.lineCount > 0 && stats.averageLineLength > 1000) {
			issues.push("Very long average line length");
			recommendations.push("Check data format");
		}

		// Determine status
		let status: "healthy" | "warning" | "critical" = "healthy";
		if (issues.length > 0) {
			status =
				stats.bufferUtilization > 95 ||
				stats.bufferOverflowCount > this.overflowThreshold * 2
					? "critical"
					: "warning";
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
		logInfo("[CLEANUP] USRP BufferManager cleanup completed");
	}
}
