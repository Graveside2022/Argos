import { reverseGeocode } from '$lib/components/dashboard/status/status-bar-data';
import { GPSApiResponseSchema } from '$lib/schemas/rf';
import { gpsStore, updateGPSPosition, updateGPSStatus } from '$lib/stores/tactical-map/gps-store';
import { detectCountry, formatCoordinates } from '$lib/utils/country-detector';
import { logger } from '$lib/utils/logger';
import { latLonToMGRS } from '$lib/utils/mgrs-converter';
import { safeParseWithHandling } from '$lib/utils/validation-error';

// Re-export for backward compatibility (barrel and consumers that import from this module)
export type { GPSApiResponse, GPSPositionData } from '$lib/gps/types';

export class GPSService {
	private positionInterval: NodeJS.Timeout | null = null;
	private readonly UPDATE_INTERVAL = 2000; // 2 seconds
	private lastGeoLat = 0;
	private lastGeoLon = 0;
	private cachedLocationName = '';

	/** Convert fix code to human-readable fix type */
	private static resolveFixType(fix: number): string {
		const FIX_TYPES: Record<number, string> = { 3: '3D', 2: '2D' };
		return FIX_TYPES[fix] ?? 'No';
	}

	/** Set the GPS status to a no-data state */
	private static setNoDataStatus(gpsStatus: string): void {
		updateGPSStatus({ hasGPSFix: false, gpsStatus, satellites: 0, fixType: 'No' });
	}

	/** Returns true if the parsed result contains valid coordinates */
	private static hasValidCoords(result: {
		success: boolean;
		data?: { latitude?: number | null; longitude?: number | null };
	}): boolean {
		return Boolean(
			result.success &&
				result.data &&
				result.data.latitude != null &&
				result.data.longitude != null
		);
	}

	/** Default values for optional GPS fields */
	private static readonly GPS_FIELD_DEFAULTS = {
		accuracy: 0,
		satellites: 0,
		fix: 0,
		heading: null as number | null,
		speed: null as number | null
	};

	/** Process a valid GPS fix into store updates */
	private applyGPSFix(data: {
		latitude: number;
		longitude: number;
		altitude?: number | null;
		accuracy?: number;
		satellites?: number;
		fix?: number;
		heading?: number | null;
		speed?: number | null;
	}): void {
		const position = { lat: data.latitude, lon: data.longitude };
		const d = { ...GPSService.GPS_FIELD_DEFAULTS, ...data };
		const fixType = GPSService.resolveFixType(d.fix);

		const locationName = this.cachedLocationName;
		const flag = detectCountry(position.lat, position.lon).flag;

		updateGPSPosition(position);
		updateGPSStatus({
			hasGPSFix: d.fix >= 2,
			gpsStatus: `GPS: ${fixType} Fix (${d.satellites} sats)`,
			accuracy: d.accuracy,
			satellites: d.satellites,
			fixType,
			heading: d.heading,
			speed: d.speed,
			altitude: data.altitude ?? null,
			currentCountry: { name: locationName, flag },
			formattedCoords: formatCoordinates(position.lat, position.lon),
			mgrsCoord: latLonToMGRS(position.lat, position.lon)
		});

		// Fire async reverse geocode — updates store when resolved
		void this.updateLocationName(position.lat, position.lon);
	}

	/** Call reverse geocode API and update store with city name. */
	private async updateLocationName(lat: number, lon: number): Promise<void> {
		const name = await reverseGeocode(
			lat,
			lon,
			this.lastGeoLat,
			this.lastGeoLon,
			this.cachedLocationName !== ''
		);
		if (name) {
			this.cachedLocationName = name;
			this.lastGeoLat = lat;
			this.lastGeoLon = lon;
			updateGPSStatus({ currentCountry: { name, flag: detectCountry(lat, lon).flag } });
		}
	}

	async updateGPSPosition(): Promise<void> {
		try {
			const response = await fetch('/api/gps/position');
			const rawData = await response.json();
			const result = safeParseWithHandling(GPSApiResponseSchema, rawData, 'background');

			if (!result) {
				logger.error('Invalid GPS API response');
				GPSService.setNoDataStatus('GPS: Invalid Response');
				return;
			}

			if (!GPSService.hasValidCoords(result)) {
				GPSService.setNoDataStatus('GPS: No Fix');
				return;
			}

			this.applyGPSFix(
				result.data as { latitude: number; longitude: number; altitude?: number | null }
			);
		} catch (error) {
			logger.error('GPS fetch error', { error });
			GPSService.setNoDataStatus('GPS: Error');
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
