# noVNC Integration Reference

Comprehensive reference for integrating noVNC into Argos. All content sourced from the official novnc/noVNC GitHub repository (master branch) and npm registry, April 2026.

---

## 1. Project Overview

- **Name**: noVNC — HTML VNC client library and application
- **npm package**: `@novnc/novnc`
- **Current stable**: v1.6.0 (2025-03-12)
- **Current beta**: v1.7.0-beta (2025-11-04)
- **License**: MPL-2.0
- **Stars**: 13,610 | **Forks**: 2,595
- **Default branch**: `master`
- **Zero runtime dependencies** (devDependencies only for testing/linting)
- **Module format**: ESM (`"type": "module"` in package.json)
- **Exports**: `"./core/rfb.js"` (single entry point)
- **Unpackaged size**: 774.2 KB

## 2. TypeScript Types

| Package               | Version | Status                                                                        |
| --------------------- | ------- | ----------------------------------------------------------------------------- |
| `@types/novnc`        | 0.0.27  | **DEPRECATED** — renamed to `@types/novnc-core`                               |
| `@types/novnc__novnc` | 1.6.0   | **CURRENT** — DefinitelyTyped types for `@novnc/novnc` (published 2025-04-24) |

Install: `npm install @novnc/novnc @types/novnc__novnc`

**Third-party wrappers**:

- `react-vnc` (v3.2.0) — React component wrapping noVNC. Shows framework integration pattern.

## 3. Browser Requirements

Chrome 89, Firefox 89, Safari 15, Opera 75, Edge 89 (minimum versions).

## 4. Server Requirements

noVNC requires WebSocket support on the VNC server side. Servers with built-in support:

- x11vnc/libvncserver
- QEMU
- MobileVNC

For other VNC servers, use **websockify** as a WebSocket-to-TCP proxy.

## 5. Features

- All modern browsers including mobile (iOS, Android)
- **Auth methods**: none, classical VNC, RealVNC RSA-AES, Tight, VeNCrypt Plain, XVP, Apple Diffie-Hellman, UltraVNC MSLogonII
- **Encodings**: raw, copyrect, rre, hextile, tight, tightPNG, ZRLE, JPEG, Zlib, H.264
- Scaling, clipping, resizing the desktop
- Back and forward mouse buttons
- Local cursor rendering
- Clipboard copy/paste with full Unicode support
- Translations
- Touch gestures for mouse action emulation

## 6. Quick Start

```bash
# Clone noVNC
git clone https://github.com/novnc/noVNC.git

# Launch with built-in proxy (auto-downloads websockify)
./utils/novnc_proxy --vnc localhost:5901

# Bind to localhost only (not public)
./utils/novnc_proxy --vnc localhost:5901 --listen localhost:6081
```

Then open the URL printed by `novnc_proxy` in a browser.

---

## 7. RFB Class — Complete API

The entire noVNC library API is a single `RFB` class. One instance per VNC connection.

```js
import RFB from '@novnc/novnc/core/rfb.js';
```

### 7.1 Constructor

```js
new RFB(target, urlOrChannel);
new RFB(target, urlOrChannel, options);
```

**Parameters:**

| Parameter      | Type                                    | Description                                                                                              |
| -------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `target`       | `HTMLElement`                           | Block element where noVNC attaches. Existing contents are untouched; new elements added during lifetime. |
| `urlOrChannel` | `string \| WebSocket \| RTCDataChannel` | WebSocket URL (`ws://` or `wss://`), or an existing WebSocket/RTCDataChannel object.                     |
| `options`      | `object` (optional)                     | See below.                                                                                               |

**Options object:**

| Option        | Type       | Default     | Description                                                      |
| ------------- | ---------- | ----------- | ---------------------------------------------------------------- |
| `shared`      | `boolean`  | `true`      | Whether the server should be shared or disconnect other clients. |
| `credentials` | `object`   | `undefined` | Pre-set credentials for authentication.                          |
| `wsProtocols` | `string[]` | `[]`        | WebSocket sub-protocols to request.                              |

**Credentials object:**

| Name         | Type     | Description                 |
| ------------ | -------- | --------------------------- |
| `"username"` | `string` | The user that authenticates |
| `"password"` | `string` | Password for the user       |
| `"target"`   | `string` | Target machine or session   |

**Example:**

```js
const rfb = new RFB(document.getElementById('screen'), 'ws://localhost:6080/websockify', {
	shared: true,
	credentials: { password: 'secret' }
});
```

