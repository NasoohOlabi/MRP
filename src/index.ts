import {
	conversations,
	createConversation
} from '@grammyjs/conversations';
import dotenv from 'dotenv';
import { Bot, session } from 'grammy';
import { createAttendanceTakingConversation } from './conversations/attendance/attendanceTaking.js';
import { createBrowseConversation } from './conversations/browse/browseConversation.js';
import { memorizationConversation } from './conversations/memorization/memorizationConversation.js';
import { studentCrudConversation } from './conversations/students/studentCrud.js';
import { createViewConversation } from './conversations/students/flows/view.js';
import { createSummaryConversation } from './conversations/summaryConversation.js';
import { teacherCrudConversation } from './conversations/teachers/teacherCrud.js';
import { AttendanceRepo, MemorizationRepo, StudentRepo, TeacherRepo } from './model/drizzle/repos.js';
import { sendGreeting } from './utils/greeting.js';
import { logger } from './utils/logger.js';
import { isHelpQuestion } from './utils/helpDetector.js';
import { queryLMStudio, type ChatMessage } from './utils/lmStudio.js';
import { createSystemPrompt } from './utils/codebaseContext.js';

import type { MyContext, MySession } from './types.js';

const env = dotenv.config().parsed! as {
	BOT_TOKEN: string,
	LOG_LEVEL: string,
};


// Remove SheetDB client wiring; use drizzle-backed repos
const studentRepo = new StudentRepo();
const teacherRepo = new TeacherRepo();
const memorizationRepo = new MemorizationRepo();
const attendanceRepo = new AttendanceRepo();


const bot = new Bot<MyContext>(process.env.BOT_TOKEN!);

// --- middlewares ---
bot.use(session({ initial: (): MySession => ({ state: 'START', language: 'en' }) }));
bot.use(conversations());


// Register it with a name
bot.use(createConversation(studentCrudConversation(studentRepo, memorizationRepo, attendanceRepo), 'createStudentConversation'));
bot.use(createConversation(teacherCrudConversation(teacherRepo), 'createTeacherConversation'));
bot.use(createConversation(createBrowseConversation(studentRepo, teacherRepo, true), 'browseStudentsConversation'));
bot.use(createConversation(memorizationConversation(studentRepo, memorizationRepo), 'createMemorizationConversation'));
bot.use(createConversation(createAttendanceTakingConversation(attendanceRepo, studentRepo), 'attendanceTakingConversation'));
bot.use(createConversation(createSummaryConversation(attendanceRepo, studentRepo, memorizationRepo), 'summaryConversation'));
bot.use(createConversation(createViewConversation(studentRepo, memorizationRepo, attendanceRepo), 'viewStudentInfoConversation'));

// Helper function to handle LM Studio queries
async function handleLMStudioQuery(ctx: MyContext, question: string) {
	const userId = ctx.from?.id;
	const chatId = ctx.chat?.id;
	const startTime = Date.now();
	
	try {
		logger.info('LM Studio query initiated', { userId, chatId, questionLength: question.length });
		// Show typing indicator
		if (ctx.chat) {
			await ctx.api.sendChatAction(ctx.chat.id, 'typing');
		}
		
		// Initialize message history if it doesn't exist
		if (!ctx.session.lmStudioHistory) {
			ctx.session.lmStudioHistory = [];
		}
		
		// Get system prompt with codebase context
		const systemPromptStartTime = Date.now();
		const systemPrompt = await createSystemPrompt();
		const systemPromptDuration = Date.now() - systemPromptStartTime;
		logger.debug('System prompt created', { 
			userId, 
			chatId, 
			promptLength: systemPrompt.length,
			durationMs: systemPromptDuration 
		});
		
		// Query LM Studio with message history (current question is sent separately, not in history)
		const queryStartTime = Date.now();
		const response = await queryLMStudio(question, systemPrompt, {}, ctx.session.lmStudioHistory);
		const queryDuration = Date.now() - queryStartTime;
		logger.info('LM Studio query completed', { 
			userId, 
			chatId, 
			responseLength: response.length,
			durationMs: queryDuration 
		});
		
		// Add user question and assistant response to history for next time
		ctx.session.lmStudioHistory.push({
			role: 'user',
			content: question
		});
		ctx.session.lmStudioHistory.push({
			role: 'assistant',
			content: response
		});
		
		// Keep only the last 20 messages in history (to have buffer beyond the 10 we send)
		if (ctx.session.lmStudioHistory.length > 20) {
			ctx.session.lmStudioHistory = ctx.session.lmStudioHistory.slice(-20);
		}
		
		// Send response (limit to 4096 chars for Telegram)
		const maxLength = 4096;
		const finalResponse = response.length > maxLength 
			? response.substring(0, maxLength - 3) + '...'
			: response;
		
		if (response.length > maxLength) {
			logger.warn('LM Studio response truncated', { 
				userId, 
				chatId, 
				originalLength: response.length,
				truncatedLength: maxLength 
			});
		}
		
		await ctx.reply(finalResponse);
		const totalDuration = Date.now() - startTime;
		logger.info('LM Studio query handled successfully', { 
			userId, 
			chatId, 
			totalDurationMs: totalDuration 
		});
	} catch (error) {
		const totalDuration = Date.now() - startTime;
		logger.error('LM Studio query failed', { 
			userId, 
			chatId, 
			error: error instanceof Error ? error.message : String(error),
			errorStack: error instanceof Error ? error.stack : undefined,
			totalDurationMs: totalDuration 
		});
		// Fallback to default message if LM Studio fails
		await ctx.reply(
			"Sorry, I couldn't connect to the help system. Please use one of the following commands:\n" +
			"• /student – to interact with student records\n" +
			"• /teacher – to interact with teacher records\n" +
			"• /browse – to browse records\n" +
			"• /memorize – to record student memorization\n" +
			"• /attendance – to take attendance\n" +
			"• /summary – to view attendance and memorization summaries"
		);
	}
}

