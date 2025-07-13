import { gpsStore, updateGPSPosition, updateGPSStatus } from '$lib/stores/tactical-map/gpsStore';
import { detectCountry, formatCoordinates } from '$lib/utils/countryDetector';
import { latLonToMGRS } from '$lib/utils/mgrsConverter';

export interface GPSPositionData {
	latitude: number;
	longitude: number;
	altitude?: number | null;
	speed?: number | null;
	heading?: number | null;
	accuracy?: number;
	satellites?: number;
	fix?: number;
	time?: string;
}

export interface GPSApiResponse {
	success: boolean;
	data?: GPSPositionData;
	error?: string;
	mode?: number;
	details?: string;
}

export class GPSService {
	private positionInterval: NodeJS.Timeout | null = null;
	private readonly UPDATE_INTERVAL = 2000; // 2 seconds

	async updateGPSPosition(): Promise<void> {
		try {
			const response = await fetch('/api/gps/position');
			const result = (await response.json()) as GPSApiResponse;

			if (result.success && result.data) {
				const position = {
					lat: result.data.latitude,
					lon: result.data.longitude
				};

				const accuracy = result.data.accuracy || 0;
				const satellites = result.data.satellites || 0;
				const fix = result.data.fix || 0;
				const fixType = fix === 3 ? '3D' : fix === 2 ? '2D' : 'No';
				const gpsStatus = `GPS: ${fixType} Fix (${satellites} sats)`;

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
					currentCountry,
					formattedCoords,
					mgrsCoord
				});
			} else {
				updateGPSStatus({ gpsStatus: 'GPS: No Fix' });
			}
		} catch (error) {
			console.error('GPS fetch error:', error);
			updateGPSStatus({ gpsStatus: 'GPS: Error' });
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