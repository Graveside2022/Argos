# noVNC API Reference for SvelteKit Integration

> Fetched 2026-04-12 from github.com/novnc/noVNC (master branch)

## Package Info

- **npm**: `@novnc/novnc` v1.6.0 (2025-03-12)
- **TypeScript types**: `@types/novnc__novnc` v1.6.0 (2025-04-24, DefinitelyTyped)
- **License**: MPL-2.0
- **No runtime dependencies** — zero deps in production
- **ES modules**: `core/rfb.js` is the library entry point
- **Alternative**: `react-vnc` v3.2.0 exists for React (not useful for Svelte)

## Installation

```bash
npm install @novnc/novnc
npm install -D @types/novnc__novnc
```

## Library Usage (LIBRARY.md)

noVNC can be used as a JS library by importing the RFB class directly:

```ts
import RFB from '@novnc/novnc/core/rfb.js';
```

The `core/` directory contains the library. The `app/` and `vnc.html` are the
standalone application (not needed for library usage). noVNC uses ECMAScript 6
modules natively. For older Node.js, run `npm install` in the noVNC directory
to convert modules to `lib/`.

Example app: `vnc_lite.html` in the repo.

### Core Module Structure

```
core/
  rfb.js          — Main RFB class (the API)
  websock.js      — WebSocket abstraction
  display.js      — Canvas rendering
  clipboard.js    — Async clipboard handler
  inflator.js     — Zlib inflate
  deflator.js     — Zlib deflate
  encodings.js    — Encoding registry
  ra2.js          — RSA-AES authentication
  base64.js       — Base64 utilities
  crypto/         — Crypto helpers
  decoders/       — raw, copyrect, rre, hextile, zlib, tight, tightpng, zrle, jpeg, h264
  input/          — keyboard.js, gesturehandler.js, keysym.js, xtscancodes.js
  util/           — logging, browser detection, cursor, events, element, strings, int
```

---

## RFB Class — Complete API

### Constructor

```ts
new RFB(target: HTMLElement, urlOrChannel: string | WebSocket | RTCDataChannel, options?: RFBOptions)
```

**Parameters:**

| Parameter      | Type                                    | Description                                                                                              |
| -------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `target`       | `HTMLElement`                           | Block element where noVNC attaches. Existing contents untouched; new elements added during RFB lifetime. |
| `urlOrChannel` | `string \| WebSocket \| RTCDataChannel` | WebSocket URL (e.g. `wss://host:6080/websockify`), or an existing WebSocket/RTCDataChannel object.       |
| `options`      | `object`                                | Optional connection options (see below).                                                                 |

**Options object:**

| Option        | Type       | Default      | Description                                                 |
| ------------- | ---------- | ------------ | ----------------------------------------------------------- |
| `shared`      | `boolean`  | `true`       | Share server with other clients (false = disconnect others) |
| `credentials` | `object`   | `undefined`  | Pre-set credentials for authentication                      |
| `wsProtocols` | `string[]` | `['binary']` | WebSocket sub-protocols                                     |

**Credentials object:**

| Name         | Type        | Description                 |
| ------------ | ----------- | --------------------------- |
| `"username"` | `DOMString` | The user that authenticates |
| `"password"` | `DOMString` | Password for the user       |
| `"target"`   | `DOMString` | Target machine or session   |

Connection begins immediately on construction.

---

### Properties

| Property           | Type           | R/W | Default             | Description                                                            |
| ------------------ | -------------- | --- | ------------------- | ---------------------------------------------------------------------- |
| `background`       | `string` (CSS) | RW  | `'rgb(40, 40, 40)'` | CSS background style for the container                                 |
| `capabilities`     | `object`       | RO  | —                   | Server capabilities. `{ power: boolean }`                              |
| `clippingViewport` | `boolean`      | RO  | —                   | Whether session is currently clipped to container                      |
| `clipViewport`     | `boolean`      | RW  | `false`             | Clip remote session to container (scrollbars if disabled)              |
| `compressionLevel` | `int`          | RW  | `2`                 | Compression level 0-9. 0=none, 9=max (slow server-side)                |
| `dragViewport`     | `boolean`      | RW  | `false`             | Mouse events control clipped viewport position (requires clipViewport) |
| `focusOnClick`     | `boolean`      | RW  | `true`              | Keyboard focus on click                                                |
| `qualityLevel`     | `int`          | RW  | `6`                 | JPEG quality 0-9. 0=lowest, 9=best                                     |
| `resizeSession`    | `boolean`      | RW  | `false`             | Resize remote session to match local container                         |
| `scaleViewport`    | `boolean`      | RW  | `false`             | Scale remote session to fit container                                  |
| `showDotCursor`    | `boolean`      | RW  | `false`             | Show dot cursor when server cursor unavailable                         |
| `viewOnly`         | `boolean`      | RW  | `false`             | Non-interactive mode (no input events sent)                            |

