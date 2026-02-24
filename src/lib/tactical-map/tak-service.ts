import { takStatus } from '$lib/stores/tak-store';
import type { TakStatus } from '$lib/types/tak';
import { fetchJSON } from '$lib/utils/fetch-json';

export class TakService {
	private statusCheckInterval: ReturnType<typeof setInterval> | null = null;

	async checkTakStatus(): Promise<void> {
		const data = await fetchJSON<{ success: boolean; status?: string } & TakStatus>(
			'/api/tak/connection'
		);
		if (data?.success && data.status) {
			const { success: _success, ...rest } = data;
			takStatus.set(rest as TakStatus);
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
