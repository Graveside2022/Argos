/**
 * Container/process name → canonical tool name mapping for HackRF owners.
 *
 * The HackRF mutex can be claimed either by a tool calling `acquire()` with
 * its canonical name ("novasdr", "openwebrx") or by the background resource
 * scan detecting a running Docker container ("novasdr-hackrf",
 * "openwebrx-hackrf"). We normalize to the canonical tool name so downstream
 * consumers (claim layer, self-reacquire, UI) see one stable owner value.
 *
 * Lives in its own module to avoid circular imports between
 * `resource-manager.ts` and `webrx-hackrf-claim.ts`.
 */

const WEBRX_CONTAINER_ALIASES: Record<string, string> = {
	'openwebrx-hackrf': 'openwebrx',
	'novasdr-hackrf': 'novasdr'
};

export function canonicalizeWebRxOwner(owner: string): string {
	return WEBRX_CONTAINER_ALIASES[owner] ?? owner;
}
