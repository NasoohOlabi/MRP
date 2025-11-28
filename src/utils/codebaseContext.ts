import { readFile } from 'fs/promises';
import { join } from 'path';
import { logger } from './logger.js';

/**
 * Reads key files from the codebase to provide context to the LLM
 */
export async function getCodebaseContext(): Promise<string> {
	const startTime = Date.now();
	const contextFiles = [
		{ path: 'README.md', description: 'Project overview and setup' },
		{ path: 'docs/Architecture.md', description: 'Architecture documentation' },
		{ path: 'docs/Conversation-Flows.md', description: 'Conversation flows and intents' },
		{ path: 'docs/Database-Schema.md', description: 'Database schema reference' },
		{ path: 'docs/Development-Guide.md', description: 'Developer workflow and conventions' },
		{ path: 'src/index.ts', description: 'Application entry point' },
		{ path: 'src/bot/index.ts', description: 'Bot initialization and middleware' },
		{ path: 'src/bot/textHandler.ts', description: 'Text routing and fallback handling' },
		{ path: 'src/bot/commands/index.ts', description: 'Slash command handlers' },
		{ path: 'src/bot/registerConversations.ts', description: 'Conversation registrations' },
		{ path: 'src/features/students/conversations.ts', description: 'Student feature conversations' },
		{ path: 'src/features/students/model.ts', description: 'Student data model' },
		{ path: 'src/features/teachers/conversations.ts', description: 'Teacher feature conversations' },
		{ path: 'src/features/attendance/conversations.ts', description: 'Attendance management flows' },
		{ path: 'src/features/memorization/conversations.ts', description: 'Memorization tracking flows' },
		{ path: 'src/features/users/conversations.ts', description: 'User management flows' },
		{ path: 'src/utils/auth.ts', description: 'Authentication helpers' },
		{ path: 'src/utils/helpDetector.ts', description: 'Help intent detection' },
		{ path: 'src/utils/i18n.ts', description: 'Internationalization utilities' },
		{ path: 'src/utils/lmStudio.ts', description: 'LLM integration helper' },
	];

	const contextParts: string[] = [];
	const projectRoot = process.cwd();
	let successCount = 0;
	let failureCount = 0;

	logger.debug('Building codebase context', { fileCount: contextFiles.length });

	for (const file of contextFiles) {
		try {
			const fileStartTime = Date.now();
			const filePath = join(projectRoot, file.path);
			const content = await readFile(filePath, 'utf-8');
			
			// Limit file size to avoid token limits (keep first 2000 chars)
			const truncatedContent = content.length > 2000 
				? content.substring(0, 2000) + '\n... (truncated)'
				: content;
			
			contextParts.push(
				`=== ${file.path} (${file.description}) ===\n${truncatedContent}\n`
			);
			
			const fileDuration = Date.now() - fileStartTime;
			successCount++;
			logger.debug('Codebase context file read', { 
				file: file.path, 
				originalLength: content.length,
				truncated: content.length > 2000,
				durationMs: fileDuration 
			});
		} catch (error) {
			failureCount++;
			logger.warn('Failed to read file for codebase context', { 
				file: file.path, 
				error: error instanceof Error ? error.message : String(error) 
			});
			// Continue with other files
		}
	}

	const totalDuration = Date.now() - startTime;
	const totalContextLength = contextParts.join('\n').length;
	logger.info('Codebase context built', { 
		successCount, 
		failureCount, 
		totalContextLength,
		durationMs: totalDuration 
	});

	return contextParts.join('\n');
}

