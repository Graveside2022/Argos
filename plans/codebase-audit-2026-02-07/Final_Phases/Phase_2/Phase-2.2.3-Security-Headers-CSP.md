# Phase 2.2.3: Security Headers and Content Security Policy

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: OWASP A05:2021 (Security Misconfiguration), NIST SP 800-53 SC-8 (Transmission Confidentiality and Integrity), DISA STIG V-222607, CWE-693 (Protection Mechanism Failure)
**Review Panel**: US Cyber Command Engineering Review Board

---

## Purpose

Add Content Security Policy (CSP) and complementary security response headers to the SvelteKit server hooks, establishing defense-in-depth against cross-site scripting (XSS), clickjacking, MIME-type confusion, and content injection attacks across all Argos web interface responses.

## Execution Constraints

| Constraint    | Value                                                                                          |
| ------------- | ---------------------------------------------------------------------------------------------- |
| Risk Level    | MEDIUM -- CSP can break legitimate inline scripts/styles if directives are too restrictive     |
| Severity      | MEDIUM                                                                                         |
| Prerequisites | Phase 2.1 complete (authentication middleware and input sanitization library must be in place) |
| Files Touched | 1 file (`src/hooks.server.ts`)                                                                 |
| Blocks        | None                                                                                           |
| Blocked By    | Phase 2.2.2 (CORS restriction should be in place before adding complementary headers)          |

## Threat Context

The Argos web interface is served to operators on tactical networks that may include untrusted or compromised devices. Without security headers:

1. **Cross-site scripting (XSS)**: If any XSS vulnerability exists in the application (e.g., unsanitized IMSI data rendered in the UI, device names from Kismet containing script tags), the absence of CSP allows arbitrary script execution in the operator's browser.
2. **Clickjacking**: An adversary on the same network could frame the Argos interface inside a malicious page and trick the operator into clicking hidden UI elements that control RF hardware.
3. **MIME-type confusion**: Without `X-Content-Type-Options: nosniff`, browsers may execute non-script resources as JavaScript if they contain script-like content.
4. **Data leakage via referrer**: Without `Referrer-Policy`, navigation away from the Argos interface can leak the full URL (including any query parameters containing operational data) to external sites.
5. **Sensor access abuse**: Without `Permissions-Policy`, a compromised page could access device sensors (geolocation, camera, microphone) through the browser.

Per OWASP A05:2021: "The application server, framework, or application is missing appropriate security hardening, or permissions to cloud services are improperly set."

## Current State Assessment

**Verified 2026-02-08** against the live codebase.

```bash
# Check for existing security headers
curl -sI http://localhost:5173/ | grep -i "content-security-policy\|x-frame-options\|x-content-type"
# Result: None present (0 security headers)

# Verify hooks.server.ts exists and is the correct injection point
grep -rn "handle" src/hooks.server.ts --include="*.ts" | head -5
# Result: handle function present (SvelteKit server hook)
```

**Current state**: Zero security headers are present on any response from the Argos web interface. The `src/hooks.server.ts` file exists with a `handle` function but does not set any security-related response headers.

## Implementation Plan

### Subtask 2.2.3.1: Add CSP and Security Headers to hooks.server.ts

**File**: `src/hooks.server.ts`

Add the following header-setting code inside the `handle` function, after the `response` object is obtained from `resolve(event)` and before it is returned.

#### Content Security Policy

The CSP is crafted specifically for the Argos SvelteKit application's requirements:

```typescript
// Content Security Policy
response.headers.set(
	'Content-Security-Policy',
	[
		"default-src 'self'",
		"script-src 'self' 'unsafe-inline'", // SvelteKit requires unsafe-inline for hydration
		"style-src 'self' 'unsafe-inline'", // Tailwind CSS requires unsafe-inline
		"img-src 'self' data: blob: https://*.tile.openstreetmap.org", // Map tiles from OSM
		"connect-src 'self' ws://localhost:* wss://localhost:*", // WebSocket connections
		"font-src 'self'",
		"object-src 'none'",
		"frame-ancestors 'none'",
		"base-uri 'self'",
		"form-action 'self'"
	].join('; ')
);
```

**CSP directive rationale**:

