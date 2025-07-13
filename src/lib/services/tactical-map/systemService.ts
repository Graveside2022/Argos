import type { SystemInfo } from '$lib/stores/tactical-map/systemStore';
import {
	systemStore,
	setSystemInfo,
	setSystemLoading,
	setSystemError,
	setAutoRefresh
} from '$lib/stores/tactical-map/systemStore';

export class SystemService {
	private refreshInterval: ReturnType<typeof setInterval> | null = null;

	async fetchSystemInfo(): Promise<SystemInfo | null> {
		setSystemLoading(true);
		
		try {
			const response = await fetch('/api/system/info');
			
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}
			
			const systemInfo = (await response.json()) as SystemInfo;
			setSystemInfo(systemInfo);
			
			return systemInfo;
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
			console.error('Error fetching system info:', errorMessage);
			setSystemError(errorMessage);
			return null;
		}
	}

	async fetchSystemMetrics(): Promise<any> {
		try {
			const response = await fetch('/api/system/metrics');
			
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}
			
			return await response.json();
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
			console.error('Error fetching system metrics:', errorMessage);
			throw error;
		}
	}

	startAutoRefresh(intervalMs: number = 30000): void {
		// Stop existing interval if running
		this.stopAutoRefresh();
		
		// Enable auto refresh in store
		setAutoRefresh(true, intervalMs);
		
		// Set up new interval
		this.refreshInterval = setInterval(async () => {
			await this.fetchSystemInfo();
		}, intervalMs);
		
		// Initial fetch
		void this.fetchSystemInfo();
	}

	stopAutoRefresh(): void {
		if (this.refreshInterval) {
			clearInterval(this.refreshInterval);
			this.refreshInterval = null;
		}
		
		// Disable auto refresh in store
		setAutoRefresh(false);
	}

	isAutoRefreshEnabled(): boolean {
		let enabled = false;
		const unsubscribe = systemStore.subscribe(state => {
			enabled = state.autoRefreshEnabled;
		});
		unsubscribe();
		return enabled;
	}

	getRefreshInterval(): number {
		let interval = 30000;
		const unsubscribe = systemStore.subscribe(state => {
			interval = state.refreshInterval;
		});
		unsubscribe();
		return interval;
	}

	// Utility methods for system analysis
	async getSystemHealth(): Promise<{
		status: 'good' | 'warning' | 'critical';
		issues: string[];
		recommendations: string[];
	}> {
		const systemInfo = await this.fetchSystemInfo();
		
		if (!systemInfo) {
			return {
				status: 'critical',
				issues: ['Unable to fetch system information'],
				recommendations: ['Check system API connectivity', 'Verify system service is running']
			};
		}

		const issues: string[] = [];
		const recommendations: string[] = [];
		let status: 'good' | 'warning' | 'critical' = 'good';

		// Check CPU usage
		if (systemInfo.cpu.usage > 90) {
			status = 'critical';
			issues.push(`Critical CPU usage: ${systemInfo.cpu.usage.toFixed(1)}%`);
			recommendations.push('Check for CPU-intensive processes');
		} else if (systemInfo.cpu.usage > 70 && status === 'good') {
			status = 'warning';
			issues.push(`High CPU usage: ${systemInfo.cpu.usage.toFixed(1)}%`);
		}

		// Check memory usage
		if (systemInfo.memory.percentage > 90) {
			status = 'critical';
			issues.push(`Critical memory usage: ${systemInfo.memory.percentage.toFixed(1)}%`);
			recommendations.push('Free up memory or restart memory-intensive services');
		} else if (systemInfo.memory.percentage > 70) {
			if (status !== 'critical') status = 'warning';
			issues.push(`High memory usage: ${systemInfo.memory.percentage.toFixed(1)}%`);
		}

		// Check storage usage
		if (systemInfo.storage.percentage > 90) {
			status = 'critical';
			issues.push(`Critical storage usage: ${systemInfo.storage.percentage}%`);
			recommendations.push('Free up disk space immediately');
		} else if (systemInfo.storage.percentage > 80) {
			if (status !== 'critical') status = 'warning';
			issues.push(`High storage usage: ${systemInfo.storage.percentage}%`);
			recommendations.push('Consider cleaning up old files');
		}

		// Check temperature
		if (systemInfo.temperature > 75) {
			status = 'critical';
			issues.push(`Critical temperature: ${systemInfo.temperature.toFixed(1)}°C`);
			recommendations.push('Check cooling system', 'Reduce system load');
		} else if (systemInfo.temperature > 65) {
			if (status !== 'critical') status = 'warning';
			issues.push(`High temperature: ${systemInfo.temperature.toFixed(1)}°C`);
			recommendations.push('Monitor temperature closely');
		}

		// Check battery if available
		if (systemInfo.battery) {
			if (systemInfo.battery.level < 10) {
				status = 'critical';
				issues.push(`Critical battery level: ${systemInfo.battery.level}%`);
				recommendations.push('Connect to power immediately');
			} else if (systemInfo.battery.level < 20) {
				if (status !== 'critical') status = 'warning';
				issues.push(`Low battery level: ${systemInfo.battery.level}%`);
				recommendations.push('Connect to power soon');
			}
		}

		return { status, issues, recommendations };
	}

	// Format system info for display
	formatSystemSummary(systemInfo: SystemInfo): string {
		const uptime = this.formatUptime(systemInfo.uptime);
		const health = this.getHealthIndicator(systemInfo);
		
		return `${health} ${systemInfo.hostname} | CPU: ${systemInfo.cpu.usage.toFixed(1)}% | Mem: ${systemInfo.memory.percentage.toFixed(1)}% | Temp: ${systemInfo.temperature.toFixed(1)}°C | Up: ${uptime}`;
	}

	private formatUptime(uptime: number): string {
		const days = Math.floor(uptime / 86400);
		const hours = Math.floor((uptime % 86400) / 3600);
		const minutes = Math.floor((uptime % 3600) / 60);
		
		if (days > 0) {
			return `${days}d ${hours}h`;
		} else if (hours > 0) {
			return `${hours}h ${minutes}m`;
		} else {
			return `${minutes}m`;
		}
	}

	private getHealthIndicator(systemInfo: SystemInfo): string {
		if (systemInfo.cpu.usage > 90 || systemInfo.memory.percentage > 90 || systemInfo.storage.percentage > 90 || systemInfo.temperature > 75) {
			return '🔴'; // Critical
		} else if (systemInfo.cpu.usage > 70 || systemInfo.memory.percentage > 70 || systemInfo.storage.percentage > 80 || systemInfo.temperature > 65) {
			return '🟡'; // Warning
		} else {
			return '🟢'; // Good
		}
	}

	// Clean up resources
	destroy(): void {
		this.stopAutoRefresh();
	}
}