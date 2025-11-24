import { readFile } from 'fs/promises';
import { join } from 'path';
import { logger } from './logger.js';

/**
 * Reads key files from the codebase to provide context to the LLM
 */
export async function getCodebaseContext(): Promise<string> {
	const startTime = Date.now();
	const contextFiles = [
		// Core files
		{ path: 'README.md', description: 'Project overview and setup' },
		{ path: 'package.json', description: 'Dependencies and scripts' },
		{ path: 'src/index.ts', description: 'Main bot entry point' },
		{ path: 'src/types.d.ts', description: 'Type definitions' },
		
		// Architecture and docs
		{ path: 'docs/Architecture.md', description: 'Architecture documentation' },
		{ path: 'docs/Conversation-Flows.md', description: 'Conversation flow documentation' },
		{ path: 'docs/Database-Schema.md', description: 'Database schema documentation' },
		
		// Core conversation system
		{ path: 'src/conversations/baseConversation.ts', description: 'Base conversation builder' },
		
		// Key conversation modules
		{ path: 'src/conversations/students/studentCrud.ts', description: 'Student CRUD operations' },
		{ path: 'src/conversations/teachers/teacherCrud.ts', description: 'Teacher CRUD operations' },
		{ path: 'src/conversations/attendance/attendanceTaking.ts', description: 'Attendance taking flow' },
		{ path: 'src/conversations/memorization/memorizationConversation.ts', description: 'Memorization tracking' },
		{ path: 'src/conversations/browse/browseConversation.ts', description: 'Browse functionality' },
		{ path: 'src/conversations/summaryConversation.ts', description: 'Summary functionality' },
		
		// Repositories
		{ path: 'src/model/drizzle/repos.ts', description: 'Data repositories' },
		{ path: 'src/model/drizzle/schema.ts', description: 'Database schema' },
		
		// Utilities
		{ path: 'src/utils/greeting.ts', description: 'Greeting utilities' },
		{ path: 'src/utils/i18n.ts', description: 'Internationalization' },
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

/**
 * Creates a system prompt for the LLM with codebase context
 */
export async function createSystemPrompt(): Promise<string> {
	const startTime = Date.now();
	logger.debug('Creating system prompt');
	
	const codebaseContext = await getCodebaseContext();
	const contextDuration = Date.now() - startTime;
	
	const systemPrompt = `You are a helpful assistant for the MRP (Masjid Record Program) Telegram Bot. 
You have access to the bot's codebase and documentation to answer questions about how the bot works, 
how to use its features, and help users understand the bot's capabilities.

## Bot Overview
The MRP Bot is a Telegram bot built with Grammy.js that manages:
- Student records (CRUD operations)
- Teacher records (CRUD operations)
- Attendance tracking
- Memorization progress tracking
- Browsing and searching records

## Available Commands
- /start - Initiates the bot and displays welcome message
- /students or /student - Student management conversation
- /teachers or /teacher - Teacher management conversation
- /browse - Browse and search records
- /memorize - Record student memorization progress
- /attendance - Take attendance
- /summary - View attendance and memorization summaries

## Codebase Context
${codebaseContext}

## Instructions
- Answer questions about how to use the bot, its features, and commands
- Explain how different features work based on the codebase
- Provide helpful guidance when users are confused
- Be concise but thorough
- If you don't know something, say so rather than guessing
- Use the codebase context to provide accurate information`;
	
	const totalDuration = Date.now() - startTime;
	logger.info('System prompt created', { 
		promptLength: systemPrompt.length,
		contextDurationMs: contextDuration,
		totalDurationMs: totalDuration 
	});
	
	return systemPrompt;
}

