export interface TakServerConfig {
	id: string;
	name: string;
	hostname: string;
	port: number;
	protocol: 'tcp' | 'tls';
	certPath?: string;
	keyPath?: string;
	caPath?: string;
	connectOnStartup: boolean;
}

export interface TakContact {
	uid: string;
	callsign: string;
	type: string;
	lat: number;
	lon: number;
	hae: number;
	course?: number;
	speed?: number;
	lastSeen: string; // ISO8601
	team?: string;
	role?: string;
}

export interface CotMessage {
	event: {
		uid: string;
		type: string;
		time: string;
		start: string;
		stale: string;
		how: string;
		point: {
			lat: number;
			lon: number;
			hae: number;
			ce: number;
			le: number;
		};
		detail: {
			contact?: { callsign: string };
			track?: { course: number; speed: number };
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			[key: string]: any;
		};
	};
}