### 7.2 Properties

#### Read-Write Properties

| Property           | Type           | Default             | Description                                                                             |
| ------------------ | -------------- | ------------------- | --------------------------------------------------------------------------------------- |
| `background`       | `string` (CSS) | `'rgb(40, 40, 40)'` | CSS background style for the container element.                                         |
| `clipViewport`     | `boolean`      | `false`             | Clip remote session to container. Scrollbars shown when disabled.                       |
| `compressionLevel` | `int` [0-9]    | `2`                 | Compression level. 0=none, 9=max (CPU intensive on server).                             |
| `dragViewport`     | `boolean`      | `false`             | Mouse events control clipped session position. Only relevant if `clipViewport` enabled. |
| `focusOnClick`     | `boolean`      | `true`              | Auto-focus remote session on mousedown/touchstart.                                      |
| `qualityLevel`     | `int` [0-9]    | `6`                 | JPEG quality. 0=low, 9=high.                                                            |
| `resizeSession`    | `boolean`      | `false`             | Send resize request to server when container changes dimensions.                        |
| `scaleViewport`    | `boolean`      | `false`             | Scale remote session locally to fit container.                                          |
| `viewOnly`         | `boolean`      | `false`             | Prevent all input events from being sent to server.                                     |

#### Read-Only Properties

| Property           | Type      | Description                                                                           |
| ------------------ | --------- | ------------------------------------------------------------------------------------- |
| `capabilities`     | `object`  | Server capabilities. Currently: `{ power: boolean }`                                  |
| `clippingViewport` | `boolean` | Whether session is currently being clipped (only relevant if `clipViewport` enabled). |

### 7.3 Methods

#### `RFB.approveServer()`

Proceed connecting after `serververification` event. Call after user verifies server identity.

```js
rfb.approveServer();
```

#### `RFB.blur()`

Remove keyboard focus from remote session.

```js
rfb.blur();
```

#### `RFB.clipboardPasteFrom(text)`

Send clipboard data to remote server.

```js
rfb.clipboardPasteFrom('Hello world');
```

- **`text`**: `string` — clipboard data to send.

#### `RFB.disconnect()`

Disconnect from the server.

```js
rfb.disconnect();
```

#### `RFB.focus()`

Move keyboard focus to the remote session.

```js
rfb.focus();
```

#### `RFB.getImageData()`

Return current screen content as `ImageData` array.

```js
const imageData = rfb.getImageData();
```

#### `RFB.machineReboot()`

Request reboot of remote machine. Requires `capabilities.power === true`.

```js
rfb.machineReboot();
```

#### `RFB.machineReset()`

Request reset of remote machine. Requires `capabilities.power === true`.

```js
rfb.machineReset();
```

#### `RFB.machineShutdown()`

Request shutdown of remote machine. Requires `capabilities.power === true`.

```js
rfb.machineShutdown();
```

#### `RFB.sendCredentials(credentials)`

Send credentials to server. Call after `credentialsrequired` event fires.

```js
rfb.sendCredentials({ password: 'secret' });
rfb.sendCredentials({ username: 'user', password: 'pass' });
```

- **`credentials`**: `object` with `username`, `password`, `target` fields (all optional strings).

#### `RFB.sendCtrlAltDel()`

Send Ctrl-Alt-Del key sequence.

```js
rfb.sendCtrlAltDel();
```

#### `RFB.sendKey(keysym, code, down?)`

Send a key event.

```js
rfb.sendKey(keysym, code); // press + release
rfb.sendKey(keysym, code, true); // press only
rfb.sendKey(keysym, code, false); // release only
```

- **`keysym`**: `number` — RFB keysym. Can be `0` if valid `code` provided.
- **`code`**: `string | null` — Physical key (`KeyboardEvent.code` value), or `null` if unknown.
- **`down`**: `boolean` (optional) — `true`=press, `false`=release. Omit for both.

#### `RFB.toBlob(callback, type?, quality?)`

Return current screen as `Blob`.

```js
rfb.toBlob((blob) => {
  // use blob
});
rfb.toBlob((blob) => { ... }, 'image/jpeg', 0.8);
```

- **`callback`**: `(blob: Blob) => void`
- **`type`**: `string` (optional) — MIME type (e.g. `'image/png'`, `'image/jpeg'`)
- **`quality`**: `number` [0-1] (optional) — image quality

#### `RFB.toDataURL(type?, encoderOptions?)`

Return current screen as data URL string.

