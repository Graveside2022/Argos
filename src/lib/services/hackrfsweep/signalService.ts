import { signalStore, signalActions, signalUtils, type SignalProcessingState } from '$lib/stores/hackrfsweep/signalStore';
import { displayStore, displayActions } from '$lib/stores/hackrfsweep/displayStore';
import { spectrumData, connectionStatus } from '$lib/stores/hackrf';
import { get } from 'svelte/store';

export class SignalService {
	private unsubscribeSpectrum?: () => void;
	private unsubscribeConnection?: () => void;
	private processingEnabled = false;

	constructor() {
		this.initialize();
	}

	private initialize(): void {
		// Subscribe to spectrum data updates
		this.unsubscribeSpectrum = spectrumData.subscribe(data => {
			if (this.processingEnabled && data) {
				this.processSpectrumData(data);
			}
		});

		// Subscribe to connection status
		this.unsubscribeConnection = connectionStatus.subscribe(status => {
			if (!status.connected) {
				this.stopProcessing();
			}
		});
	}

	// Main signal processing method
	private processSpectrumData(data: any): void {
		if (!data || typeof data !== 'object') return;

		// Extract signal data
		if ('peak_power' in data && data.peak_power !== undefined) {
			const peakPower = data.peak_power;
			const peakFreq = data.peak_freq || 0;

			// Update signal store
			signalActions.updateSignalData(peakFreq, peakPower);

			// Update display components
			this.updateSignalDisplays(peakPower, peakFreq);
		}
	}

	private updateSignalDisplays(peakPower: number, peakFreq: number): void {
		// Calculate signal strength
		const signalStrengthText = signalUtils.calculateSignalStrength(peakPower);
		const signalFillWidth = signalUtils.calculateSignalPercentage(peakPower) + '%';
		const dbIndicatorPosition = signalUtils.calculateSignalPercentage(peakPower) + '%';
		const dbCurrentValue = signalUtils.formatDbValue(peakPower);

		// Update signal analysis display
		displayActions.updateSignalAnalysis({
			dbLevelValue: peakPower.toFixed(2),
			signalStrengthText,
			signalFillWidth,
			dbIndicatorPosition,
			dbCurrentValue
		});

		// Update frequency information if valid
		this.updateFrequencyData(peakFreq);
	}

	private updateFrequencyData(detectedFreq: number): void {
		// Get current target frequency from display state
		const displayState = get(displayStore);
		const targetFreqStr = displayState.signalAnalysis.targetFrequency;
		const targetFreqMHz = parseFloat(targetFreqStr.replace(' MHz', ''));

		if (!isNaN(targetFreqMHz) && signalUtils.isValidSignalData(targetFreqMHz, detectedFreq)) {
			const detectedFreqStr = detectedFreq.toFixed(2) + ' MHz';
			const frequencyOffset = signalUtils.calculateFrequencyOffset(targetFreqMHz, detectedFreq);

			displayActions.updateSignalAnalysis({
				detectedFrequency: detectedFreqStr,
				frequencyOffset
			});
		}
	}

	// Signal processing control
	startProcessing(): void {
		this.processingEnabled = true;
		signalActions.setProcessingActive(true);
	}

	stopProcessing(): void {
		this.processingEnabled = false;
		signalActions.setProcessingActive(false);
	}

	// Reset signal processing
	resetSignalProcessing(): void {
		signalActions.resetSignalProcessing();
		displayActions.updateSignalAnalysis({
			dbLevelValue: '--.--',
			signalStrengthText: 'No Signal',
			detectedFrequency: '--',
			frequencyOffset: '--',
			signalFillWidth: '0%',
			dbIndicatorPosition: '0%',
			dbCurrentValue: '-90 dB'
		});
	}

	// Update signal indicator UI elements
	updateSignalIndicatorUI(dbValue: number): void {
		// Update visual elements based on signal strength
		const gradientClass = signalUtils.getSignalGradientClass(dbValue);
		const percentage = signalUtils.calculateSignalPercentage(dbValue);

		// Update signal fill element
		const fill = document.getElementById('signalIndicatorFill');
		if (fill) {
			fill.className = `signal-indicator-fill h-full transition-[width] duration-300 ease-in-out relative z-[1] rounded-md ${gradientClass}`;
			fill.style.width = percentage + '%';
		}

		// Update position indicator
		const indicator = document.getElementById('dbCurrentIndicator');
		if (indicator) {
			indicator.style.left = percentage + '%';
		}

		// Update value display
		const valueDisplay = document.getElementById('dbCurrentValue');
		if (valueDisplay) {
			valueDisplay.textContent = signalUtils.formatDbValue(dbValue);
		}
	}

	// Get current signal analysis
	getCurrentSignalState(): SignalProcessingState {
		return get(signalStore);
	}

	// Frequency switching support
	handleFrequencySwitch(): void {
		// Clear stale signal data during frequency switches
		displayActions.updateSignalAnalysis({
			dbLevelValue: '--.--',
			signalStrengthText: 'Switching...',
			detectedFrequency: '--',
			frequencyOffset: '--'
		});
		
		// Reset signal indicator to minimum
		this.updateSignalIndicatorUI(-100);
	}

	// Signal validation
	validateSignalData(targetFreq: number, detectedFreq: number): boolean {
		return signalUtils.isValidSignalData(targetFreq, detectedFreq);
	}

	// Get signal metrics
	getSignalMetrics() {
		const state = get(signalStore);
		return state.analysisMetrics;
	}

	// Cleanup
	destroy(): void {
		this.stopProcessing();
		if (this.unsubscribeSpectrum) {
			this.unsubscribeSpectrum();
		}
		if (this.unsubscribeConnection) {
			this.unsubscribeConnection();
		}
	}
}

// Create service instance
export const signalService = new SignalService();

// Helper functions for components
export const signalHelpers = {
	startProcessing: () => signalService.startProcessing(),
	stopProcessing: () => signalService.stopProcessing(),
	resetProcessing: () => signalService.resetSignalProcessing(),
	updateIndicatorUI: (dbValue: number) => signalService.updateSignalIndicatorUI(dbValue),
	handleFrequencySwitch: () => signalService.handleFrequencySwitch(),
	getCurrentState: () => signalService.getCurrentSignalState(),
	getMetrics: () => signalService.getSignalMetrics(),
	validateSignal: (targetFreq: number, detectedFreq: number) => 
		signalService.validateSignalData(targetFreq, detectedFreq)
};