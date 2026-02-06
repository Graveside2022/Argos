/**
 * Agent Status Endpoint
 * Returns current LLM provider availability
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

/**
 * Check if Ollama is available locally
 */
async function isOllamaAvailable(): Promise<boolean> {
	try {
		const response = await fetch('http://localhost:11434/api/tags', {
			signal: AbortSignal.timeout(1000)
		});
		return response.ok;
	} catch {
		return false;
	}
}

export const GET: RequestHandler = async () => {
	const [hasAnthropic, hasOllama] = await Promise.all([
		isAnthropicAvailable(),
		isOllamaAvailable()
	]);

	let provider: 'anthropic' | 'ollama' | 'unavailable' = 'unavailable';

	if (hasAnthropic) {
		provider = 'anthropic';
	} else if (hasOllama) {
		provider = 'ollama';
	}

	return json({
		provider,
		available: {
			anthropic: hasAnthropic,
			ollama: hasOllama
		},
		message:
			provider === 'anthropic'
				? 'Claude Sonnet 4.5 online'
				: provider === 'ollama'
					? 'Ollama local model available (offline mode)'
					: 'No LLM available. Install Ollama or set ANTHROPIC_API_KEY.'
	});
};
