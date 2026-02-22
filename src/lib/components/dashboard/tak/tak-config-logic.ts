/**
 * TAK config view logic — API calls and config management.
 * Extracted from TakConfigView.svelte to comply with Article 2.2 (max 300 lines/file).
 */

import type { TakServerConfig } from '$lib/types/tak';
import { logger } from '$lib/utils/logger';

export const DEFAULT_CONFIG: TakServerConfig = {
	id: '',
	name: 'TAK Server',
	hostname: '',
	port: 8089,
	protocol: 'tls',
	shouldConnectOnStartup: false,
	authMethod: 'import',
	truststorePass: 'atakatak',
	certPass: 'atakatak',
	enrollmentPort: 8446
};

export interface MessageState {
	text: string;
	type: 'success' | 'error';
}

/** Load TAK config from the API */
export async function loadConfig(): Promise<TakServerConfig> {
	try {
		const res = await fetch('/api/tak/config');
		const data = await res.json();
		if (data && data.id) return data;
	} catch (e) {
		logger.error('[TakConfigView] Failed to load config', { error: e });
	}
	return { ...DEFAULT_CONFIG };
}

/** Save TAK config to the API */
export async function saveConfig(
	config: TakServerConfig
): Promise<{ success: boolean; config?: TakServerConfig; error?: string }> {
	try {
		const configToSave = { ...config };
		if (!configToSave.id) configToSave.id = crypto.randomUUID();
		const res = await fetch('/api/tak/config', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(configToSave)
		});
		const data = await res.json();
		if (data.success && data.config) {
			return { success: true, config: data.config };
		}
		return { success: false, error: data.error ?? 'Save failed' };
	} catch {
		return { success: false, error: 'Failed to save configuration' };
	}
}

/** Connect to TAK server */
export async function connectToServer(): Promise<{ success: boolean; error?: string }> {
	try {
		const res = await fetch('/api/tak/connection', { method: 'POST' });
		const data = await res.json();
		if (data.success) return { success: true };
		return { success: false, error: data.error ?? 'Connection failed' };
	} catch {
		return { success: false, error: 'Connection request failed' };
	}
}

/** Disconnect from TAK server */
export async function disconnectFromServer(): Promise<{ success: boolean; error?: string }> {
	try {
		const res = await fetch('/api/tak/connection', { method: 'DELETE' });
		const data = await res.json();
		if (data.success) return { success: true };
		return { success: false, error: data.error ?? 'Disconnect failed' };
	} catch {
		return { success: false, error: 'Disconnect request failed' };
	}
}

/** Apply certificate paths to config */
export function applyCertPaths(
	config: TakServerConfig,
	data: { id?: string; paths?: { certPath?: string; keyPath?: string; caPath?: string } }
): TakServerConfig {
	const updated = { ...config };
	if (data.id) updated.id = data.id;
	if (data.paths?.certPath) updated.certPath = data.paths.certPath;
	if (data.paths?.keyPath) updated.keyPath = data.paths.keyPath;
	if (data.paths?.caPath) updated.caPath = data.paths.caPath;
	return updated;
}

/** Apply truststore upload result to config */
export function applyTruststoreResult(
	config: TakServerConfig,
	data: { truststorePath: string; caPath?: string; id?: string }
): TakServerConfig {
	const updated = { ...config };
	updated.truststorePath = data.truststorePath;
	if (data.caPath) updated.caPath = data.caPath;
	if (data.id) updated.id = data.id;
	return updated;
}

/** Apply data package import result to config */
export function applyPackageImport(
	config: TakServerConfig,
	data: {
		hostname?: string;
		port?: number;
		description?: string;
		truststorePath?: string;
		id?: string;
	}
): TakServerConfig {
	const updated = { ...config };
	if (data.hostname) updated.hostname = data.hostname;
	if (data.port) updated.port = data.port;
	if (data.description) updated.name = data.description;
	if (data.truststorePath) updated.truststorePath = data.truststorePath;
	if (data.id) updated.id = data.id;
	return updated;
}

/** Clear certificate paths from config */
export function clearCertPaths(config: TakServerConfig): TakServerConfig {
	const updated = { ...config };
	updated.certPath = undefined;
	updated.keyPath = undefined;
	updated.caPath = undefined;
	return updated;
}

/** Clear truststore from config */
export function clearTruststore(config: TakServerConfig): TakServerConfig {
	const updated = { ...config };
	updated.truststorePath = undefined;
	return updated;
}