---

### Events

All events are standard DOM `CustomEvent` objects dispatched on the RFB instance.
Listen with `rfb.addEventListener('eventname', handler)`.

| Event                 | detail                                | Description                                                                                             |
| --------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `bell`                | —                                     | Audible bell request from server                                                                        |
| `capabilities`        | —                                     | `RFB.capabilities` was updated                                                                          |
| `clipboard`           | `{ text: string }`                    | Clipboard data received from server                                                                     |
| `clippingviewport`    | —                                     | `RFB.clippingViewport` was updated                                                                      |
| `connect`             | —                                     | Connection fully established, ready for graphics/input                                                  |
| `credentialsrequired` | `{ types: string[] }`                 | Server needs credentials. `types` lists required: `"username"`, `"password"`, `"target"`                |
| `desktopname`         | `{ name: string }`                    | Remote desktop name changed                                                                             |
| `disconnect`          | `{ clean: boolean }`                  | Connection terminated. `clean=false` on error/unexpected                                                |
| `securityfailure`     | `{ status: long, reason?: string }`   | Security negotiation failed. `status` per RFB SecurityResult spec. `reason` is optional server message. |
| `serververification`  | `{ type: string, publickey: string }` | Server identity must be confirmed. Call `approveServer()` to proceed.                                   |

---

### Methods

#### `RFB.approveServer()`

Proceed connecting after `serververification` event. Call after user verifies server identity.

#### `RFB.blur()`

Remove keyboard focus from remote session.

#### `RFB.clipboardPasteFrom(text: string)`

Send clipboard text to server.

```ts
rfb.clipboardPasteFrom('Hello from Argos');
```

#### `RFB.disconnect()`

Disconnect from server. Fires `disconnect` event with `clean: true`.

#### `RFB.focus(options?: FocusOptions)`

Set keyboard focus on remote session. Accepts standard `HTMLElement.focus()` options.

#### `RFB.getImageData(): ImageData`

Return current screen content as an `ImageData` array.

#### `RFB.machineReboot()`

Request remote machine reboot. Requires `capabilities.power === true`.

#### `RFB.machineReset()`

Request remote machine reset. Requires `capabilities.power === true`.

#### `RFB.machineShutdown()`

Request remote machine shutdown. Requires `capabilities.power === true`.

#### `RFB.sendCredentials(credentials: object)`

Send credentials after `credentialsrequired` event.

```ts
rfb.sendCredentials({ username: 'admin', password: 'secret' });
```

#### `RFB.sendCtrlAltDel()`

Send Ctrl+Alt+Delete key sequence. Convenience wrapper around `sendKey()`.

#### `RFB.sendKey(keysym: number, code: string | null, down?: boolean)`

Send a key event.

| Param    | Type             | Description                                                      |
| -------- | ---------------- | ---------------------------------------------------------------- |
| `keysym` | `long`           | RFB keysym value. Can be `0` if valid `code` given.              |
| `code`   | `string \| null` | Physical key per `KeyboardEvent.code`. `null` if unknown.        |
| `down`   | `boolean`        | Optional. `true`=press, `false`=release. Omit for press+release. |

```ts
// Send Enter key
rfb.sendKey(0xff0d, 'Enter');
// Send 'a' press only
rfb.sendKey(0x61, 'KeyA', true);
```

#### `RFB.toBlob(callback: (blob: Blob) => void, type?: string, quality?: number)`

Current screen as Blob.

```ts
rfb.toBlob((blob) => {
	/* save/upload blob */
}, 'image/png');
```

#### `RFB.toDataURL(type?: string, encoderOptions?: number): string`

Current screen as data URL.

```ts
const screenshot = rfb.toDataURL('image/jpeg', 0.8);
```

---

## Embedding the noVNC Application (EMBEDDING.md)

### Files Required

| Path       | Purpose                               |
| ---------- | ------------------------------------- |
| `vnc.html` | Main application page (renameable)    |
| `app/`     | UI code, images, styles, translations |
| `core/`    | Core noVNC library                    |
| `vendor/`  | Third-party support libraries         |

### URL Parameters

Set via query string (`?param=val`) or fragment (`#param=val`). Fragment preferred (not sent to server). Also configurable via `defaults.json` and `mandatory.json`.

