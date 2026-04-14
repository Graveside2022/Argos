/**
 * Type definitions and constants for the Sparrow-WiFi VNC service.
 *
 * Spawns a three-process stack (Xtigervnc + sparrow-wifi.py + websockify)
 * to stream the full PyQt5 GUI into the Argos dashboard via noVNC.
 *
 * Ports are offset from WebTAK's VNC stack to allow both to run simultaneously.
 */

/** X display number used by Xtigervnc and Sparrow GUI. */
export const SPARROW_VNC_DISPLAY = ':98';

/** TCP port where Xtigervnc serves the VNC protocol on localhost. */
export const SPARROW_VNC_PORT = 5998;

/** TCP port where websockify exposes the VNC session as a WebSocket. */
export const SPARROW_WS_PORT = 6081;

/** Geometry passed to Xtigervnc (`WxH`). */
export const SPARROW_GEOMETRY = '1280x720';

/** Color depth for the virtual framebuffer. */
export const SPARROW_DEPTH = 24;

/** Path to the Sparrow-WiFi GUI script. */
export const SPARROW_GUI_PATH = '/opt/sparrow-wifi/sparrow-wifi.py';

/** Result returned from every control action (start/stop/status). */
export interface SparrowVncControlResult {
	success: boolean;
	message: string;
	error?: string;
	wsPort?: number;
	wsPath?: string;
}

/** Result returned from the status action. */
export interface SparrowVncStatusResult {
	success: true;
	isRunning: boolean;
	status: 'active' | 'inactive';
	wsPort: number;
	wsPath: string;
}
