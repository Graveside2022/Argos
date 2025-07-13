import { logError, logInfo } from '$lib/utils/logger';
import { wigleActions } from '$lib/stores/wigletotak/wigleStore';

// Type definitions for API responses
interface ApiResponse {
	status: string;
	message?: string;
}

interface TakSettingsResponse extends ApiResponse {
	data?: unknown;
}

interface MulticastStateResponse extends ApiResponse {
	enabled?: boolean;
}

interface AnalysisModeResponse extends ApiResponse {
	mode?: string;
}

interface AntennaSettingsResponse extends ApiResponse {
	antenna_type?: string;
	custom_factor?: number;
}

interface WigleFilesResponse extends ApiResponse {
	files?: string[];
}

interface BroadcastResponse extends ApiResponse {
	data?: unknown;
}

interface WhitelistResponse extends ApiResponse {
	data?: unknown;
}

interface BlacklistResponse extends ApiResponse {
	data?: unknown;
}

export class WigleService {
	private initialized = false;

	initialize(): void {
		if (this.initialized) return;
		this.initialized = true;
		logInfo('WigleService initialized');
	}

	destroy(): void {
		this.initialized = false;
		logInfo('WigleService destroyed');
	}

	// TAK Settings API calls
	async updateTakSettings(serverIp: string, serverPort: string): Promise<void> {
		try {
			const response = await fetch('/api/tak/settings', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					tak_server_ip: serverIp,
					tak_server_port: parseInt(serverPort)
				})
			});

			const data: TakSettingsResponse = await response.json();
			
			if (data.status === 'success') {
				logInfo('TAK settings updated successfully');
				wigleActions.updateTakSettings({ serverIp, serverPort });
			} else {
				throw new Error(data.message || 'Unknown error');
			}
		} catch (error) {
			logError('Failed to update TAK settings:', { error: error instanceof Error ? error.message : String(error) });
			throw error;
		}
	}

	async updateMulticastState(enabled: boolean): Promise<void> {
		try {
			const response = await fetch('/api/tak/multicast', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ enabled })
			});

			const data: MulticastStateResponse = await response.json();
			
			if (data.status === 'success') {
				logInfo(`Multicast ${enabled ? 'enabled' : 'disabled'} successfully`);
				wigleActions.updateTakSettings({ multicastEnabled: enabled });
			} else {
				throw new Error(data.message || 'Unknown error');
			}
		} catch (error) {
			logError('Failed to update multicast state:', { error: error instanceof Error ? error.message : String(error) });
			throw error;
		}
	}

	// Analysis Mode API calls
	async updateAnalysisMode(mode: string): Promise<void> {
		try {
			const response = await fetch('/api/tak/analysis-mode', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ mode })
			});

			const data: AnalysisModeResponse = await response.json();
			
			if (data.status === 'success') {
				logInfo(`Analysis mode set to: ${mode}`);
				wigleActions.updateAnalysisSettings({ mode });
			} else {
				throw new Error(data.message || 'Unknown error');
			}
		} catch (error) {
			logError('Failed to update analysis mode:', { error: error instanceof Error ? error.message : String(error) });
			throw error;
		}
	}

	// Antenna Settings API calls
	async updateAntennaSensitivity(antennaType: string, customSensitivity: string): Promise<void> {
		try {
			const response = await fetch('/api/tak/antenna', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					antenna_type: antennaType,
					custom_factor: parseFloat(customSensitivity)
				})
			});

			const data: AntennaSettingsResponse = await response.json();
			
			if (data.status === 'success') {
				logInfo(`Antenna settings updated: ${antennaType}, sensitivity: ${customSensitivity}`);
				wigleActions.updateAntennaSettings({ type: antennaType, customSensitivity });
			} else {
				throw new Error(data.message || 'Unknown error');
			}
		} catch (error) {
			logError('Failed to update antenna sensitivity:', { error: error instanceof Error ? error.message : String(error) });
			throw error;
		}
	}

	async loadAntennaSettings(): Promise<void> {
		try {
			const response = await fetch('/api/tak/antenna');
			const data: AntennaSettingsResponse = await response.json();
			
			if (data.status === 'success' && data.antenna_type && data.custom_factor !== undefined) {
				wigleActions.updateAntennaSettings({
					type: data.antenna_type,
					customSensitivity: data.custom_factor.toString()
				});
				logInfo('Antenna settings loaded');
			} else {
				throw new Error(data.message || 'Failed to load antenna settings');
			}
		} catch (error) {
			logError('Failed to load antenna settings:', { error: error instanceof Error ? error.message : String(error) });
			throw error;
		}
	}

	// Directory Management API calls
	async listWigleFiles(directory: string): Promise<void> {
		try {
			const response = await fetch('/api/wigle/files', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ directory })
			});

			const data: WigleFilesResponse = await response.json();
			
			if (data.status === 'success' && data.files) {
				wigleActions.updateDirectorySettings({ 
					wigleDirectory: directory,
					wigleFiles: data.files 
				});
				logInfo(`Found ${data.files.length} Wigle files`);
			} else {
				throw new Error(data.message || 'Failed to list files');
			}
		} catch (error) {
			logError('Failed to list Wigle files:', { error: error instanceof Error ? error.message : String(error) });
			throw error;
		}
	}

	// Broadcast Control API calls
	async startBroadcast(selectedFile: string): Promise<void> {
		try {
			const response = await fetch('/api/wigle/broadcast/start', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ file: selectedFile })
			});

			const data: BroadcastResponse = await response.json();
			
			if (data.status === 'success') {
				wigleActions.updateBroadcastState({ 
					isConnected: true, 
					isBroadcasting: true 
				});
				logInfo('Broadcast started successfully');
			} else {
				throw new Error(data.message || 'Failed to start broadcast');
			}
		} catch (error) {
			logError('Failed to start broadcast:', { error: error instanceof Error ? error.message : String(error) });
			throw error;
		}
	}

	async stopBroadcast(): Promise<void> {
		try {
			const response = await fetch('/api/wigle/broadcast/stop', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' }
			});

			const data: BroadcastResponse = await response.json();
			
			if (data.status === 'success') {
				wigleActions.updateBroadcastState({ 
					isConnected: false, 
					isBroadcasting: false 
				});
				logInfo('Broadcast stopped successfully');
			} else {
				throw new Error(data.message || 'Failed to stop broadcast');
			}
		} catch (error) {
			logError('Failed to stop broadcast:', { error: error instanceof Error ? error.message : String(error) });
			throw error;
		}
	}

	// Filter Management API calls
	async addToWhitelist(ssid: string, mac: string): Promise<void> {
		try {
			const response = await fetch('/api/wigle/whitelist', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ ssid, mac })
			});

			const data: WhitelistResponse = await response.json();
			
			if (data.status === 'success') {
				wigleActions.clearWhitelistFields();
				logInfo('Added to whitelist successfully');
			} else {
				throw new Error(data.message || 'Failed to add to whitelist');
			}
		} catch (error) {
			logError('Failed to add to whitelist:', { error: error instanceof Error ? error.message : String(error) });
			throw error;
		}
	}

	async addToBlacklist(ssid: string, mac: string, color: string): Promise<void> {
		try {
			const response = await fetch('/api/wigle/blacklist', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ ssid, mac, color })
			});

			const data: BlacklistResponse = await response.json();
			
			if (data.status === 'success') {
				wigleActions.clearBlacklistFields();
				logInfo('Added to blacklist successfully');
			} else {
				throw new Error(data.message || 'Failed to add to blacklist');
			}
		} catch (error) {
			logError('Failed to add to blacklist:', { error: error instanceof Error ? error.message : String(error) });
			throw error;
		}
	}
}

// Export singleton instance
export const wigleService = new WigleService();