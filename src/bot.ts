// Main Telegram bot setup
import { conversations, createConversation } from '@grammyjs/conversations';
import * as dotenv from 'dotenv';
import { Bot, session } from 'grammy';
import type { MyContext, MySession } from './types.js';
import { t } from './utils/i18n.js';
import { logger } from './utils/logger.js';

// Import feature conversations
import { attendanceConversation } from './features/attendance/conversations.js';
import { memorizationConversation } from './features/memorization/conversations.js';
import { studentMenuConversation } from './features/students/conversations.js';
import { teacherMenuConversation } from './features/teachers/conversations.js';
import {
	assignRoleConversation,
	listUsersConversation,
	registerUserConversation,
	viewProfileConversation,
} from './features/users/conversations.js';
import { requireAdmin, requireTeacher } from './utils/auth.js';

// Load environment variables
dotenv.config();

// Helper to get user's language
function getLang(ctx: MyContext): string {
	return ctx.session?.language || 'en';
}

// Create and configure bot
export function createBot(): Bot<MyContext> {
	const botToken = process.env['BOT_TOKEN'];
	if (!botToken) {
		throw new Error('BOT_TOKEN environment variable is not set');
	}
	const bot = new Bot<MyContext>(botToken);

	// Middleware
	bot.use(session({ initial: (): MySession => ({ state: 'START', language: 'en' }) }));
	bot.use(conversations());

	// Register conversations
	bot.use(createConversation(studentMenuConversation, 'students'));
	bot.use(createConversation(teacherMenuConversation, 'teachers'));
	bot.use(createConversation(attendanceConversation, 'attendance'));
	bot.use(createConversation(memorizationConversation, 'memorization'));
	bot.use(createConversation(registerUserConversation, 'register_user'));
	bot.use(createConversation(viewProfileConversation, 'view_profile'));
	bot.use(createConversation(assignRoleConversation, 'assign_role'));
	bot.use(createConversation(listUsersConversation, 'list_users'));

	// Commands
	bot.command('start', async (ctx) => {
		const lang = getLang(ctx);
		logger.info('Command received: /start', { userId: ctx.from?.id, chatId: ctx.chat?.id });
		await ctx.reply(t('greeting', lang));
	});

	// User account commands
	bot.command('register', async (ctx) => {
		logger.info('Command received: /register', { userId: ctx.from?.id, chatId: ctx.chat?.id });
		await ctx.conversation.enter('register_user');
	});

	bot.command('profile', async (ctx) => {
		logger.info('Command received: /profile', { userId: ctx.from?.id, chatId: ctx.chat?.id });
		await ctx.conversation.enter('view_profile');
	});

	// Admin commands
	bot.command('assignrole', async (ctx) => {
		logger.info('Command received: /assignrole', { userId: ctx.from?.id, chatId: ctx.chat?.id });
		if (await requireAdmin(ctx)) {
			await ctx.conversation.enter('assign_role');
		}
	});

	bot.command('users', async (ctx) => {
		logger.info('Command received: /users', { userId: ctx.from?.id, chatId: ctx.chat?.id });
		if (await requireAdmin(ctx)) {
			await ctx.conversation.enter('list_users');
		}
	});

	// Feature commands (require teacher or admin role)
	bot.command('students', async (ctx) => {
		logger.info('Command received: /students', { userId: ctx.from?.id, chatId: ctx.chat?.id });
		if (await requireTeacher(ctx)) {
			await ctx.conversation.enter('students');
		}
	});

	bot.command('teachers', async (ctx) => {
		logger.info('Command received: /teachers', { userId: ctx.from?.id, chatId: ctx.chat?.id });
		if (await requireTeacher(ctx)) {
			await ctx.conversation.enter('teachers');
		}
	});

	bot.command('attendance', async (ctx) => {
		logger.info('Command received: /attendance', { userId: ctx.from?.id, chatId: ctx.chat?.id });
		if (await requireTeacher(ctx)) {
			await ctx.conversation.enter('attendance');
		}
	});

	bot.command('memorize', async (ctx) => {
		logger.info('Command received: /memorize', { userId: ctx.from?.id, chatId: ctx.chat?.id });
		if (await requireTeacher(ctx)) {
			await ctx.conversation.enter('memorization');
		}
	});

	bot.command('help', async (ctx) => {
		const lang = getLang(ctx);
		logger.info('Command received: /help', { userId: ctx.from?.id, chatId: ctx.chat?.id });
		await ctx.reply(t('greeting', lang));
	});

	// Handle text messages
	bot.on('message:text', async (ctx) => {
		const messageText = ctx.message.text;
		const lang = getLang(ctx);

		if (ctx.session.state === 'START') {
			if (messageText === '/student') {
				logger.info('Text command received: /student', { userId: ctx.from?.id, chatId: ctx.chat?.id });
				if (await requireTeacher(ctx)) {
					await ctx.conversation.enter('students');
				}
			} else if (messageText === '/teacher') {
				logger.info('Text command received: /teacher', { userId: ctx.from?.id, chatId: ctx.chat?.id });
				if (await requireTeacher(ctx)) {
					await ctx.conversation.enter('teachers');
				}
			} else if (messageText === '/attendance') {
				logger.info('Text command received: /attendance', { userId: ctx.from?.id, chatId: ctx.chat?.id });
				if (await requireTeacher(ctx)) {
					await ctx.conversation.enter('attendance');
				}
			} else if (messageText === '/memorize') {
				logger.info('Text command received: /memorize', { userId: ctx.from?.id, chatId: ctx.chat?.id });
				if (await requireTeacher(ctx)) {
					await ctx.conversation.enter('memorization');
				}
			} else {
				await ctx.reply(t('greeting', lang));
			}
		}
	});

	// Error handler
	bot.catch((err) => {
		logger.error('Bot error caught', {
			error: err instanceof Error ? err.message : String(err),
			errorStack: err instanceof Error ? err.stack : undefined,
			errorName: err instanceof Error ? err.name : undefined,
		});
	});

	return bot;
}

// Start the bot
export async function startBot(): Promise<void> {
	const bot = createBot();

	try {
		await bot.start();
		logger.info('Bot started successfully');
	} catch (error) {
		logger.error('Failed to start bot', {
			error: error instanceof Error ? error.message : String(error),
			errorStack: error instanceof Error ? error.stack : undefined,
		});
		throw error;
	}
}

// Note: Entry point is in src/index.ts