```js
const url = rfb.toDataURL();
const jpegUrl = rfb.toDataURL('image/jpeg', 0.8);
```

- **`type`**: `string` (optional) — MIME type
- **`encoderOptions`**: `number` [0-1] (optional) — image quality

### 7.4 Events

All events are `CustomEvent` objects. Access data via `event.detail`.

#### `bell`

Fired when audible bell request received from server. No detail properties.

#### `capabilities`

Fired when `RFB.capabilities` is updated. No detail properties (read `rfb.capabilities` directly).

#### `clipboard`

Fired when clipboard data received from server.

```js
rfb.addEventListener('clipboard', (e) => {
	console.log('Clipboard:', e.detail.text);
});
```

- `e.detail.text`: `string` — clipboard data

#### `clippingviewport`

Fired when `RFB.clippingViewport` is updated. No detail properties.

#### `connect`

Fired when RFB connection and handshake with server is complete.

```js
rfb.addEventListener('connect', () => {
	console.log('Connected!');
});
```

#### `credentialsrequired`

Fired when server requests credentials not provided at construction.

```js
rfb.addEventListener('credentialsrequired', (e) => {
	console.log('Need credentials:', e.detail.types);
	// e.detail.types is string[] e.g. ['password'] or ['username', 'password']
	rfb.sendCredentials({ password: prompt('Password:') });
});
```

- `e.detail.types`: `string[]` — list of required credential types

#### `desktopname`

Fired when remote desktop name changes.

```js
rfb.addEventListener('desktopname', (e) => {
	document.title = e.detail.name;
});
```

- `e.detail.name`: `string` — desktop name

#### `disconnect`

Fired when connection terminated.

```js
rfb.addEventListener('disconnect', (e) => {
	if (e.detail.clean) {
		console.log('Clean disconnect');
	} else {
		console.error('Unexpected disconnect');
	}
});
```

- `e.detail.clean`: `boolean` — `true` for normal disconnect, `false` for error/unexpected

#### `securityfailure`

Fired when security negotiation fails.

```js
rfb.addEventListener('securityfailure', (e) => {
	console.error('Security failure:', e.detail.status, e.detail.reason);
});
```

- `e.detail.status`: `number` — SecurityResult status code (non-zero = failure)
- `e.detail.reason`: `string | undefined` — optional server-provided reason string

#### `serververification`

Fired when server provides identity verification info (man-in-the-middle protection).

```js
rfb.addEventListener('serververification', (e) => {
	if (e.detail.type === 'RSA') {
		// e.detail.publickey is Uint8Array (unsigned big-endian)
		// Show fingerprint to user, then:
		rfb.approveServer();
	}
});
```

- `e.detail.type`: `string` — verification type (e.g. `"RSA"`)
- `e.detail.publickey`: `Uint8Array` (when type is `"RSA"`) — public key

---

## 8. Embedding the noVNC Application

### 8.1 Files Required

| Path       | Description                                    |
| ---------- | ---------------------------------------------- |
| `vnc.html` | Main entry point (can be renamed)              |
| `app/`     | Application code, images, styles, translations |
| `core/`    | Core noVNC library                             |
| `vendor/`  | Third-party support libraries                  |

### 8.2 URL Parameters

Set via query string (`?key=value`) or fragment (`#key=value`). Fragment preferred (not sent to server).

| Parameter         | Description                                                                                     |
| ----------------- | ----------------------------------------------------------------------------------------------- |
| `autoconnect`     | Auto-connect on page load                                                                       |
| `reconnect`       | Auto-reconnect on disconnect                                                                    |
| `reconnect_delay` | Reconnect delay in ms                                                                           |
| `host`            | WebSocket host (**deprecated** — use `path`)                                                    |
| `port`            | WebSocket port (**deprecated** — use `path`)                                                    |
| `encrypt`         | Use TLS (**deprecated** — use `path`)                                                           |
| `path`            | WebSocket URL (absolute or relative to vnc.html). If `host` set, interpreted as path component. |
| `password`        | VNC password                                                                                    |
| `repeaterID`      | VNC repeater ID                                                                                 |
| `shared`          | Disconnect other clients on connect                                                             |
| `bell`            | Enable keyboard bell                                                                            |
| `view_only`       | Non-interactive mode                                                                            |
| `view_clip`       | Clip or scrollbar if session won't fit                                                          |
| `resize`          | Resize mode: `off`, `scale`, `remote`                                                           |
| `quality`         | JPEG quality [0-9]                                                                              |
| `compression`     | Compression level [0-9]                                                                         |
| `logging`         | Console log level: `error`, `warn`, `info`, `debug`                                             |

