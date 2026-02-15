import { GPSApiResponseSchema } from '$lib/schemas/rf';
import { gpsStore, updateGPSPosition, updateGPSStatus } from '$lib/stores/tactical-map/gps-store';
import { detectCountry, formatCoordinates } from '$lib/utils/country-detector';
import { latLonToMGRS } from '$lib/utils/mgrs-converter';
import { safeParseWithHandling } from '$lib/utils/validation-error';

// Re-export for backward compatibility (barrel and consumers that import from this module)
export type { GPSApiResponse, GPSPositionData } from '$lib/gps/types';

export class GPSService {
	private positionInterval: NodeJS.Timeout | null = null;
	private readonly UPDATE_INTERVAL = 2000; // 2 seconds

	async updateGPSPosition(): Promise<void> {
		try {
			const response = await fetch('/api/gps/position');
			const rawData = await response.json();
			const result = safeParseWithHandling(GPSApiResponseSchema, rawData, 'background');

			if (!result) {
				console.error('Invalid GPS API response');
				updateGPSStatus({
					hasGPSFix: false,
					gpsStatus: 'GPS: Invalid Response',
					satellites: 0,
					fixType: 'No'
				});
				return;
			}

			if (
				result.success &&
				result.data &&
				result.data.latitude != null &&
				result.data.longitude != null
			) {
				const position = {
					lat: result.data.latitude,
					lon: result.data.longitude
				};

				const accuracy = result.data.accuracy || 0;
				const satellites = result.data.satellites || 0;
				const fix = result.data.fix || 0;
				const fixType = fix === 3 ? '3D' : fix === 2 ? '2D' : 'No';
				const gpsStatus = `GPS: ${fixType} Fix (${satellites} sats)`;
				const heading = result.data.heading ?? null;
				const speed = result.data.speed ?? null;

				// Update country and formatted coordinates
				const currentCountry = detectCountry(position.lat, position.lon);
				const formattedCoords = formatCoordinates(position.lat, position.lon);
				const mgrsCoord = latLonToMGRS(position.lat, position.lon);

				// Update stores
				updateGPSPosition(position);
				updateGPSStatus({
					hasGPSFix: fix >= 2,
					gpsStatus,
					accuracy,
					satellites,
					fixType,
					heading,
					speed,
					currentCountry,
					formattedCoords,
					mgrsCoord
				});
			} else {
				updateGPSStatus({
					hasGPSFix: false,
					gpsStatus: 'GPS: No Fix',
					satellites: 0,
					fixType: 'No'
				});
			}
		} catch (error) {
			console.error('GPS fetch error:', error);
			updateGPSStatus({
				hasGPSFix: false,
				gpsStatus: 'GPS: Error',
				satellites: 0,
				fixType: 'No'
			});
		}
	}

	startPositionUpdates(): void {
		if (this.positionInterval) return;

		// Initial update
		void this.updateGPSPosition();

		// Set up interval
		this.positionInterval = setInterval(() => {
			void this.updateGPSPosition();
		}, this.UPDATE_INTERVAL);
	}

	stopPositionUpdates(): void {
		if (this.positionInterval) {
			clearInterval(this.positionInterval);
			this.positionInterval = null;
		}
	}

	getCurrentPosition() {
		return gpsStore;
	}

	// Alias methods for compatibility
	startGPSTracking(): Promise<void> {
		this.startPositionUpdates();
		return Promise.resolve();
	}

	stopGPSTracking(): void {
		this.stopPositionUpdates();
	}
}
