/**
 * HackRF resource-claim helpers for WebRX-family control endpoints.
 *
 * Both OpenWebRX and NovaSDR drive the same HackRF One via Docker containers.
 * This module wraps ResourceManager.acquire()/release() with peer-aware
 * recovery semantics appropriate for WebSDR start/stop flows:
 *
 *   - If the HackRF is owned by the SIBLING WebSDR (openwebrx ⇄ novasdr),
 *     the caller auto-recovers by force-releasing the peer container and
 *     retrying acquire(). This preserves the soft-interlock UX from the
 *     original NovaSDR integration: clicking Start on NovaSDR while
 *     OpenWebRX is running Just Works.
 *
 *   - If the HackRF is owned by ANY OTHER tool (e.g. gsm-evil, kismet,
 *     pagermon), the helper REFUSES to start and returns a structured
 *     conflict error. The operator must manually stop the conflicting tool.
 *     This prevents silently crashing an in-progress IMSI capture or
 *     wardrive when a user casually clicks Start on a WebSDR.
 *
 * Pattern adapted from
 * src/lib/server/services/gsm-evil/gsm-evil-control-helpers.ts which uses
 * an identical recover-and-retry flow for native GSM processes.
 */

import { canonicalizeWebRxOwner } from '$lib/server/hardware/hackrf-owner-aliases';
import { resourceManager } from '$lib/server/hardware/resource-manager';
import { HardwareDevice } from '$lib/server/hardware/types';
import { logger } from '$lib/utils/logger';

/** The two WebRX-family tool names that can legitimately auto-recover from each other. */
const WEBRX_PEERS = new Set(['openwebrx', 'novasdr']);

/**
 * Container-name aliases for the two WebRX-family tools. The background
 * `ResourceManager.refreshHackrf()` scan stamps ownership using the container
 * name returned by `docker ps`, which differs from the canonical tool name
 * passed to `acquire(toolName, ...)`. When the recorded owner is a container
 * name, we still want peer-conflict detection to recognize it as a peer.
 *
 * This handles edge cases where a WebSDR container was started outside the
 * Argos UI (`docker compose up`, Portainer, etc.) — the in-memory state will
 * have the container-name owner, and without this alias map, attempting to
 * start the sibling WebSDR via the UI would return a 409 conflict instead of
 * triggering peer recovery.
 */
function canonicalizeOwner(owner: string): string {
	return canonicalizeWebRxOwner(owner);
}

/** Result of an acquire attempt. */
export interface WebRxClaimResult {
	success: boolean;
	/** Current HackRF owner when success=false, otherwise undefined. */
	owner?: string;
	/** User-facing message when success=false. */
	message?: string;
}

/** True when `owner` is the sibling WebSDR of `toolName` (openwebrx ⇄ novasdr). */
function isPeerConflict(toolName: string, owner: string): boolean {
	const canonical = canonicalizeOwner(owner);
	return WEBRX_PEERS.has(canonical) && canonical !== toolName;
}

/** Force-release the peer WebSDR and retry the acquire. */
async function recoverFromPeer(toolName: string, peer: string): Promise<WebRxClaimResult> {
	logger.warn('[webrx-claim] HackRF held by peer — force-releasing and retrying', {
		toolName,
		peer
	});
	await resourceManager.forceRelease(HardwareDevice.HACKRF);
	const retry = await resourceManager.acquire(toolName, HardwareDevice.HACKRF);
	if (retry.success) return { success: true };
	return {
		success: false,
		owner: retry.owner ?? 'unknown',
		message: `Failed to reclaim HackRF from ${peer} after force-release.`
	};
}

/** Build the structured conflict error for a non-peer owner. */
function buildConflictError(toolName: string, owner: string): WebRxClaimResult {
	return {
		success: false,
		owner,
		message: `HackRF is currently in use by ${owner}. Stop it first before starting ${toolName}.`
	};
}

/**
 * Acquire the HackRF for a WebRX-family tool with peer-aware recovery.
 *
 * @param toolName  The acquiring tool's canonical name (must be 'openwebrx' or 'novasdr').
 * @returns { success: true } when the HackRF is now owned by toolName.
 *          { success: false, owner, message } on conflict that could not be recovered.
 */
export async function acquireHackRfForWebRx(toolName: string): Promise<WebRxClaimResult> {
	const result = await resourceManager.acquire(toolName, HardwareDevice.HACKRF);
	if (result.success) return { success: true };
	const owner = result.owner ?? 'unknown';
	if (isPeerConflict(toolName, owner)) return recoverFromPeer(toolName, owner);
	return buildConflictError(toolName, owner);
}

/**
 * Release the HackRF from a WebRX-family tool. Tolerates the "not owner"
 * case gracefully — if ownership was already transferred (e.g., GSM Evil
 * took over via its own recovery path), this logs a warning but does not
 * throw. Safe to call from stop/restart error paths.
 */
export async function releaseHackRfForWebRx(toolName: string): Promise<void> {
	const result = await resourceManager.release(toolName, HardwareDevice.HACKRF);
	if (!result.success) {
		logger.warn('[webrx-claim] Release reported non-success', {
			toolName,
			error: result.error
		});
	}
}
