import { readFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { logger } from './logger.js';

export interface LMStudioConfig {
	baseUrl?: string;
	model?: string;
	timeout?: number;
}

const DEFAULT_CONFIG: Required<LMStudioConfig> = {
	baseUrl: 'http://10.2.0.2:1234',
	model: 'openai/gpt-oss-20b',
	timeout: 1000 * 60 * 5, // 5 mins
};

export interface ChatMessage {
	role: 'system' | 'user' | 'assistant';
	content: string;
}

// Cache for loaded prompts to avoid reading from disk on every call
let promptCache: { en?: string; ar?: string } = {};

/**
 * Creates a comprehensive system prompt for the teacher assistant.
 * This prompt provides context about the system's features and capabilities.
 * Reads the prompt from a file and caches it for performance.
 */
export async function createSystemPrompt(language: 'en' | 'ar' = 'en'): Promise<string> {
	// Return cached prompt if available
	if (promptCache[language]) {
		return promptCache[language]!;
	}

	try {
		// Get the directory of the current file
		const __filename = fileURLToPath(import.meta.url);
		const __dirname = dirname(__filename);

		// Determine which file to read
		const filename = language === 'ar' ? 'system-prompt-ar.txt' : 'system-prompt-en.txt';
		const filePath = join(__dirname, 'prompts', filename);

		logger.debug('Loading system prompt from file', { language, filePath });

		const prompt = await readFile(filePath, 'utf-8');

		// Cache the prompt
		promptCache[language] = prompt.trim();

		logger.info('System prompt loaded successfully', {
			language,
			promptLength: promptCache[language]!.length
		});

		return promptCache[language]!;
	} catch (error) {
		logger.error('Failed to load system prompt from file', {
			language,
			error: error instanceof Error ? error.message : String(error),
			errorStack: error instanceof Error ? error.stack : undefined,
		});

		// Fallback to a basic prompt if file reading fails
		const fallbackPrompt = language === 'ar'
			? 'أنت معلم في المسجد تساعد في إدارة سجلات الطلاب والأنشطة التعليمية. أجب على الأسئلة وقدم المساعدة بطريقة مفيدة وواضحة.'
			: 'You are a teacher at a masjid helping manage student records and educational activities. Answer questions and provide assistance in a helpful and clear manner.';

		logger.warn('Using fallback system prompt', { language });
		return fallbackPrompt;
	}
}

/**
 * Clears the prompt cache. Useful for testing or when prompts are updated.
 */
export function clearPromptCache(): void {
	promptCache = {};
	logger.debug('System prompt cache cleared');
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

/**
 * Sanitizes markdown text to be Telegram-compatible
 * Removes tables and fixes common markdown issues
 */
export function sanitizeTelegramMarkdown(text: string): string {
	let sanitized = text;

	// Remove markdown tables (they don't work in Telegram)
	// Match table patterns like | col1 | col2 | or |---|:---:|---|
	const tablePattern = /^\|.*\|$/gm;
	const tableSeparatorPattern = /^\|[\s\-:]+\|$/gm;

	// Split by lines and filter out table lines
	const lines = sanitized.split('\n');
	const filteredLines: string[] = [];
	let inTable = false;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (line === undefined) {
			continue;
		}

		const trimmedLine = line.trim();
		const isTableRow = tablePattern.test(trimmedLine);
		const isTableSeparator = tableSeparatorPattern.test(trimmedLine);

		if (isTableSeparator) {
			// Skip separator lines
			continue;
		}

		if (isTableRow && !inTable) {
			// Start of a table - convert to simple list
			inTable = true;
			// Extract cells and convert to bullet points
			const cells = trimmedLine.split('|').map(c => c.trim()).filter(c => c && !c.match(/^[\-:]+$/));
			if (cells.length > 0) {
				filteredLines.push(cells.map(c => `• ${c}`).join('\n'));
			}
		} else if (isTableRow && inTable) {
			// Continue table - convert to bullet points
			const cells = trimmedLine.split('|').map(c => c.trim()).filter(c => c && !c.match(/^[\-:]+$/));
			if (cells.length > 0) {
				filteredLines.push(cells.map(c => `• ${c}`).join('\n'));
			}
		} else {
			// Not a table line
			if (inTable && trimmedLine === '') {
				// End of table
				inTable = false;
			}
			filteredLines.push(line);
		}
	}

	sanitized = filteredLines.join('\n');

	// Fix common markdown issues for Telegram
	// Ensure proper escaping of special characters
	sanitized = sanitized.replace(/\*\*\*/g, '*'); // Triple asterisks to single
	sanitized = sanitized.replace(/\_\_\_/g, '_'); // Triple underscores to single

	// Remove any remaining table-like structures
	sanitized = sanitized.replace(/\|[\s\-:]+\|/g, ''); // Remove separator rows

	return sanitized.trim();
}