| Parameter         | Description                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------- |
| `autoconnect`     | Auto-connect on page load                                                                   |
| `reconnect`       | Auto-reconnect on drop                                                                      |
| `reconnect_delay` | Reconnect delay in ms                                                                       |
| `host`            | **Deprecated** — use `path` with full URL                                                   |
| `port`            | **Deprecated** — use `path` with full URL                                                   |
| `encrypt`         | **Deprecated** — use `path` with `wss://`                                                   |
| `path`            | WebSocket URL (absolute or relative to vnc.html). If `host` set, treated as path component. |
| `password`        | VNC password                                                                                |
| `repeaterID`      | VNC repeater ID                                                                             |
| `shared`          | Share with other clients                                                                    |
| `bell`            | Enable keyboard bell                                                                        |
| `view_only`       | Non-interactive mode                                                                        |
| `view_clip`       | Clip or scrollbar for oversized sessions                                                    |
| `resize`          | `off`, `scale`, or `remote`                                                                 |
| `quality`         | JPEG quality 0-9                                                                            |
| `compression`     | Compression level 0-9                                                                       |
| `show_dot`        | Show dot cursor                                                                             |
| `logging`         | Log level                                                                                   |

### Browser Cache Issue

noVNC uses ECMAScript modules loaded by the browser. Aggressive caching can serve stale files after upgrade. Set `Cache-Control: no-cache` on the noVNC directory.

**Apache:**

```apache
Header set Cache-Control "no-cache"
```

**Nginx:**

```nginx
add_header Cache-Control no-cache;
```

---

## Features

- All modern browsers including mobile (iOS, Android)
- Auth: none, VNC, RealVNC RSA-AES, Tight, VeNCrypt Plain, XVP, Apple DH, UltraVNC MSLogonII
- Encodings: raw, copyrect, rre, hextile, tight, tightPNG, ZRLE, JPEG, Zlib, H.264
- Scaling, clipping, resizing
- Forward/back mouse buttons
- Local cursor rendering
- Unicode clipboard copy/paste
- Translations
- Touch gestures for mouse emulation

---

## websockify — WebSocket-to-TCP Proxy

**Python package**: `websockify` v0.13.0 (already installed on this system as `python3-websockify`)
**Purpose**: Bridges WebSocket connections from noVNC to standard TCP VNC servers.

### Basic Usage

```bash
# Proxy WebSocket :6080 → VNC :5901
websockify 6080 localhost:5901

# With mini-webserver serving noVNC files
websockify --web /path/to/novnc 6080 localhost:5901

# noVNC convenience script (auto-downloads websockify)
./utils/novnc_proxy --vnc localhost:5901
./utils/novnc_proxy --vnc localhost:5901 --listen localhost:6081
```

### SSL/TLS (wss://)

```bash
# Generate self-signed cert
openssl req -new -x509 -days 365 -nodes -out self.pem -keyout self.pem

# Run with SSL
websockify --cert=server.pem --key=server.key 6080 localhost:5901
```

SSL auto-detected by sniffing first byte (`\x16` or `\x80`). For valid certs, concat server cert + intermediates into one PEM file.

### Features

| Feature           | Flag                                      | Description                                                       |
| ----------------- | ----------------------------------------- | ----------------------------------------------------------------- |
| Daemonize         | `-D`                                      | Run in background                                                 |
| SSL               | `--cert`, `--key`                         | Auto-detected wss://                                              |
| Session recording | `--record FILE`                           | Record traffic                                                    |
| Mini-webserver    | `--web DIR`                               | Serve files on same port                                          |
| Wrap program      | `-- PROGRAM ARGS`                         | Launch + proxy to program                                         |
| Log file          | `--log-file FILE`                         | Persist logs                                                      |
| Auth plugin       | `--auth-plugin CLASS --auth-source ARG`   | WebSocket auth                                                    |
| Web auth          | `--web-auth`                              | Also require auth for HTTP                                        |
| Token plugin      | `--token-plugin CLASS --token-source ARG` | Multi-target routing by token                                     |
| Host token        | `--host-token`                            | Route by hostname instead of token param                          |
| Wrap mode         | `--wrap-mode=MODE`                        | `ignore`, `respawn`, `exit` — behavior when wrapped program exits |

### Token Plugin (Multi-Target)

Single websockify instance routes clients to different VNC servers based on `?token=NAME` URL parameter:

```bash
websockify --token-plugin TokenFile --token-source /path/to/tokens.cfg 6080
```

Token file format: `token: host:port`

### Other Implementations

- **websockify-js** (Node.js): `github.com/novnc/websockify-js`
- **websockify-other**: C, Clojure, Ruby versions

---

## TypeScript Integration Notes

### Types Package

`@types/novnc__novnc` v1.6.0 provides TypeScript definitions for the `@novnc/novnc` package. The package name uses double underscores because npm scoped packages map `@scope/name` to `@types/scope__name` in DefinitelyTyped.

