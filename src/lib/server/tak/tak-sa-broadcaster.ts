/**
 * TAK SA (Situation Awareness) Broadcaster.
 *
 * Periodically sends this device's GPS position to the connected TAK server
 * as a CoT SA message, making the Pi visible on ATAK/WinTAK clients.
 *
 * Lifecycle: start() on TAK connect, stop() on TAK disconnect.
 * Requires GPS fix — skips broadcast silently when no fix is available.
 */
import CoT from '@tak-ps/node-cot';

import { logger } from '$lib/utils/logger';

import { getGpsPosition } from '../services/gps/gps-position-service';
import type { TakService } from './tak-service';

const BROADCAST_INTERVAL_MS = 30_000;
const STALE_DURATION_MS = 90_000;
const DEVICE_UID = 'ARGOS-1';
const DEVICE_CALLSIGN = 'ARGOS-1';
const COT_TYPE = 'a-f-G-U-C'; // atom-friendly-Ground-Unit-Combat
const COT_HOW = 'm-g'; // machine-GPS

export interface SaBroadcastStatus {
	broadcasting: boolean;
	lastBroadcastAt: string | null;
	broadcastCount: number;
}

/** Build a CoT SA message from current GPS position data. */
function buildSaCot(
	lat: number,
	lon: number,
	altitude: number | null,
	accuracy: number | null
): CoT {
	const now = new Date();
	const stale = new Date(now.getTime() + STALE_DURATION_MS);

	return new CoT({
		event: {
			_attributes: {
				version: '2.0',
				uid: DEVICE_UID,
				type: COT_TYPE,
				how: COT_HOW,
				time: now.toISOString(),
				start: now.toISOString(),
				stale: stale.toISOString()
			},
			point: {
				_attributes: {
					lat,
					lon,
					hae: altitude ?? 9999999,
					ce: accuracy ?? 9999999,
					le: 9999999
				}
			},
			detail: {
				contact: { _attributes: { callsign: DEVICE_CALLSIGN } },
				precisionlocation: { _attributes: { geopointsrc: 'GPS', altsrc: 'GPS' } },
				__group: { _attributes: { name: 'Cyan', role: 'Team Member' } }
			}
		}
	});
}

export class TakSaBroadcaster {
	private intervalId: NodeJS.Timeout | null = null;
	private takService: TakService;
	private _broadcastCount = 0;
	private _lastBroadcastAt: number | null = null;

	constructor(takService: TakService) {
		this.takService = takService;
	}

	/** Start periodic SA broadcasts. Idempotent — calling while running is a no-op. */
	start(): void {
		if (this.intervalId) return;
		logger.info('[SA-Broadcaster] Starting periodic SA broadcasts every 30s');
		// Broadcast immediately, then every interval
		void this.broadcast();
		this.intervalId = setInterval(() => void this.broadcast(), BROADCAST_INTERVAL_MS);
	}

	/** Stop periodic SA broadcasts. Idempotent. */
	stop(): void {
		if (!this.intervalId) return;
		clearInterval(this.intervalId);
		this.intervalId = null;
		logger.info('[SA-Broadcaster] Stopped SA broadcasts', {
			totalBroadcasts: this._broadcastCount
		});
	}

	/** Get current broadcast status for API/UI consumption. */
	getStatus(): SaBroadcastStatus {
		return {
			broadcasting: this.intervalId !== null,
			lastBroadcastAt: this._lastBroadcastAt
				? new Date(this._lastBroadcastAt).toISOString()
				: null,
			broadcastCount: this._broadcastCount
		};
	}

	/** Fetch GPS and send CoT if valid fix. Returns true if sent. */
	private async trySendPosition(): Promise<boolean> {
		const gps = await getGpsPosition();
		if (!gps.success || !gps.data.latitude || !gps.data.longitude) return false;

		const cot = buildSaCot(
			gps.data.latitude,
			gps.data.longitude,
			gps.data.altitude,
			gps.data.accuracy
		);
		this.takService.sendCot(cot);
		this._broadcastCount++;
		this._lastBroadcastAt = Date.now();
		logger.debug('[SA-Broadcaster] Sent SA position', {
			lat: gps.data.latitude,
			lon: gps.data.longitude,
			count: this._broadcastCount
		});
		return true;
	}

	/** Single broadcast attempt with error handling. */
	private async broadcast(): Promise<void> {
		try {
			await this.trySendPosition();
		} catch (err) {
			logger.warn('[SA-Broadcaster] Broadcast failed', {
				error: err instanceof Error ? err.message : String(err)
			});
		}
	}
}
