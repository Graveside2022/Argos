import type { GlobalProtectConfig, GlobalProtectStatus } from '$lib/types/globalprotect';

export const DEFAULT_CONFIG: GlobalProtectConfig = {
	id: '',
	portal: '',
	username: '',
	connectOnStartup: false,
	authMethod: 'password',
	certificatePath: undefined
};

export async function loadConfig(): Promise<GlobalProtectConfig> {
	const res = await fetch('/api/globalprotect/config');
	if (!res.ok) return { ...DEFAULT_CONFIG };
	const data = await res.json();
	return data.config ?? { ...DEFAULT_CONFIG };
}

export async function saveConfig(
	config: GlobalProtectConfig
): Promise<{ success: boolean; message: string }> {
	const res = await fetch('/api/globalprotect/config', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			portal: config.portal,
			username: config.username,
			connectOnStartup: config.connectOnStartup,
			authMethod: config.authMethod,
			certificatePath: config.certificatePath
		})
	});
	if (!res.ok) {
		const err = await res.json().catch(() => ({ error: 'Save failed' }));
		return { success: false, message: err.error ?? 'Save failed' };
	}
	return { success: true, message: 'Configuration saved' };
}

export async function connectVpn(
	portal: string,
	username: string,
	password: string
): Promise<GlobalProtectStatus> {
	const res = await fetch('/api/globalprotect/connection', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ portal, username, password })
	});
	const data = await res.json();
	return {
		status: data.status ?? 'error',
		portal: data.portal,
		gateway: data.gateway,
		assignedIp: data.assignedIp,
		lastError: data.lastError
	};
}

export async function disconnectVpn(): Promise<GlobalProtectStatus> {
	const res = await fetch('/api/globalprotect/connection', { method: 'DELETE' });
	const data = await res.json();
	return {
		status: data.status ?? 'disconnected',
		portal: data.portal,
		gateway: data.gateway,
		assignedIp: data.assignedIp
	};
}

export async function importCertificate(
	path: string
): Promise<{ success: boolean; message: string }> {
	const res = await fetch('/api/globalprotect/certificate', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ path })
	});
	return res.json();
}
