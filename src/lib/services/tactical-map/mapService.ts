import { mapStore, setMap, setUserMarker, setAccuracyCircle, type LeafletMap, type LeafletMarker, type LeafletCircle } from '$lib/stores/tactical-map/mapStore';
import { gpsStore } from '$lib/stores/tactical-map/gpsStore';
import { get } from 'svelte/store';

declare global {
	interface Window {
		L: any;
	}
}

export class MapService {
	private L: any = null;

	async initializeLeaflet(): Promise<void> {
		if (typeof window !== 'undefined' && !this.L) {
			// Dynamically import Leaflet on client side
			this.L = (await import('leaflet')).default;
			
			// Fix default icon paths
			delete this.L.Icon.Default.prototype._getIconUrl;
			this.L.Icon.Default.mergeOptions({
				iconRetinaUrl: '/leaflet/marker-icon-2x.png',
				iconUrl: '/leaflet/marker-icon.png',
				shadowUrl: '/leaflet/marker-shadow.png'
			});
		}
	}

	async initializeMap(mapContainer: HTMLDivElement): Promise<LeafletMap | null> {
		await this.initializeLeaflet();
		
		const mapState = get(mapStore);
		const gpsState = get(gpsStore);
		
		if (!mapContainer || mapState.map || !gpsState.status.hasGPSFix || !this.L) {
			return null;
		}

		const map = this.L.map(mapContainer).setView([gpsState.position.lat, gpsState.position.lon], 15);

		// Add map tiles
		this.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
			attribution: '', // Remove attribution text
			maxZoom: 18
		}).addTo(map);

		// Remove Leaflet attribution control
		map.attributionControl.setPrefix('');

		setMap(map);
		return map;
	}

	async createUserMarker(position: { lat: number; lon: number }, onClickHandler?: () => void): Promise<LeafletMarker | null> {
		if (!this.L) return null;

		const userIcon = this.L.divIcon({
			className: 'user-marker',
			html: '<div style="font-size: 36px; text-align: center; filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5));">🇺🇸</div>',
			iconSize: [40, 40],
			iconAnchor: [20, 20]
		});

		const marker = this.L.marker([position.lat, position.lon], {
			icon: userIcon
		});

		const mapState = get(mapStore);
		if (mapState.map) {
			marker.addTo(mapState.map);
		}

		if (onClickHandler) {
			marker.on('click', onClickHandler);
		}

		// Bind popup to user marker
		marker.bindPopup('', {
			maxWidth: 300,
			className: 'pi-popup',
			autoClose: false,
			closeOnClick: false
		});

		setUserMarker(marker);
		return marker;
	}

	async createAccuracyCircle(position: { lat: number; lon: number }, accuracy: number): Promise<LeafletCircle | null> {
		if (!this.L || accuracy <= 0) return null;

		const circle = this.L.circle([position.lat, position.lon], {
			radius: accuracy,
			color: '#3b82f6',
			fillColor: '#3b82f6',
			fillOpacity: 0.15,
			weight: 1
		});

		const mapState = get(mapStore);
		if (mapState.map) {
			circle.addTo(mapState.map);
		}

		setAccuracyCircle(circle);
		return circle;
	}

	updateUserMarker(position: { lat: number; lon: number }): void {
		const mapState = get(mapStore);
		if (mapState.userMarker) {
			mapState.userMarker.setLatLng([position.lat, position.lon]);
		}
	}

	updateAccuracyCircle(position: { lat: number; lon: number }, accuracy: number): void {
		const mapState = get(mapStore);
		if (mapState.accuracyCircle) {
			mapState.accuracyCircle.setLatLng([position.lat, position.lon]);
			mapState.accuracyCircle.setRadius(accuracy);
		}
	}

	setMapView(position: { lat: number; lon: number }, zoom: number = 15): void {
		const mapState = get(mapStore);
		if (mapState.map) {
			mapState.map.setView([position.lat, position.lon], zoom);
		}
	}

	getMap(): LeafletMap | null {
		const mapState = get(mapStore);
		return mapState.map;
	}
}