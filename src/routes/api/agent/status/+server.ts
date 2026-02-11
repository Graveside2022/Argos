/**
 * Agent Status Endpoint
 * Returns current LLM provider availability (Anthropic Claude only)
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Check if Anthropic API is available
 */
async function isAnthropicAvailable(): Promise<boolean> {
	if (!process.env.ANTHROPIC_API_KEY) {
		return false;
	}

	try {
		const response = await fetch('https://api.anthropic.com', {
			method: 'HEAD',
			signal: AbortSignal.timeout(2000)
		});
		return response.ok || response.status === 404;
	} catch {
		return false;
	}
}

export const GET: RequestHandler = async () => {
	const hasAnthropic = await isAnthropicAvailable();

	return json({
		provider: hasAnthropic ? 'anthropic' : 'unavailable',
		available: {
			anthropic: hasAnthropic
		},
		message: hasAnthropic
			? 'Claude Sonnet 4.5 online'
			: 'No LLM available. Set ANTHROPIC_API_KEY environment variable.'
	});
};
