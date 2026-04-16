import type { Feature, FeatureCollection, Point } from 'geojson';

import type { UASState } from '$lib/stores/dragonsync/uas-store';
import type { DragonSyncDrone } from '$lib/types/dragonsync';

export type UASMarkerType = 'drone' | 'pilot' | 'home';

interface UASFeatureProperties {
	id: string;
	markerType: UASMarkerType;
	ua_type_name: string;
	alt: number;
	speed: number;
	direction: number | null;
	rssi: number;
	transport: string;
	op_status: string;
	label: string;
}

type UASPointFeature = Feature<Point, UASFeatureProperties>;

function hasPosition(lat: number, lon: number): boolean {
	return lat !== 0 || lon !== 0;
}

function droneLabel(id: string, drone: DragonSyncDrone): string {
	const parts = [drone.rid?.make, drone.rid?.model].filter(Boolean);
	return parts.join(' ') || drone.ua_type_name || id;
}

function makeDroneFeature(id: string, drone: DragonSyncDrone): UASPointFeature {
	return {
		type: 'Feature',
		geometry: { type: 'Point', coordinates: [drone.lon, drone.lat] },
		properties: {
			id,
			markerType: 'drone',
			ua_type_name: drone.ua_type_name,
			alt: drone.alt,
			speed: drone.speed,
			direction: drone.direction,
			rssi: drone.rssi,
			transport: drone.transport,
			op_status: drone.op_status,
			label: droneLabel(id, drone)
		}
	};
}

function makePilotFeature(id: string, drone: DragonSyncDrone): UASPointFeature {
	return {
		type: 'Feature',
		geometry: { type: 'Point', coordinates: [drone.pilot_lon, drone.pilot_lat] },
		properties: {
			id: `${id}-pilot`,
			markerType: 'pilot',
			ua_type_name: drone.ua_type_name,
			alt: 0,
			speed: 0,
			direction: null,
			rssi: drone.rssi,
			transport: drone.transport,
			op_status: 'Operator',
			label: `Pilot: ${id}`
		}
	};
}

function makeHomeFeature(id: string, drone: DragonSyncDrone): UASPointFeature {
	return {
		type: 'Feature',
		geometry: { type: 'Point', coordinates: [drone.home_lon, drone.home_lat] },
		properties: {
			id: `${id}-home`,
			markerType: 'home',
			ua_type_name: drone.ua_type_name,
			alt: 0,
			speed: 0,
			direction: null,
			rssi: drone.rssi,
			transport: drone.transport,
			op_status: 'Home',
			label: `Home: ${id}`
		}
	};
}

function collectDroneFeatures(id: string, drone: DragonSyncDrone): UASPointFeature[] {
	const out: UASPointFeature[] = [makeDroneFeature(id, drone)];
	if (hasPosition(drone.pilot_lat, drone.pilot_lon)) out.push(makePilotFeature(id, drone));
	if (hasPosition(drone.home_lat, drone.home_lon)) out.push(makeHomeFeature(id, drone));
	return out;
}

export function buildUASGeoJSON(state: UASState): FeatureCollection<Point, UASFeatureProperties> {
	const features = [...state.drones.entries()]
		.filter(([, d]) => hasPosition(d.lat, d.lon))
		.flatMap(([id, d]) => collectDroneFeatures(id, d));

	return { type: 'FeatureCollection', features };
}

function makePilotLine(id: string, drone: DragonSyncDrone): Feature {
	return {
		type: 'Feature',
		geometry: {
			type: 'LineString',
			coordinates: [
				[drone.lon, drone.lat],
				[drone.pilot_lon, drone.pilot_lat]
			]
		},
		properties: { id: `${id}-pilot-line`, lineType: 'pilot' }
	};
}

function makeHomeLine(id: string, drone: DragonSyncDrone): Feature {
	return {
		type: 'Feature',
		geometry: {
			type: 'LineString',
			coordinates: [
				[drone.lon, drone.lat],
				[drone.home_lon, drone.home_lat]
			]
		},
		properties: { id: `${id}-home-line`, lineType: 'home' }
	};
}

function collectDroneLines(id: string, drone: DragonSyncDrone): Feature[] {
	const out: Feature[] = [];
	if (hasPosition(drone.pilot_lat, drone.pilot_lon)) out.push(makePilotLine(id, drone));
	if (hasPosition(drone.home_lat, drone.home_lon)) out.push(makeHomeLine(id, drone));
	return out;
}

export function buildUASConnectionLinesGeoJSON(state: UASState): FeatureCollection {
	const features = [...state.drones.entries()]
		.filter(([, d]) => hasPosition(d.lat, d.lon))
		.flatMap(([id, d]) => collectDroneLines(id, d));

	return { type: 'FeatureCollection', features };
}
