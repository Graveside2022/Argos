/**
 * Ambient type shim for `@novnc/novnc/lib/rfb.js`.
 *
 * The published npm package ships the transpiled CommonJS bundle at
 * `lib/rfb.js`, but `@types/novnc__novnc` only declares types for the source
 * path `@novnc/novnc/core/rfb.js`. Since we have to import from `lib/` to get
 * the version the package actually exports, declare the module shape here so
 * our Svelte component can pass strict TypeScript checks.
 *
 * The runtime object is the full RFB class; we declare a minimal `unknown`
 * default export and narrow it locally at the call site with a cast to our
 * own `RfbLike` interface.
 */

declare module '@novnc/novnc/lib/rfb.js' {
	const RFB: unknown;
	export default RFB;
}
