import { takStatus } from '$lib/stores/tak-store';
import type { TakStatus } from '$lib/types/tak';
import { fetchJSON } from '$lib/utils/fetch-json';

export class TakService {
	private statusCheckInterval: ReturnType<typeof setInterval> | null = null;
	private _earlyCheckHandle: ReturnType<typeof setTimeout> | null = null;

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
		// Initial check immediately on mount
		void this.checkTakStatus();

		// One follow-up at 5s to confirm connection state, then steady 10s polling.
		// Replaces the old 3 × 1s burst that hammered the Pi on every page load.
		this._earlyCheckHandle = setTimeout(() => {
			void this.checkTakStatus();
			this.statusCheckInterval = setInterval(() => {
				void this.checkTakStatus();
			}, 10_000);
		}, 5000);
	}

	stopPeriodicChecks(): void {
		if (this._earlyCheckHandle) {
			clearTimeout(this._earlyCheckHandle);
			this._earlyCheckHandle = null;
		}

		if (this.statusCheckInterval) {
			clearInterval(this.statusCheckInterval);
			this.statusCheckInterval = null;
		}
	}
}
