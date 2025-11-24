// LM Studio integration
import { logger } from '../../../infrastructure/observability/index.js';

export interface LMStudioConfig {
	baseUrl?: string;
	model?: string;
	timeout?: number;
}

const DEFAULT_CONFIG: Required<LMStudioConfig> = {
	baseUrl: process.env.LM_STUDIO_URL || 'http://10.2.0.2:1234',
	model: process.env.LM_STUDIO_MODEL || 'openai/gpt-oss-20b',
	timeout: 30000, // 30 seconds
};

export interface ChatMessage {
	role: 'system' | 'user' | 'assistant';
	content: string;
}

/**
 * Sends a request to LM Studio local instance
 * Includes the last 10 messages from conversation history if provided
 */
export async function queryLMStudio(
	prompt: string,
	systemPrompt: string,
	config: LMStudioConfig = {},
	messageHistory: ChatMessage[] = [],
): Promise<string> {
	const finalConfig = { ...DEFAULT_CONFIG, ...config };
	const url = `${finalConfig.baseUrl}/v1/chat/completions`;

	// Get the last 10 messages from history (excluding system messages)
	const recentHistory = messageHistory.filter((msg) => msg.role !== 'system').slice(-10);

	// Build messages array: system prompt first, then history, then current prompt
	const messages: ChatMessage[] = [
		{ role: 'system' as const, content: systemPrompt },
		...recentHistory,
		{ role: 'user' as const, content: prompt },
	];

	logger.debug('LM Studio query initiated', {
		url,
		model: finalConfig.model,
		promptLength: prompt.length,
		systemPromptLength: systemPrompt.length,
		historyLength: recentHistory.length,
		totalMessages: messages.length,
		timeout: finalConfig.timeout,
	});

	try {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), finalConfig.timeout);

		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				model: finalConfig.model,
				messages,
				temperature: 0.7,
				max_tokens: 1000,
			}),
			signal: controller.signal,
		});

		clearTimeout(timeoutId);

		if (!response.ok) {
			const errorText = await response.text();
			logger.error('LM Studio API error', {
				status: response.status,
				statusText: response.statusText,
				errorText: errorText.substring(0, 200),
			});
			throw new Error(`LM Studio API error: ${response.status}`);
		}

		const data = await response.json();
		const content = data.choices?.[0]?.message?.content;

		if (!content) {
			logger.error('LM Studio response missing content', {
				data: JSON.stringify(data).substring(0, 200),
			});
			throw new Error('Invalid response from LM Studio');
		}

		logger.info('LM Studio query completed successfully', {
			url,
			model: finalConfig.model,
			responseLength: content.length,
		});

		return content;
	} catch (error) {
		if (error instanceof Error && error.name === 'AbortError') {
			logger.error('LM Studio request timeout', {
				url,
				timeout: finalConfig.timeout,
			});
			throw new Error('Request to LM Studio timed out');
		}
		logger.error('Error querying LM Studio', {
			url,
			error: error instanceof Error ? error.message : String(error),
			errorStack: error instanceof Error ? error.stack : undefined,
		});
		throw error;
	}
}

