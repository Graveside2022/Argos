/**
 * MQTT-to-WebSocket bridge for the media-service.
 *
 * Connects to Mosquitto via mqtt.js, subscribes to argos/media/#,
 * parses payloads against TypeScript types, and re-broadcasts to
 * browser clients via WebSocketManager.broadcast().
 *
 * Also publishes UI commands (recording, toggle, source select)
 * to MQTT on behalf of browser clients.
 *
 * NOTE: Requires mqtt.js npm dependency (T000 gate approval).
 * Server-side only — never imported in browser bundle.
 */

import { logger } from '$lib/utils/logger';

import {
	MEDIA_TOPICS,
	MEDIA_WS_EVENTS,
	type PipelineCommand,
	type RecordingCommand,
	type ToggleCommand
} from './mqtt-types';

// Manual MqttClient type — avoids importing mqtt.js at compile time.
// The actual module is loaded dynamically at runtime via import('mqtt').
interface MqttClientHandle {
	on(event: string, cb: (...args: unknown[]) => void): void;
	subscribe(topic: string, opts?: { qos: number }): void;
	publish(topic: string, message: string, opts?: { qos: number; retain: boolean }): void;
	end(force?: boolean): void;
}

/** Broadcast function type — injected to avoid importing WebSocketManager directly. */
type BroadcastFn = (message: { type: string; data: unknown; timestamp: string }) => void;

export class MediaMqttBridge {
	private client: MqttClientHandle | null = null;
	private broadcastFn: BroadcastFn;
	private brokerUrl: string;
	private connected = false;

	constructor(brokerUrl: string, broadcast: BroadcastFn) {
		this.brokerUrl = brokerUrl;
		this.broadcastFn = broadcast;
	}

	/** Connect to the MQTT broker and start forwarding messages. */
	async connect(): Promise<void> {
		try {
			// Dynamic import — deferred until mqtt.js is installed (T000 gate)
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			let mqttModule: any;
			try {
				// @ts-expect-error — mqtt.js not installed yet (T000 gate pending)
				mqttModule = await import('mqtt');
			} catch {
				logger.error('[MediaMqttBridge] mqtt.js not installed — bridge disabled');
				return;
			}
			const mqttConnect = mqttModule.default?.connect ?? mqttModule.connect;

			this.client = mqttConnect(this.brokerUrl, {
				clientId: `argos-sveltekit-${Date.now()}`,
				reconnectPeriod: 5000,
				connectTimeout: 10000
			}) as MqttClientHandle;

			this.client.on('connect', () => {
				this.connected = true;
				logger.info('[MediaMqttBridge] Connected to MQTT broker');
				this.client?.subscribe('argos/media/#', { qos: 0 });
			});

			this.client.on('message', (topic: unknown, payload: unknown) => {
				this.handleMessage(String(topic), payload as Buffer);
			});

			this.client.on('error', (err: unknown) => {
				logger.error('[MediaMqttBridge] MQTT error', { err: String(err) });
			});

			this.client.on('close', () => {
				this.connected = false;
				logger.info('[MediaMqttBridge] MQTT connection closed');
			});
		} catch (err: unknown) {
			logger.error('[MediaMqttBridge] Failed to connect', {
				err: String(err)
			});
		}
	}

	/** Disconnect from the MQTT broker. */
	disconnect(): void {
		this.client?.end();
		this.client = null;
		this.connected = false;
	}

	/** Publish a pipeline command to MQTT. */
	sendPipelineCommand(command: PipelineCommand): void {
		this.publishJson(MEDIA_TOPICS.PIPELINE_COMMAND, command);
	}

	/** Publish a recording command to MQTT. */
	sendRecordingCommand(command: RecordingCommand): void {
		this.publishJson(MEDIA_TOPICS.RECORDING_COMMAND, command);
	}

	/** Publish a toggle command to MQTT. */
	sendToggle(
		topic:
			| typeof MEDIA_TOPICS.TRANSCRIPTION_TOGGLE
			| typeof MEDIA_TOPICS.CLEANUP_TOGGLE
			| typeof MEDIA_TOPICS.DETECTION_TOGGLE,
		command: ToggleCommand
	): void {
		this.publishJson(topic, command);
	}

	get isConnected(): boolean {
		return this.connected;
	}

	// ── Private ─────────────────────────────────────────

	/** Maps MQTT topics to their corresponding WebSocket event types. */
	private static readonly TOPIC_TO_EVENT: Readonly<Record<string, string>> = {
		[MEDIA_TOPICS.TRANSCRIPTION]: MEDIA_WS_EVENTS.TRANSCRIPTION,
		[MEDIA_TOPICS.DETECTIONS]: MEDIA_WS_EVENTS.DETECTION,
		[MEDIA_TOPICS.HEALTH]: MEDIA_WS_EVENTS.HEALTH,
		[MEDIA_TOPICS.RECORDING_STATUS]: MEDIA_WS_EVENTS.RECORDING,
		[MEDIA_TOPICS.ERRORS]: MEDIA_WS_EVENTS.ERROR
	};

	private publishJson(topic: string, payload: unknown): void {
		if (!this.client || !this.connected) {
			logger.warn('[MediaMqttBridge] Cannot publish — not connected');
			return;
		}
		this.client.publish(topic, JSON.stringify(payload), { qos: 1, retain: false });
	}

	private parsePayload(topic: string, payload: Buffer): unknown | null {
		try {
			return JSON.parse(payload.toString('utf-8'));
		} catch {
			logger.warn('[MediaMqttBridge] Malformed JSON', { topic });
			return null;
		}
	}

	private handleMessage(topic: string, payload: Buffer): void {
		const parsed = this.parsePayload(topic, payload);
		if (parsed === null) return;

		const wsEvent = MediaMqttBridge.TOPIC_TO_EVENT[topic];
		if (wsEvent) {
			this.broadcastFn({ type: wsEvent, data: parsed, timestamp: new Date().toISOString() });
		}
	}
}
