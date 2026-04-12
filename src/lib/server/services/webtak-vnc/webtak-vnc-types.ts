/**
 * Type definitions and constants for the WebTAK VNC service.
 *
 * The service spawns a three-process stack (Xtigervnc + chromium + websockify)
 * that lets an operator interact with a real Chromium browser through Argos.
 * The browser is pointed at an arbitrary TAK server URL and streamed back to
 * the SvelteKit UI via noVNC (VNC over WebSocket), bypassing every iframe CSP
 * restriction because pixels — not HTML — cross the boundary.
 *
 * All ports and display numbers are fixed. Argos is a single-operator console,
 * so dynamic allocation would only add lifecycle complexity with no upside.
 *
 * @module
 */

/** X display number used by Xtigervnc and Chromium (`$DISPLAY`). */
export const WEBTAK_VNC_DISPLAY = ':99';

/** TCP port where Xtigervnc serves the VNC protocol on localhost. */
export const WEBTAK_VNC_PORT = 5999;

/** TCP port where websockify exposes the VNC session as a WebSocket. */
export const WEBTAK_WS_PORT = 6080;

/** Geometry passed to Xtigervnc (`WxH`) and Chromium (`--window-size`). */
export const WEBTAK_GEOMETRY = '1280x720';

/** Color depth for the virtual framebuffer. */
export const WEBTAK_DEPTH = 24;

/** Scratch profile directory for the headless Chromium instance. */
export const CHROMIUM_USER_DATA_DIR = '/tmp/argos-webtak-chromium';

/** Shape of the POST body accepted by `/api/webtak-vnc/control`. */
export interface WebtakVncStartRequest {
	url: string;
}

/** Result returned from every control action (start/stop/status). */
export interface WebtakVncControlResult {
	success: boolean;
	message: string;
	error?: string;
	wsPort?: number;
	wsPath?: string;
	currentUrl?: string | null;
}

/** Result returned from the status action. */
export interface WebtakVncStatusResult {
	success: true;
	isRunning: boolean;
	status: 'active' | 'inactive';
	wsPort: number;
	wsPath: string;
	currentUrl: string | null;
}