| Directive         | Value                                                 | Rationale                                                                                               |
| ----------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `default-src`     | `'self'`                                              | Baseline: only load resources from same origin                                                          |
| `script-src`      | `'self' 'unsafe-inline'`                              | SvelteKit hydration injects inline scripts; cannot use nonce without custom SSR                         |
| `style-src`       | `'self' 'unsafe-inline'`                              | Tailwind CSS generates inline styles; cannot be removed without build changes                           |
| `img-src`         | `'self' data: blob: https://*.tile.openstreetmap.org` | Map tile images from OpenStreetMap CDN; `data:` for inline SVG icons; `blob:` for generated map markers |
| `connect-src`     | `'self' ws://localhost:* wss://localhost:*`           | WebSocket connections to local services (spectrum data, device tracking, GPS)                           |
| `font-src`        | `'self'`                                              | All fonts served locally (Phase 1.1 eliminated CDN font references)                                     |
| `object-src`      | `'none'`                                              | No Flash, Java, or other plugin content                                                                 |
| `frame-ancestors` | `'none'`                                              | Prevent framing (clickjacking defense) -- stricter than X-Frame-Options                                 |
| `base-uri`        | `'self'`                                              | Prevent base tag injection attacks                                                                      |
| `form-action`     | `'self'`                                              | Prevent form submissions to external domains                                                            |

**Known limitation**: `'unsafe-inline'` for `script-src` and `style-src` weakens CSP against inline injection attacks. This is a SvelteKit framework requirement. To eliminate `'unsafe-inline'`, SvelteKit would need to be configured with CSP nonce support (`csp.mode: 'hash'` in `svelte.config.js`), which is a larger change appropriate for Phase 4 (Architecture Improvements).

#### Additional Security Headers

```typescript
// Prevent MIME-type sniffing
response.headers.set('X-Content-Type-Options', 'nosniff');

// Prevent clickjacking (defense-in-depth alongside CSP frame-ancestors)
response.headers.set('X-Frame-Options', 'DENY');

// Disable XSS Auditor (per OWASP recommendation -- auditor creates vulnerabilities)
response.headers.set('X-XSS-Protection', '0');

// Control referrer information leakage
response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

// Restrict browser feature access
response.headers.set(
	'Permissions-Policy',
	'geolocation=(self), microphone=(), camera=(), payment=(), usb=()'
);
```

**Header rationale**:

| Header                   | Value                                                              | Rationale                                                                                                                                            |
| ------------------------ | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `X-Content-Type-Options` | `nosniff`                                                          | Prevents browsers from MIME-sniffing responses away from declared Content-Type                                                                       |
| `X-Frame-Options`        | `DENY`                                                             | Legacy clickjacking protection (for browsers that do not support CSP frame-ancestors)                                                                |
| `X-XSS-Protection`       | `0`                                                                | OWASP recommends disabling: the XSS auditor in older browsers introduces additional vulnerabilities and can be exploited for information leakage     |
| `Referrer-Policy`        | `strict-origin-when-cross-origin`                                  | Sends origin-only referrer for cross-origin requests; full referrer for same-origin. Prevents leaking operational URL paths to external resources    |
| `Permissions-Policy`     | `geolocation=(self), microphone=(), camera=(), payment=(), usb=()` | Allows geolocation for map features (self-origin only); denies microphone, camera, payment, USB API access to prevent browser-level sensor hijacking |

**BEFORE (current hooks.server.ts pattern)**:

```typescript
export const handle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);
	return response;
};
```

**AFTER (with security headers)**:

```typescript
export const handle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);

	// Content Security Policy
	response.headers.set(
		'Content-Security-Policy',
		[
			"default-src 'self'",
			"script-src 'self' 'unsafe-inline'",
			"style-src 'self' 'unsafe-inline'",
			"img-src 'self' data: blob: https://*.tile.openstreetmap.org",
			"connect-src 'self' ws://localhost:* wss://localhost:*",
			"font-src 'self'",
			"object-src 'none'",
			"frame-ancestors 'none'",
			"base-uri 'self'",
			"form-action 'self'"
		].join('; ')
	);

	// Additional security headers
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('X-XSS-Protection', '0');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set(
		'Permissions-Policy',
		'geolocation=(self), microphone=(), camera=(), payment=(), usb=()'
	);

	return response;
};
```

### Subtask 2.2.3.2: Verification

After adding the headers, execute the following verification command:

```bash
# Verify all three key security headers are present
curl -sI http://localhost:5173/ | grep -i "content-security-policy\|x-frame-options\|x-content-type"
# Expected output (all three headers present):
#   Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; ...
#   X-Content-Type-Options: nosniff
#   X-Frame-Options: DENY
```

**Extended verification** (confirm all 5 headers):

```bash
# Full header dump for security headers
curl -sI http://localhost:5173/ | grep -iE "content-security|x-frame|x-content-type|x-xss|referrer-policy|permissions-policy"
# Expected: 6 lines (CSP, X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy)
```

