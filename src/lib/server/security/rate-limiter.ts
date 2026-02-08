/**
 * In-memory token bucket rate limiter.
 *
 * Designed for single-instance tactical deployment on RPi 5.
 * No external dependencies (Redis, etc.) required.
 *
 * Policies:
 *   - Hardware control endpoints: 10 requests/minute
 *   - Data query endpoints: 60 requests/minute
 *   - Streaming endpoints: excluded (long-lived connections)
 *   - Health/status endpoints: unlimited
 *
 * Standards: OWASP A04:2021, NIST SP 800-53 SC-5, CWE-770
 */
export class RateLimiter {
	private buckets = new Map<string, { tokens: number; lastRefill: number }>();

	/**
	 * Check if a request is allowed under the rate limit.
	 *
	 * @param key - Unique identifier for the client (e.g., IP address or API key)
	 * @param maxTokens - Maximum tokens in the bucket (burst capacity)
	 * @param refillRate - Tokens added per second
	 * @returns true if request is allowed, false if rate-limited
	 */
	check(key: string, maxTokens: number, refillRate: number): boolean {
		const now = Date.now();
		const bucket = this.buckets.get(key) ?? { tokens: maxTokens, lastRefill: now };

		// Refill tokens based on elapsed time
		const elapsed = (now - bucket.lastRefill) / 1000;
		bucket.tokens = Math.min(maxTokens, bucket.tokens + elapsed * refillRate);
		bucket.lastRefill = now;

		if (bucket.tokens >= 1) {
			bucket.tokens -= 1;
			this.buckets.set(key, bucket);
			return true; // Allowed
		}
		this.buckets.set(key, bucket);
		return false; // Rate limited
	}

	/**
	 * Cleanup stale bucket entries to prevent memory growth.
	 * Call periodically (e.g., every 5 minutes via setInterval).
	 */
	cleanup(): void {
		const cutoff = Date.now() - 300_000; // 5 minutes
		for (const [key, bucket] of this.buckets) {
			if (bucket.lastRefill < cutoff) {
				this.buckets.delete(key);
			}
		}
	}
}