// --- commands & handlers ---
bot.command('start', async (ctx) => {
	const userId = ctx.from?.id;
	const chatId = ctx.chat?.id;
	logger.info('Command received: /start', { userId, chatId });
	
	// Send greeting (only once)
	await sendGreeting(ctx);
});
bot.command('help', async (ctx) => {
	const userId = ctx.from?.id;
	const chatId = ctx.chat?.id;
	const question = (ctx.message?.text?.replace('/help', '').trim() || 
		'How do I use this bot? What are the available features and commands?');
	logger.info('Command received: /help', { userId, chatId, questionLength: question.length });
	await handleLMStudioQuery(ctx, question);
});
bot.command('students', async (ctx) => {
	const userId = ctx.from?.id;
	const chatId = ctx.chat?.id;
	logger.info('Command received: /students', { userId, chatId });
	await ctx.conversation.enter('createStudentConversation');
})
bot.command('teachers', async (ctx) => {
	const userId = ctx.from?.id;
	const chatId = ctx.chat?.id;
	logger.info('Command received: /teachers', { userId, chatId });
	await ctx.conversation.enter('createTeacherConversation');
})
bot.command('browse', async (ctx) => {
	const userId = ctx.from?.id;
	const chatId = ctx.chat?.id;
	logger.info('Command received: /browse', { userId, chatId });
	await ctx.conversation.enter('browseStudentsConversation');
})
bot.command('memorize', async (ctx) => {
	const userId = ctx.from?.id;
	const chatId = ctx.chat?.id;
	logger.info('Command received: /memorize', { userId, chatId });
	await ctx.conversation.enter('createMemorizationConversation');
})
bot.command('attendance', async (ctx) => {
	const userId = ctx.from?.id;
	const chatId = ctx.chat?.id;
	logger.info('Command received: /attendance', { userId, chatId });
	await ctx.conversation.enter('attendanceTakingConversation');
})
bot.command('summary', async (ctx) => {
	const userId = ctx.from?.id;
	const chatId = ctx.chat?.id;
	logger.info('Command received: /summary', { userId, chatId });
	await ctx.conversation.enter('summaryConversation');
})

bot.on('message:text', async (ctx) => {
	const userId = ctx.from?.id;
	const chatId = ctx.chat?.id;
	const messageText = ctx.message.text;
	
	if (ctx.session.state === 'START') {
		if (messageText === '/student') {
			logger.info('Text command received: /student', { userId, chatId });
			await ctx.conversation.enter('createStudentConversation');
		} else if (messageText === '/teacher') {
			logger.info('Text command received: /teacher', { userId, chatId });
			await ctx.conversation.enter('createTeacherConversation');
		} else if (messageText === '/browse') {
			logger.info('Text command received: /browse', { userId, chatId });
			await ctx.conversation.enter('browseStudentsConversation');
		} else if (messageText === '/memorize') {
			logger.info('Text command received: /memorize', { userId, chatId });
			await ctx.conversation.enter('createMemorizationConversation');
		} else if (messageText === '/attendance') {
			logger.info('Text command received: /attendance', { userId, chatId });
			await ctx.conversation.enter('attendanceTakingConversation');
		} else if (messageText === '/summary') {
			logger.info('Text command received: /summary', { userId, chatId });
			await ctx.conversation.enter('summaryConversation');
		} else {
			// Check if it's a help question and use LM Studio fallback
			if (isHelpQuestion(messageText)) {
				logger.info('Help question detected', { userId, chatId, questionLength: messageText.length });
				await handleLMStudioQuery(ctx, messageText);
			} else {
				logger.debug('Unrecognized message in START state', { 
					userId, 
					chatId, 
					messageLength: messageText.length,
					messagePreview: messageText.substring(0, 50) 
				});
				await ctx.reply(
					"Sorry, I didn't understand. Please use one of the following commands:\n" +
					"• /student – to interact with student records\n" +
					"• /teacher – to interact with teacher records\n" +
					"• /browse – to browse records\n" +
					"• /memorize – to record student memorization\n" +
					"• /attendance – to take attendance\n" +
					"• /summary – to view attendance and memorization summaries\n\n" +
					"💡 Tip: Use /help or ask me questions about how to use the bot!"
				);
			}
		}
	} else {
		logger.debug('Message received in non-START state', { 
			userId, 
			chatId, 
			state: ctx.session.state,
			messageLength: messageText.length 
		});
	}
});


bot.catch((err) => {
	logger.error('Bot error caught', { 
		error: err instanceof Error ? err.message : String(err),
		errorStack: err instanceof Error ? err.stack : undefined,
		errorName: err instanceof Error ? err.name : undefined
	});
});

bot.start().then(() => {
	logger.info('Bot started successfully');
}).catch((error) => {
	logger.error('Failed to start bot', { 
		error: error instanceof Error ? error.message : String(error),
		errorStack: error instanceof Error ? error.stack : undefined
	});
});



