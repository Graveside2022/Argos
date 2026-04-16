export interface DragonSyncRid {
	make: string | null;
	model: string | null;
	source: string | null;
	lookup_attempted: boolean;
	lookup_success: boolean;
}

export interface DragonSyncDrone {
	id: string;
	id_type: string;
	ua_type: number | null;
	ua_type_name: string;
	operator_id: string;
	operator_id_type: string;
	op_status: string;
	lat: number;
	lon: number;
	alt: number;
	height: number;
	speed: number;
	vspeed: number;
	direction: number | null;
	pressure_altitude: number | null;
	height_type: string;
	pilot_lat: number;
	pilot_lon: number;
	home_lat: number;
	home_lon: number;
	mac: string;
	rssi: number;
	freq: number | null;
	transport: string;
	description: string;
	rid: DragonSyncRid;
	last_update_time: number;
	track_type: 'drone' | 'aircraft';
	caa_id: string;
	horizontal_accuracy: string;
	vertical_accuracy: string;
	speed_accuracy: string;
	observed_at: number | null;
	seen_by: string | null;
}

export type DragonSyncServiceStatus = 'stopped' | 'starting' | 'running' | 'stopping';

export interface DragonSyncStatusResult {
	success: boolean;
	droneidGoRunning: boolean;
	dragonSyncRunning: boolean;
	status: DragonSyncServiceStatus;
	droneCount: number;
	apiReachable: boolean;
	error?: string;
}

export interface DragonSyncControlResult {
	success: boolean;
	message: string;
	error?: string;
}
