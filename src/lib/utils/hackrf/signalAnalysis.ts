// Signal strength calculation and display utilities

export function calculateSignalStrength(dbLevel: number): string {
	if (dbLevel >= -30) return 'Very Strong';
	if (dbLevel >= -50) return 'Strong';
	if (dbLevel >= -70) return 'Moderate';
	if (dbLevel >= -85) return 'Weak';
	return 'No Signal';
}

export function getSignalColor(dbLevel: number): string {
	if (dbLevel >= -30) return '#22c55e'; // Very Strong - green
	if (dbLevel >= -50) return '#3b82f6'; // Strong - blue
	if (dbLevel >= -70) return '#f59e0b'; // Moderate - amber
	if (dbLevel >= -85) return '#ef4444'; // Weak - red
	return '#6b7280'; // No Signal - gray
}

export function updateSignalVisualization(
	dbLevel: number,
	indicatorFill: HTMLElement,
	currentIndicator: HTMLElement,
	currentValue: HTMLElement
) {
	// Normalize dB level to percentage (0-100%)
	const normalizedValue = Math.max(0, Math.min(100, ((dbLevel + 90) / 80) * 100));
	
	// Update fill width and color
	indicatorFill.style.width = `${normalizedValue}%`;
	
	// Create gradient based on signal strength
	const color = getSignalColor(dbLevel);
	indicatorFill.style.background = `linear-gradient(to right, ${color}33, ${color})`;
	
	// Update current indicator position
	currentIndicator.style.left = `${normalizedValue}%`;
	
	// Update current value display
	currentValue.textContent = `${dbLevel.toFixed(1)} dB`;
}

export function formatFrequency(freq: number): string {
	if (freq >= 1000) {
		return `${(freq / 1000).toFixed(3)} GHz`;
	}
	return `${freq.toFixed(3)} MHz`;
}

export function calculateFrequencyOffset(target: number, detected: number): string {
	const offset = detected - target;
	const sign = offset >= 0 ? '+' : '';
	return `${sign}${offset.toFixed(3)} MHz`;
}