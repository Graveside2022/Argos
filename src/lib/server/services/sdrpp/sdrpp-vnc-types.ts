/**
 * Type definitions and constants for the SDR++ VNC service.
 *
 * Spawns a three-process stack (Xtigervnc + SDR++ + websockify)
 * to stream the full C++ GUI into the Argos dashboard via noVNC.
 *
 * Ports are offset from Sparrow-WiFi and WebTAK VNC stacks to allow
 * all three to run simultaneously.
 */

/** X display number used by Xtigervnc and SDR++. */
export const SDRPP_VNC_DISPLAY = ':97';

/** TCP port where Xtigervnc serves the VNC protocol on localhost. */
export const SDRPP_VNC_PORT = 5997;

/** TCP port where websockify exposes the VNC session as a WebSocket. */
export const SDRPP_WS_PORT = 6082;

/** URL path segment served by websockify. */
export const SDRPP_WS_PATH = '/websockify';

/** Geometry passed to Xtigervnc (`WxH`). Wider than Sparrow to suit SDR++ waterfall. */
export const SDRPP_GEOMETRY = '1440x900';

/** Color depth for the virtual framebuffer. */
export const SDRPP_DEPTH = 24;

/** Path to the SDR++ binary (installed via .deb package). */
export const SDRPP_GUI_PATH = '/usr/bin/sdrpp';

/** Root directory for SDR++ configuration files. */
export const SDRPP_ROOT_DIR = '/opt/sdrpp/config';

/** Result returned from every control action (start/stop/status). */
export interface SdrppVncControlResult {
	success: boolean;
	message: string;
	error?: string;
	wsPort?: number;
	wsPath?: string;
}

/** Result returned from the status action. */
export interface SdrppVncStatusResult {
	success: true;
	isRunning: boolean;
	status: 'active' | 'inactive';
	wsPort: number;
	wsPath: string;
}
