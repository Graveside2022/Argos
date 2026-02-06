import type { LeafletMap } from '$lib/stores/tactical-map/mapStore';

declare global {
	interface Window {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		L: any;
	}
}

export interface CellTower {
	mcc: string;
	mnc: string;
	lac: string;
	ci: string;
	lat: number;
	lon: number;
	carrier: string;
	country: string;
	status: 'ok' | 'unknown' | 'suspicious' | 'fake';
	range?: number;
}

export class CellTowerService {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private L: any = null;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private towerMarkers: Map<string, any> = new Map();
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private towerLayer: any = null;

	async initializeLeaflet(): Promise<void> {
		if (typeof window !== 'undefined' && !this.L) {
			// Use the already loaded Leaflet instance
			this.L = window.L || (await import('leaflet')).default;
		}
	}

	async addCellTowerLayer(map: LeafletMap): Promise<void> {
		await this.initializeLeaflet();
		if (!this.L || !map) return;

		// Create a layer group for cell towers
		this.towerLayer = this.L.layerGroup().addTo(map);
	}

	async addCellTower(tower: CellTower): Promise<void> {
		if (!this.L || !this.towerLayer) return;

		const towerId = `${tower.mcc}-${tower.mnc}-${tower.lac}-${tower.ci}`;

		// Skip if tower already exists
		if (this.towerMarkers.has(towerId)) return;

		// Create tower icon based on status
		const iconColor = {
			ok: '#10b981', // Green
			unknown: '#f59e0b', // Orange
			suspicious: '#ef4444', // Red
			fake: '#dc2626' // Dark red
		}[tower.status];

		const towerIcon = this.L.divIcon({
			className: 'cell-tower-marker',
			html: `
				<div style="position: relative; width: 30px; height: 30px;">
					<svg width="30" height="30" viewBox="0 0 24 24" style="filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5));">
						<path fill="${iconColor}" d="M12,2A3,3 0 0,1 15,5V9A3,3 0 0,1 12,12A3,3 0 0,1 9,9V5A3,3 0 0,1 12,2M19,18A1,1 0 0,1 20,19A1,1 0 0,1 19,20C18.5,20 18.12,19.65 18,19.22L15.78,17C15.65,17.12 15.5,17.18 15.33,17.22L16.5,22H7.5L8.67,17.22C8.5,17.18 8.35,17.12 8.22,17L6,19.22C5.88,19.65 5.5,20 5,20A1,1 0 0,1 4,19A1,1 0 0,1 5,18C5.5,18 5.88,18.35 6,18.78L8.22,16.56C8.08,16.4 8,16.21 8,16V12.83C8.59,12.93 9.19,13 9.8,13H14.2C14.81,13 15.41,12.93 16,12.83V16C16,16.21 15.92,16.4 15.78,16.56L18,18.78C18.12,18.35 18.5,18 19,18M12,14A1,1 0 0,0 11,15A1,1 0 0,0 12,16A1,1 0 0,0 13,15A1,1 0 0,0 12,14Z"/>
					</svg>
					${tower.status === 'fake' ? '<div style="position: absolute; top: -5px; right: -5px; color: red; font-weight: bold; font-size: 16px;">⚠️</div>' : ''}
				</div>
			`,
			iconSize: [30, 30],
			iconAnchor: [15, 15]
		});

		// Create marker
		const marker = this.L.marker([tower.lat, tower.lon], {
			icon: towerIcon
		}).addTo(this.towerLayer);

		// Add popup with tower info
		const popupContent = `
			<div style="font-family: 'Courier New', monospace; font-size: 12px;">
				<strong>Cell Tower</strong><br>
				<hr style="border-color: ${iconColor}; margin: 5px 0;">
				<strong>Network:</strong> ${tower.carrier}<br>
				<strong>Country:</strong> ${tower.country}<br>
				<strong>MCC-MNC:</strong> ${tower.mcc}-${tower.mnc}<br>
				<strong>LAC/CI:</strong> ${tower.lac}/${tower.ci}<br>
				<strong>Location:</strong> ${tower.lat.toFixed(4)}, ${tower.lon.toFixed(4)}<br>
				<strong>Status:</strong> <span style="color: ${iconColor}">${tower.status.toUpperCase()}</span>
				${tower.range ? `<br><strong>Range:</strong> ${tower.range}m` : ''}
			</div>
		`;

		marker.bindPopup(popupContent, {
			maxWidth: 250,
			className:
				tower.status === 'fake' || tower.status === 'suspicious'
					? 'signal-popup'
					: 'pi-popup'
		});

		// Add range circle if available
		if (tower.range && tower.range > 0) {
			this.L.circle([tower.lat, tower.lon], {
				radius: tower.range,
				color: iconColor,
				fillColor: iconColor,
				fillOpacity: 0.1,
				weight: 1,
				dashArray: '5, 5'
			}).addTo(this.towerLayer);
		}

		this.towerMarkers.set(towerId, marker);

		// Enforce marker limit to prevent memory overflow on Raspberry Pi
		this.enforceMarkerLimit(1000);
	}

	/**
	 * Limit the number of markers to prevent memory overflow
	 * Removes oldest markers when limit is exceeded
	 */
	private enforceMarkerLimit(maxMarkers: number = 1000): void {
		if (this.towerMarkers.size > maxMarkers) {
			// Remove oldest markers (first entries in Map)
			const markersToRemove = this.towerMarkers.size - maxMarkers;
			let removed = 0;

			for (const [id, marker] of this.towerMarkers.entries()) {
				if (removed >= markersToRemove) break;

				if (this.towerLayer) {
					this.towerLayer.removeLayer(marker);
				}
				this.towerMarkers.delete(id);
				removed++;
			}
		}
	}

	async removeCellTower(towerId: string): Promise<void> {
		const marker = this.towerMarkers.get(towerId);
		if (marker && this.towerLayer) {
			this.towerLayer.removeLayer(marker);
			this.towerMarkers.delete(towerId);
		}
	}

	async clearAllTowers(): Promise<void> {
		if (this.towerLayer) {
			this.towerLayer.clearLayers();
			this.towerMarkers.clear();
		}
	}

	getTowerCount(): number {
		return this.towerMarkers.size;
	}
}
