/**
 * Canonical Leaflet type definitions for the tactical map.
 * Used by stores/tactical-map, services/tactical-map, and routes.
 *
 * These are minimal structural types for the Leaflet library.
 * They do NOT replace the full @types/leaflet declarations but provide
 * type safety for the subset of the API that Argos actually uses.
 */

export interface LeafletEvent {
	latlng: {
		lat: number;
		lng: number;
	};
	originalEvent?: Event;
}

export interface LeafletLayer {
	addTo: (map: LeafletMap) => LeafletLayer;
	remove: () => void;
}

export interface LeafletPopup {
	setContent: (content: string) => LeafletPopup;
	setLatLng: (latlng: [number, number]) => LeafletPopup;
	openOn: (map: LeafletMap) => LeafletPopup;
}

export interface LeafletIcon {
	Default: {
		prototype: { _getIconUrl?: unknown };
		mergeOptions: (options: Record<string, string>) => void;
	};
}

export interface LeafletMap {
	setView: (center: [number, number], zoom: number) => LeafletMap;
	attributionControl: {
		setPrefix: (prefix: string) => void;
	};
	addLayer: (layer: LeafletLayer) => void;
	removeLayer: (layer: LeafletLayer) => void;
	flyTo: (center: [number, number], zoom: number) => void;
	getZoom: () => number;
	getBounds: () => unknown;
	on: (event: string, handler: (e: LeafletEvent) => void) => void;
	off: (event: string, handler?: (e: LeafletEvent) => void) => void;
	remove: () => void;
}

export interface LeafletTileLayer extends LeafletLayer {
	addTo: (map: LeafletMap) => LeafletTileLayer;
}

export interface LeafletMarker extends LeafletLayer {
	addTo: (map: LeafletMap) => LeafletMarker;
	setLatLng: (latlng: [number, number]) => LeafletMarker;
	remove: () => void;
	bindPopup: (content: string | LeafletPopup, options?: Record<string, unknown>) => LeafletMarker;
	openPopup: () => LeafletMarker;
	closePopup: () => LeafletMarker;
	setPopupContent: (content: string) => LeafletMarker;
	on: (event: string, handler: (e: LeafletEvent) => void) => LeafletMarker;
	setIcon: (icon: unknown) => LeafletMarker;
	setOpacity: (opacity: number) => LeafletMarker;
	isPopupOpen: () => boolean;
	getPopup: () => LeafletPopup;
}

export interface LeafletCircle extends LeafletLayer {
	addTo: (map: LeafletMap) => LeafletCircle;
	setLatLng: (latlng: [number, number]) => LeafletCircle;
	setRadius: (radius: number) => LeafletCircle;
	remove: () => void;
}

export interface LeafletCircleMarker extends LeafletLayer {
	addTo: (map: LeafletMap) => LeafletCircleMarker;
	setLatLng: (latlng: [number, number]) => LeafletCircleMarker;
	setRadius: (radius: number) => LeafletCircleMarker;
	bindPopup: (content: string, options?: Record<string, unknown>) => LeafletCircleMarker;
	openPopup: () => LeafletCircleMarker;
	on: (event: string, handler: (e: LeafletEvent) => void) => LeafletCircleMarker;
	remove: () => void;
	setStyle: (style: Record<string, unknown>) => LeafletCircleMarker;
	getPopup: () => LeafletPopup | null;
	isPopupOpen?: () => boolean;
	setPopupContent?: (content: string) => LeafletCircleMarker;
}

export interface LeafletLibrary {
	map: (container: HTMLElement) => LeafletMap;
	tileLayer: (url: string, options?: Record<string, unknown>) => LeafletTileLayer;
	marker: (latlng: [number, number], options?: Record<string, unknown>) => LeafletMarker;
	circle: (latlng: [number, number], options?: Record<string, unknown>) => LeafletCircle;
	circleMarker: (
		latlng: [number, number],
		options?: Record<string, unknown>
	) => LeafletCircleMarker;
	divIcon: (options: Record<string, unknown>) => unknown;
	popup: (options?: Record<string, unknown>) => LeafletPopup;
	Icon: LeafletIcon;
}
