import { logger } from './logger.js';

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
	messageHistory: ChatMessage[] = []
): Promise<string> {
	const startTime = Date.now();
	const finalConfig = { ...DEFAULT_CONFIG, ...config };
	const url = `${finalConfig.baseUrl}/v1/chat/completions`;

	// Get the last 10 messages from history (excluding system messages)
	const recentHistory = messageHistory
		.filter(msg => msg.role !== 'system')
		.slice(-10);

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
		timeout: finalConfig.timeout
	});

	try {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), finalConfig.timeout);

		const fetchStartTime = Date.now();
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
		const fetchDuration = Date.now() - fetchStartTime;

		if (!response.ok) {
			const errorText = await response.text();
			const totalDuration = Date.now() - startTime;
			logger.error('LM Studio API error', {
				status: response.status,
				statusText: response.statusText,
				errorText: errorText.substring(0, 200),
				fetchDurationMs: fetchDuration,
				totalDurationMs: totalDuration
			});
			throw new Error(`LM Studio API error: ${response.status}`);
		}

		const parseStartTime = Date.now();
		const data = await response.json();
		const parseDuration = Date.now() - parseStartTime;
		const content = data.choices?.[0]?.message?.content;

		if (!content) {
			const totalDuration = Date.now() - startTime;
			logger.error('LM Studio response missing content', {
				data: JSON.stringify(data).substring(0, 200),
				parseDurationMs: parseDuration,
				totalDurationMs: totalDuration
			});
			throw new Error('Invalid response from LM Studio');
		}

		const totalDuration = Date.now() - startTime;
		logger.info('LM Studio query completed successfully', {
			url,
			model: finalConfig.model,
			responseLength: content.length,
			fetchDurationMs: fetchDuration,
			parseDurationMs: parseDuration,
			totalDurationMs: totalDuration
		});

		return content;
	} catch (error) {
		const totalDuration = Date.now() - startTime;
		if (error instanceof Error && error.name === 'AbortError') {
			logger.error('LM Studio request timeout', {
				url,
				timeout: finalConfig.timeout,
				totalDurationMs: totalDuration
			});
			throw new Error('Request to LM Studio timed out');
		}
		logger.error('Error querying LM Studio', {
			url,
			error: error instanceof Error ? error.message : String(error),
			errorStack: error instanceof Error ? error.stack : undefined,
			totalDurationMs: totalDuration
		});
		throw error;
	}
}