### Import Pattern for SvelteKit

```ts
// In a .svelte component or .ts file (CLIENT-SIDE ONLY)
import RFB from '@novnc/novnc/core/rfb.js';
```

noVNC manipulates the DOM directly (creates a `<canvas>` inside the target element), so it MUST be imported dynamically on the client side in SvelteKit:

```ts
// Correct: dynamic import in onMount or browser check
import { onMount } from 'svelte';
import { browser } from '$app/environment';

let rfb: InstanceType<typeof import('@novnc/novnc/core/rfb.js').default> | null = null;

onMount(async () => {
	const { default: RFB } = await import('@novnc/novnc/core/rfb.js');
	rfb = new RFB(containerEl, 'wss://host:6080/websockify');
});
```

### Known Framework Integration Issues

1. **SSR incompatibility**: noVNC requires `document`, `window`, `canvas`. Must use dynamic import or `browser` guard in SvelteKit.
2. **Canvas lifecycle**: The RFB object creates DOM elements inside the target. On Svelte component destroy, call `rfb.disconnect()` in `onDestroy` or `$effect` cleanup.
3. **Module resolution**: Some bundlers may struggle with the `.js` extension in imports. Vite handles this natively.
4. **No tree-shaking**: The RFB class imports all decoders. Bundle size is the full library (~200KB uncompressed).
5. **WebSocket path**: In SvelteKit, you may want to proxy the WebSocket through Vite's dev server or a reverse proxy to avoid CORS issues.

### Svelte 5 Component Pattern

```svelte
<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	let containerEl: HTMLDivElement;
	let rfb: any = null;
	let connected = $state(false);
	let desktopName = $state('');

	const wsUrl = 'wss://localhost:6080/websockify';

	onMount(async () => {
		const { default: RFB } = await import('@novnc/novnc/core/rfb.js');
		rfb = new RFB(containerEl, wsUrl, { shared: true });
		rfb.scaleViewport = true;
		rfb.resizeSession = false;
		rfb.background = 'rgb(17, 17, 17)'; // Match Lunaris --background

		rfb.addEventListener('connect', () => {
			connected = true;
		});
		rfb.addEventListener('disconnect', (e: CustomEvent) => {
			connected = false;
			if (!e.detail.clean) console.error('VNC disconnected unexpectedly');
		});
		rfb.addEventListener('desktopname', (e: CustomEvent) => {
			desktopName = e.detail.name;
		});
		rfb.addEventListener('credentialsrequired', (e: CustomEvent) => {
			// Prompt user for credentials based on e.detail.types
		});
	});

	onDestroy(() => {
		if (rfb) {
			rfb.disconnect();
			rfb = null;
		}
	});
</script>

<div bind:this={containerEl} class="w-full h-full" />
```

---

## Security Types (from rfb.js source)

| Constant                | Value | Protocol             |
| ----------------------- | ----- | -------------------- |
| `securityTypeNone`      | 1     | No auth              |
| `securityTypeVNCAuth`   | 2     | Classic VNC password |
| `securityTypeRA2ne`     | 6     | RealVNC RSA-AES      |
| `securityTypeTight`     | 16    | Tight security       |
| `securityTypeVeNCrypt`  | 19    | VeNCrypt wrapper     |
| `securityTypeXVP`       | 22    | XVP                  |
| `securityTypeARD`       | 30    | Apple Remote Desktop |
| `securityTypeMSLogonII` | 113   | UltraVNC MSLogonII   |
| `securityTypeUnixLogon` | 129   | Unix logon (Tight)   |
| `securityTypePlain`     | 256   | VeNCrypt Plain       |

## Internal Constants (from rfb.js source)

| Constant               | Value             | Description                               |
| ---------------------- | ----------------- | ----------------------------------------- |
| `DISCONNECT_TIMEOUT`   | 3s                | Max wait for disconnect                   |
| `DEFAULT_BACKGROUND`   | `rgb(40, 40, 40)` | Default canvas background                 |
| `MOUSE_MOVE_DELAY`     | 17ms              | Min interval between mouse moves (~60fps) |
| `WHEEL_STEP`           | 50px              | Pixels per scroll step                    |
| `WHEEL_LINE_HEIGHT`    | 19px              | Assumed line height for scroll            |
| `GESTURE_ZOOMSENS`     | 75                | Zoom gesture sensitivity                  |
| `GESTURE_SCRLSENS`     | 50                | Scroll gesture sensitivity                |
| `DOUBLE_TAP_TIMEOUT`   | 1000ms            | Double-tap detection window               |
| `DOUBLE_TAP_THRESHOLD` | 50px              | Double-tap distance threshold             |
