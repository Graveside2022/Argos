/**
 * Unified API Error Response Contract
 *
 * All Argos API endpoints MUST return responses conforming to these shapes.
 * The route handler factory (`createHandler`) enforces this automatically.
 *
 * Spec: 016-code-expressiveness FR-014
 */

// === Success Response ===
// Every successful API response includes `success: true` plus domain-specific data.
// The factory wraps handler return values in json() automatically.
export interface ApiSuccessResponse {
	success: true;
	[key: string]: unknown;
}

// === Error Response ===
// Every error response includes `success: false` and a human-readable `error` string.
// `details` is optional — used for Zod validation errors (array of field-level issues).
export interface ApiErrorResponse {
	success: false;
	error: string;
	details?: unknown;
}

// === Union Type ===
export type ApiResponse = ApiSuccessResponse | ApiErrorResponse;

// === HTTP Status Codes ===
// 200: Success
// 400: Validation error (Zod parse failure, missing required fields)
// 401: Authentication failure (missing/invalid API key)
// 403: Authorization failure (valid key but insufficient permissions)
// 404: Resource not found
// 409: Conflict (e.g., service already running)
// 429: Rate limited
// 500: Internal server error (unhandled exception caught by factory)
// 503: Service unavailable (hardware not connected, external service down)

// === Migration Notes ===
// Current shapes being unified:
// 1. `{ success: boolean, error?: string }` → already compliant
// 2. `{ status: string, message?: string }` → migrate to shape 1
// 3. `{ error: string }` → add `success: false`
// 4. SvelteKit `error()` throws → keep (correct for non-JSON responses)
// 5. Raw Response objects (streams) → keep (can't be JSON-wrapped)