### 8.3 Configuration Files

- `defaults.json` — Default settings (user can override via UI)
- `mandatory.json` — Forced settings (cannot be changed by user)

---

## 9. Using as a Library (Our Integration Path)

For Argos, we use noVNC as a JavaScript library, NOT the full application.

```js
import RFB from '@novnc/novnc/core/rfb.js';

// Create connection
const rfb = new RFB(containerElement, 'ws://host:port/websockify');

// Configure
rfb.scaleViewport = true;
rfb.resizeSession = true;
rfb.qualityLevel = 6;
rfb.compressionLevel = 2;

// Listen for events
rfb.addEventListener('connect', () => {
	/* connected */
});
rfb.addEventListener('disconnect', (e) => {
	/* e.detail.clean */
});
rfb.addEventListener('credentialsrequired', (e) => {
	rfb.sendCredentials({ password: '...' });
});

// Cleanup
rfb.disconnect();
```

### 9.1 Module Format

noVNC is written in ECMAScript 6 modules. The npm package exports `./core/rfb.js` as ESM.

For older Node.js: run `npm install` in the noVNC directory to generate CommonJS in `lib/`.

**v1.7.0-beta change**: NPM bundle converted to ES-module format (already the case in source).

---

## 10. Websockify — WebSocket-to-TCP Proxy

**Repository**: github.com/novnc/websockify (4,375 stars)
**Version on system**: 0.13.0 (already installed via pip)
**License**: LGPLv3

### 10.1 What It Does

Translates WebSocket traffic to normal TCP socket traffic. Accepts WebSocket handshake, parses it, and forwards bidirectionally between client and target.

### 10.2 Basic Usage

```bash
# Proxy WebSocket port 6080 to VNC server on localhost:5901
websockify 6080 localhost:5901

# With SSL
websockify --cert=cert.pem --key=key.pem 6080 localhost:5901

# With mini-webserver serving noVNC files
websockify --web /path/to/noVNC 6080 localhost:5901

# As daemon
websockify -D 6080 localhost:5901

# Wrap a program
websockify 5901 --wrap-mode=ignore -- vncserver -geometry 1024x768 :1
```

### 10.3 Key Features

- **SSL/TLS**: Auto-detected by sniffing first byte. Use `--cert` and `--key`.
- **Mini-webserver**: `--web DIR` serves static files on same port as WS proxy.
- **Session recording**: `--record FILE` records traffic.
- **Daemonize**: `-D` flag.
- **Log files**: `--log-file FILE`.
- **Auth plugins**: `--auth-plugin CLASS --auth-source ARG` (from `auth_plugins.py`).
- **Token plugins**: `--token-plugin CLASS --token-source ARG` — single websockify instance routes to multiple VNC targets based on token URL parameter or hostname (`--host-token`).
- **Program wrapping**: `websockify PORT -- PROGRAM ARGS` with `--wrap-mode` (exit/respawn/ignore).

### 10.4 Docker

```bash
# Build
./docker/build.sh

# Run — forward local 7000 to 10.1.1.1:5902
docker run -it --rm -p 7000:80 novnc/websockify 80 10.1.1.1:5902
```

### 10.5 Other Implementations

websockify has been implemented in multiple languages: Python (reference), C, Node.js, Clojure, Ruby. The Python version is the most maintained.

---

## 11. Version History and Migration Notes

### v1.6.0 (2025-03-12) — Current Stable

- Latest stable on npm (`@novnc/novnc@1.6.0`)

### v1.7.0-beta (2025-11-04) — Pre-release

**Application changes:**

- Added Croatian and Hungarian translations
- Fixed styling bug (buttons almost disappearing)
- Browser warns before tab close when not in view-only mode

**Library changes:**

- NPM bundle converted to ES-module format
- `novnc_proxy` uses `type` instead of `which` for websockify detection
- Image data dropped after render (more efficient memory)
- Improved H.264 detection
- **BREAKING: `showDotCursor` setting removed** (was deprecated)

### Migration Gotchas

1. **showDotCursor removed in 1.7**: If using this property, remove it before upgrading.
2. **ESM-only in 1.7 beta**: The npm bundle is now pure ESM. Bundlers (Vite) handle this fine. CJS require() will not work.
3. **urlOrChannel can be WebSocket or RTCDataChannel**: Not just a URL string. This allows pre-established connections.

