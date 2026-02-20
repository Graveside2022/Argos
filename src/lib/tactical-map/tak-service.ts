import { get } from 'svelte/store';

import { takStatus } from '$lib/stores/tak-store';
import { logger } from '$lib/utils/logger';

export class TakService {
	private statusCheckInterval: ReturnType<typeof setInterval> | null = null;

	async checkTakStatus(): Promise<void> {
		try {
			const res = await fetch('/api/tak/connection');
			if (res.ok) {
				const takData = await res.json();
				if (takData.success && takData.status) {
					const currentTak = get(takStatus);
					if (currentTak.status !== takData.status) {
						takStatus.set({ status: takData.status } as any);
					}
				}
			}
		} catch (error) {
			logger.error('Error checking TAK status', { error });
		}
	}

	startPeriodicStatusCheck(): void {
		// Initial check
		void this.checkTakStatus();

		// Set up more frequent initial status checks, then slower periodic checks
		let initialCheckCount = 0;
		const initialCheckInterval = setInterval(() => {
			void this.checkTakStatus();
			initialCheckCount++;
			if (initialCheckCount >= 3) {
				clearInterval(initialCheckInterval);
				// Set up slower periodic status checks
				this.statusCheckInterval = setInterval(() => {
					void this.checkTakStatus();
				}, 5000);
			}
		}, 1000);
	}

	stopPeriodicChecks(): void {
		if (this.statusCheckInterval) {
			clearInterval(this.statusCheckInterval);
			this.statusCheckInterval = null;
		}
	}
}
