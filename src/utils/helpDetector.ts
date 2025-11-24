import { logger } from './logger.js';

/**
 * Detects if a user message is asking for help or questions about the bot
 */
export function isHelpQuestion(text: string): boolean {
	const startTime = Date.now();
	const normalizedText = text.toLowerCase().trim();
	
	// Help keywords
	const helpKeywords = [
		'help',
		'how',
		'what',
		'why',
		'when',
		'where',
		'can you',
		'could you',
		'explain',
		'tell me',
		'show me',
		'guide',
		'instruction',
		'tutorial',
		'does',
		'do i',
		'how do',
		'how to',
		'how can',
		'what is',
		'what are',
		'what does',
		'?',
	];
	
	// Bot-related keywords
	const botKeywords = [
		'bot',
		'command',
		'feature',
		'function',
		'capability',
		'student',
		'teacher',
		'attendance',
		'memorization',
		'memorize',
		'browse',
		'summary',
		'record',
		'create',
		'update',
		'delete',
		'search',
	];
	
	// Check if text contains help keywords
	const hasHelpKeyword = helpKeywords.some(keyword => normalizedText.includes(keyword));
	
	// Check if text contains bot-related keywords
	const hasBotKeyword = botKeywords.some(keyword => normalizedText.includes(keyword));
	
	// Check if it's a question (ends with ? or contains question words)
	const isQuestion = normalizedText.endsWith('?') || 
		normalizedText.startsWith('how') ||
		normalizedText.startsWith('what') ||
		normalizedText.startsWith('why') ||
		normalizedText.startsWith('when') ||
		normalizedText.startsWith('where') ||
		normalizedText.startsWith('can') ||
		normalizedText.startsWith('could') ||
		normalizedText.startsWith('does') ||
		normalizedText.startsWith('do ');
	
	// It's a help question if:
	// 1. Contains help keywords AND bot keywords, OR
	// 2. Is a question AND contains bot keywords, OR
	// 3. Contains help keywords AND is longer than 10 chars (not just "help")
	const isHelp = (hasHelpKeyword && hasBotKeyword) || 
		   (isQuestion && hasBotKeyword) ||
		   (hasHelpKeyword && normalizedText.length > 10);
	
	const duration = Date.now() - startTime;
	logger.debug('Help question detection', { 
		textLength: text.length,
		hasHelpKeyword,
		hasBotKeyword,
		isQuestion,
		isHelp,
		durationMs: duration 
	});
	
	return isHelp;
}