---

## 12. Gotchas and Caveats for Argos Integration

### 12.1 No Build Step Required

noVNC ships as plain ES modules. Vite/SvelteKit will import `@novnc/novnc/core/rfb.js` directly. No bundling or conversion needed.

### 12.2 DOM Dependency

RFB constructor requires an `HTMLElement`. In Svelte, this means:

- Use `bind:this` to get the DOM element reference
- Only instantiate RFB in `onMount` / `$effect` (after DOM is ready)
- Clean up with `rfb.disconnect()` in `onDestroy` or effect cleanup

### 12.3 Single Connection Per RFB Instance

Each `RFB` object represents ONE connection. To reconnect, create a new `RFB` instance. The old one cannot be reused.

### 12.4 WebSocket Proxy Required

VNC servers speak TCP. Browsers speak WebSocket. You MUST run websockify (or use a VNC server with built-in WebSocket support) between noVNC and the VNC server.

**For Argos**: websockify 0.13.0 is already installed. Run:

```bash
websockify 6080 localhost:5901
```

Then connect noVNC to `ws://localhost:6080/websockify`.

### 12.5 Memory Considerations (RPi 5)

- noVNC itself is lightweight (~774 KB unpackaged)
- Memory usage depends on screen resolution and encoding
- H.264 encoding is most efficient for bandwidth but requires browser decode support
- Use `compressionLevel` and `qualityLevel` to trade quality for bandwidth/memory
- v1.7 drops rendered image data (lower memory footprint)

### 12.6 Event-Based Architecture

All state changes come through CustomEvents. The RFB object is an EventTarget. Use `addEventListener`/`removeEventListener` for all event handling.

### 12.7 No CHANGES.md / No BUILDING.md

The project has no CHANGES.md or BUILDING.md file. Release notes are on GitHub Releases page only. No special build step needed for library usage.

### 12.8 Framework Integration Patterns

- **React**: `react-vnc` (npm) wraps RFB in a React component with ref-based DOM binding
- **Svelte**: No existing wrapper. Use `bind:this` + `onMount` pattern (straightforward)
- **Vue**: No official wrapper. Same pattern as Svelte — ref + mounted lifecycle

### 12.9 Clipboard

- `clipboardPasteFrom(text)` sends TO server
- `clipboard` event receives FROM server
- Full Unicode support

### 12.10 Security

- `serververification` event enables MITM protection (RSA key fingerprint verification)
- Must call `approveServer()` to continue after verification
- Multiple auth methods supported (VNC, RSA-AES, Tight, VeNCrypt, etc.)

---

## 13. Svelte Component Integration Pattern

```svelte
<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import RFB from '@novnc/novnc/core/rfb.js';

	let container: HTMLDivElement;
	let rfb: RFB | null = null;
	let connected = $state(false);
	let desktopName = $state('');

	interface Props {
		url: string;
		password?: string;
		viewOnly?: boolean;
		scaleViewport?: boolean;
	}

	let { url, password, viewOnly = false, scaleViewport = true }: Props = $props();

	onMount(() => {
		connect();
	});

	onDestroy(() => {
		disconnect();
	});

	function connect() {
		if (rfb) rfb.disconnect();

		rfb = new RFB(container, url, {
			credentials: password ? { password } : undefined,
			shared: true
		});

		rfb.viewOnly = viewOnly;
		rfb.scaleViewport = scaleViewport;
		rfb.resizeSession = true;
		rfb.qualityLevel = 6;
		rfb.compressionLevel = 2;

		rfb.addEventListener('connect', () => {
			connected = true;
		});
		rfb.addEventListener('disconnect', (e: CustomEvent) => {
			connected = false;
			if (!e.detail.clean) console.error('VNC connection lost');
		});
		rfb.addEventListener('credentialsrequired', () => {
			if (password) rfb?.sendCredentials({ password });
		});
		rfb.addEventListener('desktopname', (e: CustomEvent) => {
			desktopName = e.detail.name;
		});
	}

	function disconnect() {
		if (rfb) {
			rfb.disconnect();
			rfb = null;
			connected = false;
		}
	}
</script>

<div bind:this={container} class="vnc-container"></div>
```

---

## 14. Installation Commands for Argos

```bash
# Install noVNC library + TypeScript types
npm install @novnc/novnc@1.6.0
npm install -D @types/novnc__novnc@1.6.0

# websockify is already installed system-wide (v0.13.0)
# Verify:
websockify --help
```
