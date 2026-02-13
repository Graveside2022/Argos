/**
 * Canonical system information type definitions.
 * Used by stores/tactical-map/system-store and tactical-map pages.
 */

export interface SystemInfo {
	hostname: string;
	ip: string;
	tailscaleIp: string | null;
	wifiInterfaces: Array<{
		name: string;
		ip: string;
		mac: string;
	}>;
	cpu: {
		usage: number;
		model: string;
		cores: number;
	};
	memory: {
		total: number;
		used: number;
		free?: number;
		percentage: number;
	};
	storage: {
		total: number;
		used: number;
		free?: number;
		percentage: number;
	};
	temperature: number | null;
	uptime: number;
	battery?: {
		level: number;
		charging: boolean;
	};
}
