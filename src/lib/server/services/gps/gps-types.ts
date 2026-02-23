/**
 * Shared types for GPS position services.
 * Extracted to break the circular dependency between gps-position-service.ts and gps-response-builder.ts.
 */

export interface GpsPositionResponse {
	success: boolean;
	data: {
		latitude: number | null;
		longitude: number | null;
		altitude: number | null;
		speed: number | null;
		heading: number | null;
		accuracy: number | null;
		satellites: number | null;
		fix: number;
		time: string | null;
	};
	error?: string;
	details?: string;
	mode?: number;
}