**CSP functional verification** (confirm map tiles still load):

```bash
# Verify CSP allows OpenStreetMap tile requests
curl -sI http://localhost:5173/ | grep "img-src" | grep -c "tile.openstreetmap.org"
# Expected: 1
```

## Verification Checklist

| #   | Command                                                                                                 | Expected Result | Purpose                        |
| --- | ------------------------------------------------------------------------------------------------------- | --------------- | ------------------------------ |
| 1   | `curl -sI http://localhost:5173/ \| grep -i "content-security-policy\|x-frame-options\|x-content-type"` | 3 lines present | All key security headers set   |
| 2   | `curl -sI http://localhost:5173/ \| grep -c "X-Frame-Options: DENY"`                                    | 1               | Clickjacking prevention active |
| 3   | `curl -sI http://localhost:5173/ \| grep -c "X-Content-Type-Options: nosniff"`                          | 1               | MIME sniffing prevented        |
| 4   | `curl -sI http://localhost:5173/ \| grep -c "X-XSS-Protection: 0"`                                      | 1               | XSS auditor disabled per OWASP |
| 5   | `npm run typecheck`                                                                                     | Exit 0          | No type regressions            |
| 6   | `npm run build`                                                                                         | Exit 0          | Build integrity preserved      |

## Commit Strategy

```
security(phase2.2.3): add CSP and security headers to hooks.server.ts

Phase 2.2 Task 3: Security Headers
- Content Security Policy with SvelteKit-compatible directives
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- X-XSS-Protection: 0 (disabled per OWASP)
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy: geolocation=(self), deny microphone/camera/payment/usb
Verified: curl -sI confirms all 6 headers present

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

## Rollback Strategy

```bash
# Single-task rollback
git reset --soft HEAD~1

# Verify headers are no longer present (confirming rollback)
curl -sI http://localhost:5173/ | grep -c "Content-Security-Policy"
# Expected: 0

# Verify build integrity
npm run typecheck && npm run build
```

Rollback removes all security headers. This re-exposes the application to clickjacking, MIME confusion, and content injection attacks. Treat as emergency action only.

## Risk Assessment

| Risk                                                   | Likelihood | Impact | Mitigation                                                             |
| ------------------------------------------------------ | ---------- | ------ | ---------------------------------------------------------------------- |
| CSP blocks legitimate inline scripts/styles            | MEDIUM     | HIGH   | `'unsafe-inline'` included for both script-src and style-src           |
| CSP blocks map tile loading                            | LOW        | HIGH   | `https://*.tile.openstreetmap.org` explicitly allowed in img-src       |
| CSP blocks WebSocket connections                       | LOW        | HIGH   | `ws://localhost:* wss://localhost:*` explicitly allowed in connect-src |
| X-Frame-Options breaks legitimate embedding            | LOW        | LOW    | Argos is not designed to be embedded in frames                         |
| Permissions-Policy blocks legitimate geolocation       | LOW        | MEDIUM | `geolocation=(self)` allows same-origin geolocation access             |
| `'unsafe-inline'` weakens CSP against inline injection | N/A        | MEDIUM | Known limitation; Phase 4 can implement CSP nonce/hash mode            |

## Standards Traceability

| Standard             | Requirement                                               | Satisfied By                                                  |
| -------------------- | --------------------------------------------------------- | ------------------------------------------------------------- |
| OWASP A05:2021       | Security Misconfiguration -- missing security headers     | All 6 security headers added                                  |
| NIST SP 800-53 SC-8  | Transmission Confidentiality and Integrity                | CSP restricts content sources; Referrer-Policy limits leakage |
| NIST SP 800-53 SC-18 | Mobile Code -- restrict execution of mobile code          | CSP script-src limits script execution sources                |
| DISA STIG V-222607   | Application must set security headers                     | All required DISA headers implemented                         |
| CWE-693              | Protection Mechanism Failure                              | Defense-in-depth security header stack                        |
| CWE-1021             | Improper Restriction of Rendered UI Layers (Clickjacking) | X-Frame-Options: DENY + frame-ancestors: 'none'               |
| CWE-16               | Configuration                                             | Server-level header configuration in hooks.server.ts          |

## Execution Tracking

| Subtask | Description                                     | Status  | Started | Completed | Verified By |
| ------- | ----------------------------------------------- | ------- | ------- | --------- | ----------- |
| 2.2.3.1 | Add CSP and security headers to hooks.server.ts | PENDING | --      | --        | --          |
| 2.2.3.2 | Verification (curl header checks)               | PENDING | --      | --        | --          |
