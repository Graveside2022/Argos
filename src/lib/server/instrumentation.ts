/**
 * OpenTelemetry instrumentation bootstrap.
 * MUST be imported as the very first line of hooks.server.ts so the SDK
 * patches Node.js built-ins (http, fetch, dns) before any other module loads.
 *
 * Exports traces to Jaeger via OTLP/HTTP on localhost:4318.
 * View traces at http://localhost:16686
 */
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import type { ExportResult } from '@opentelemetry/core';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import type { ReadableSpan, SpanExporter } from '@opentelemetry/sdk-trace-base';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

/** Query parameter names that must never appear in trace data. */
const SENSITIVE_PARAMS = new Set(['api_key', 'apikey', 'key', 'token', 'secret', 'password']);

/** Replace the value of sensitive query params with [REDACTED] in a URL string. */
function redactUrl(raw: string): string {
	try {
		const url = new URL(raw);
		for (const param of SENSITIVE_PARAMS) {
			if (url.searchParams.has(param)) {
				url.searchParams.set(param, '[REDACTED]');
			}
		}
		return url.toString();
	} catch {
		// Not a valid URL — return as-is rather than crash
		return raw;
	}
}

/** Redact sensitive params from a url.query string (e.g. "?api_key=..."). */
function redactQueryAttr(query: string): string {
	try {
		const redacted = redactUrl(`http://x${query}`);
		return redacted.slice('http://x'.length);
	} catch {
		return query;
	}
}

function redactAttr(
	attrs: ReadableSpan['attributes'],
	key: string,
	fn: (v: string) => string
): void {
	if (typeof attrs[key] === 'string') attrs[key] = fn(attrs[key] as string);
}

/** Sanitize sensitive attributes on a span before export. Mutates the span's attributes in place. */
function sanitizeSpan(span: ReadableSpan): void {
	const attrs = span.attributes;
	redactAttr(attrs, 'url.full', redactUrl);
	redactAttr(attrs, 'url.query', redactQueryAttr);
	redactAttr(attrs, 'http.url', redactUrl);
}

/**
 * Wraps an exporter to scrub sensitive query params (api_key, token, etc.)
 * from url.full / url.query / http.url span attributes before export.
 */
class SanitizingExporter implements SpanExporter {
	constructor(private readonly delegate: SpanExporter) {}

	export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): void {
		for (const span of spans) sanitizeSpan(span);
		this.delegate.export(spans, resultCallback);
	}

	shutdown(): Promise<void> {
		return this.delegate.shutdown();
	}

	forceFlush?(): Promise<void> {
		return this.delegate.forceFlush?.() ?? Promise.resolve();
	}
}

const sdk = new NodeSDK({
	resource: resourceFromAttributes({
		[ATTR_SERVICE_NAME]: 'argos',
		[ATTR_SERVICE_VERSION]: '1.0.0',
		'deployment.environment': process.env.NODE_ENV ?? 'development'
	}),
	traceExporter: new SanitizingExporter(
		new OTLPTraceExporter({ url: 'http://localhost:4318/v1/traces' })
	),
	instrumentations: [
		getNodeAutoInstrumentations({
			// Disable noisy fs instrumentation — would trace every file read
			'@opentelemetry/instrumentation-fs': { enabled: false },
			// Keep http, fetch, dns — these are the valuable traces for Argos
			'@opentelemetry/instrumentation-http': { enabled: true },
			'@opentelemetry/instrumentation-undici': { enabled: true }
		})
	]
});

sdk.start();

// Flush remaining spans on clean shutdown
process.on('SIGTERM', () => {
	sdk.shutdown().finally(() => process.exit(0));
});
