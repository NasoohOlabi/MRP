// Main Telegram bot setup
import { conversations, createConversation } from '@grammyjs/conversations';
import * as dotenv from 'dotenv';
import { Bot, session } from 'grammy';
import type { MyContext, MySession } from './types.js';
import { t } from './utils/i18n.js';
import { logger } from './utils/logger.js';

// Import feature conversations
import { attendanceConversation } from './features/attendance/conversations.js';
import { AttendanceService } from './features/attendance/model.js';
import { memorizationConversation } from './features/memorization/conversations.js';
import { MemorizationService } from './features/memorization/model.js';
import { studentMenuConversation } from './features/students/conversations.js';
import { StudentService } from './features/students/model.js';
import { teacherMenuConversation } from './features/teachers/conversations.js';
import { TeacherService } from './features/teachers/model.js';
import {
	assignRoleConversation,
	listUsersConversation,
	registerUserConversation,
	viewProfileConversation,
} from './features/users/conversations.js';
import { getCurrentUser, requireAdmin, requireTeacher } from './utils/auth.js';
import { queryLMStudio } from './utils/lmStudio.js';

// Load environment variables
dotenv.config();

// Helper to get user's language
function getLang(ctx: MyContext): string {
	return ctx.session?.language || 'en';
}

// Services
const studentService = new StudentService();
const teacherService = new TeacherService();
const attendanceService = new AttendanceService();
const memorizationService = new MemorizationService();

// Helper to format date
function formatDate(date: Date, lang: string): string {
	return lang === 'ar'
		? date.toLocaleDateString('ar-SA')
		: date.toLocaleDateString('en-US');
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

		if (!ctx.from?.id) {
			await ctx.reply(lang === 'ar' ? 'لا يمكن الحصول على معلومات المستخدم.' : 'Cannot get user information.');
			return;
		}

		const user = await getCurrentUser(ctx);

		if (!user) {
			// Unknown user
			await ctx.reply(t('start_unknown', lang));
			return;
		}

		if (!user.isActive) {
			await ctx.reply(lang === 'ar'
				? 'حسابك غير نشط. يرجى الاتصال بالمسؤول.'
				: 'Your account is inactive. Please contact an administrator.');
			return;
		}

		// Show role-specific commands
		if (user.role === 'admin') {
			await ctx.reply(t('start_admin', lang), { parse_mode: 'Markdown' });
		} else if (user.role === 'student') {
			await ctx.reply(t('start_student', lang), { parse_mode: 'Markdown' });
		} else if (user.role === 'teacher') {
			await ctx.reply(t('start_teacher', lang), { parse_mode: 'Markdown' });
		} else {
			await ctx.reply(t('start_unknown', lang));
		}
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

	bot.command('myid', async (ctx) => {
		const lang = getLang(ctx);
		logger.info('Command received: /myid', { userId: ctx.from?.id, chatId: ctx.chat?.id });

		if (!ctx.from) {
			await ctx.reply(lang === 'ar' ? 'لا يمكن الحصول على معلومات المستخدم.' : 'Cannot get user information.');
			return;
		}

		const userId = ctx.from.id;
		const username = ctx.from.username ? `@${ctx.from.username}` : 'N/A';
		const firstName = ctx.from.first_name || 'N/A';
		const lastName = ctx.from.last_name || '';

		const message = lang === 'ar'
			? `**معلوماتك في Telegram**\n\nمعرف المستخدم: \`${userId}\`\nاسم المستخدم: ${username}\nالاسم: ${firstName} ${lastName}\n\nاستخدم هذا المعرف مع الأمر:\n\`bun create-admin.ts ${userId}\``
			: `**Your Telegram Information**\n\nUser ID: \`${userId}\`\nUsername: ${username}\nName: ${firstName} ${lastName}\n\nUse this ID with the command:\n\`bun create-admin.ts ${userId}\``;

		await ctx.reply(message, { parse_mode: 'Markdown' });
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

		// Reuse start command logic
		if (!ctx.from?.id) {
			await ctx.reply(lang === 'ar' ? 'لا يمكن الحصول على معلومات المستخدم.' : 'Cannot get user information.');
			return;
		}

		const user = await getCurrentUser(ctx);

		if (!user) {
			await ctx.reply(t('start_unknown', lang));
			return;
		}

		if (!user.isActive) {
			await ctx.reply(lang === 'ar'
				? 'حسابك غير نشط. يرجى الاتصال بالمسؤول.'
				: 'Your account is inactive. Please contact an administrator.');
			return;
		}

		if (user.role === 'admin') {
			await ctx.reply(t('start_admin', lang), { parse_mode: 'Markdown' });
		} else if (user.role === 'student') {
			await ctx.reply(t('start_student', lang), { parse_mode: 'Markdown' });
		} else if (user.role === 'teacher') {
			await ctx.reply(t('start_teacher', lang), { parse_mode: 'Markdown' });
		} else {
			await ctx.reply(t('start_unknown', lang));
		}
	});

	// Student read-only commands
	bot.command('myinfo', async (ctx) => {
		const lang = getLang(ctx);
		logger.info('Command received: /myinfo', { userId: ctx.from?.id, chatId: ctx.chat?.id });

		if (!ctx.from?.id) {
			await ctx.reply(lang === 'ar' ? 'لا يمكن الحصول على معلومات المستخدم.' : 'Cannot get user information.');
			return;
		}

		const user = await getCurrentUser(ctx);
		if (!user || user.role !== 'student' || !user.isActive) {
			await ctx.reply(lang === 'ar'
				? 'ليس لديك صلاحية للوصول إلى هذا الأمر.'
				: 'You don\'t have permission to access this command.');
			return;
		}

		if (!user.linkedStudentId) {
			await ctx.reply(t('not_linked_student', lang));
			return;
		}

		const student = await studentService.getById(user.linkedStudentId);
		if (!student) {
			await ctx.reply(t('not_linked_student', lang));
			return;
		}

		// Find teacher by group
		let teacherName = t('student_info_no_teacher', lang);
		if (student.group) {
			const teachers = await teacherService.getAll();
			const teacher = teachers.find(t => t.group === student.group);
			if (teacher) {
				teacherName = `${teacher.firstName} ${teacher.lastName}`;
			}
		}

		const groupText = student.group || t('student_info_no_group', lang);
		const message = lang === 'ar'
			? `${t('student_info_title', lang)}\n\n${t('student_info_name', lang).replace('{name}', `${student.firstName} ${student.lastName}`)}\n${t('student_info_group', lang).replace('{group}', groupText)}\n${t('student_info_teacher', lang).replace('{teacher}', teacherName)}`
			: `${t('student_info_title', lang)}\n\n${t('student_info_name', lang).replace('{name}', `${student.firstName} ${student.lastName}`)}\n${t('student_info_group', lang).replace('{group}', groupText)}\n${t('student_info_teacher', lang).replace('{teacher}', teacherName)}`;

		await ctx.reply(message, { parse_mode: 'Markdown' });
	});

	bot.command('mymemorization', async (ctx) => {
		const lang = getLang(ctx);
		logger.info('Command received: /mymemorization', { userId: ctx.from?.id, chatId: ctx.chat?.id });

		if (!ctx.from?.id) {
			await ctx.reply(lang === 'ar' ? 'لا يمكن الحصول على معلومات المستخدم.' : 'Cannot get user information.');
			return;
		}

		const user = await getCurrentUser(ctx);
		if (!user || user.role !== 'student' || !user.isActive) {
			await ctx.reply(lang === 'ar'
				? 'ليس لديك صلاحية للوصول إلى هذا الأمر.'
				: 'You don\'t have permission to access this command.');
			return;
		}

		if (!user.linkedStudentId) {
			await ctx.reply(t('not_linked_student', lang));
			return;
		}

		const { records, total } = await memorizationService.getStudentMemorizations(user.linkedStudentId, { limit: 20 });

		if (records.length === 0) {
			await ctx.reply(t('my_memorization_none', lang));
			return;
		}

		const recordsText = records.map(r =>
			t('my_memorization_page', lang)
				.replace('{page}', String(r.page))
				.replace('{date}', formatDate(r.createdAt, lang))
		).join('\n');

		const message = `${t('my_memorization_title', lang)}\n\n${t('my_memorization_total', lang).replace('{total}', String(total))}\n\n${recordsText}`;
		await ctx.reply(message, { parse_mode: 'Markdown' });
	});

	bot.command('myattendance', async (ctx) => {
		const lang = getLang(ctx);
		logger.info('Command received: /myattendance', { userId: ctx.from?.id, chatId: ctx.chat?.id });

		if (!ctx.from?.id) {
			await ctx.reply(lang === 'ar' ? 'لا يمكن الحصول على معلومات المستخدم.' : 'Cannot get user information.');
			return;
		}

		const user = await getCurrentUser(ctx);
		if (!user || user.role !== 'student' || !user.isActive) {
			await ctx.reply(lang === 'ar'
				? 'ليس لديك صلاحية للوصول إلى هذا الأمر.'
				: 'You don\'t have permission to access this command.');
			return;
		}

		if (!user.linkedStudentId) {
			await ctx.reply(t('not_linked_student', lang));
			return;
		}

		const { records, total } = await attendanceService.getStudentAttendance(user.linkedStudentId, { limit: 20 });

		if (records.length === 0) {
			await ctx.reply(t('my_attendance_none', lang));
			return;
		}

		const recordsText = records.map(r =>
			t('my_attendance_record', lang)
				.replace('{event}', r.event)
				.replace('{date}', formatDate(r.createdAt, lang))
		).join('\n');

		const message = `${t('my_attendance_title', lang)}\n\n${t('my_attendance_total', lang).replace('{total}', String(total))}\n\n${recordsText}`;
		await ctx.reply(message, { parse_mode: 'Markdown' });
	});

	bot.command('mygroup', async (ctx) => {
		const lang = getLang(ctx);
		logger.info('Command received: /mygroup', { userId: ctx.from?.id, chatId: ctx.chat?.id });

		if (!ctx.from?.id) {
			await ctx.reply(lang === 'ar' ? 'لا يمكن الحصول على معلومات المستخدم.' : 'Cannot get user information.');
			return;
		}

		const user = await getCurrentUser(ctx);
		if (!user || user.role !== 'student' || !user.isActive) {
			await ctx.reply(lang === 'ar'
				? 'ليس لديك صلاحية للوصول إلى هذا الأمر.'
				: 'You don\'t have permission to access this command.');
			return;
		}

		if (!user.linkedStudentId) {
			await ctx.reply(t('not_linked_student', lang));
			return;
		}

		const student = await studentService.getById(user.linkedStudentId);
		if (!student) {
			await ctx.reply(t('not_linked_student', lang));
			return;
		}

		const groupText = student.group || t('student_info_no_group', lang);
		const message = lang === 'ar'
			? `**مجموعتك:** ${groupText}`
			: `**Your Group:** ${groupText}`;
		await ctx.reply(message, { parse_mode: 'Markdown' });
	});

	bot.command('myteacher', async (ctx) => {
		const lang = getLang(ctx);
		logger.info('Command received: /myteacher', { userId: ctx.from?.id, chatId: ctx.chat?.id });

		if (!ctx.from?.id) {
			await ctx.reply(lang === 'ar' ? 'لا يمكن الحصول على معلومات المستخدم.' : 'Cannot get user information.');
			return;
		}

		const user = await getCurrentUser(ctx);
		if (!user || user.role !== 'student' || !user.isActive) {
			await ctx.reply(lang === 'ar'
				? 'ليس لديك صلاحية للوصول إلى هذا الأمر.'
				: 'You don\'t have permission to access this command.');
			return;
		}

		if (!user.linkedStudentId) {
			await ctx.reply(t('not_linked_student', lang));
			return;
		}

		const student = await studentService.getById(user.linkedStudentId);
		if (!student) {
			await ctx.reply(t('not_linked_student', lang));
			return;
		}

		let teacherName = t('student_info_no_teacher', lang);
		if (student.group) {
			const teachers = await teacherService.getAll();
			const teacher = teachers.find(t => t.group === student.group);
			if (teacher) {
				teacherName = `${teacher.firstName} ${teacher.lastName}`;
			}
		}

		const message = lang === 'ar'
			? `**معلمك:** ${teacherName}`
			: `**Your Teacher:** ${teacherName}`;
		await ctx.reply(message, { parse_mode: 'Markdown' });
	});

	// Handle text messages
	bot.on('message:text', async (ctx) => {
		const messageText = ctx.message.text;
		const lang = getLang(ctx);

		// Skip if it's a command
		if (messageText.startsWith('/')) {
			return;
		}

		// Check if user is unknown and try to identify with LLM
		if (!ctx.from?.id) {
			return;
		}

		const user = await getCurrentUser(ctx);

		// Only handle free text for unknown users
		if (!user || !user.isActive) {
			// Try to identify user with LLM
			try {
				await ctx.reply(t('identifying_user', lang));

				// Get conversation history if available
				const history = ctx.session.lmStudioHistory || [];

				// Prepare system prompt for identification
				const systemPrompt = lang === 'ar'
					? 'أنت مساعد ذكي يساعد في التعرف على المستخدمين. المستخدم يرسل معلوماته الشخصية (الاسم، رقم الهاتف، إلخ). حاول استخراج: الاسم الكامل، رقم الهاتف (إن وجد)، والمعلومات الأخرى ذات الصلة. أجب بشكل مختصر وواضح.'
					: 'You are a smart assistant helping to identify users. The user sends their personal information (name, phone number, etc.). Try to extract: full name, phone number (if available), and other relevant information. Respond briefly and clearly.';

				const response = await queryLMStudio(messageText, systemPrompt, {}, history);

				// Update conversation history
				if (!ctx.session.lmStudioHistory) {
					ctx.session.lmStudioHistory = [];
				}
				ctx.session.lmStudioHistory.push(
					{ role: 'user', content: messageText },
					{ role: 'assistant', content: response }
				);
				// Keep only last 10 messages
				if (ctx.session.lmStudioHistory.length > 10) {
					ctx.session.lmStudioHistory = ctx.session.lmStudioHistory.slice(-10);
				}

				// Try to find matching student or teacher
				const students = await studentService.getAll();
				const teachers = await teacherService.getAll();

				// Simple search - look for name matches
				const searchLower = messageText.toLowerCase();
				let found = false;

				// Check students
				for (const student of students) {
					const fullName = `${student.firstName} ${student.lastName}`.toLowerCase();
					if (fullName.includes(searchLower) || searchLower.includes(fullName)) {
						// Found a student match
						await ctx.reply(lang === 'ar'
							? `تم العثور على طالب مطابق: ${student.firstName} ${student.lastName}\n\nيرجى استخدام /register للتسجيل.`
							: `Found matching student: ${student.firstName} ${student.lastName}\n\nPlease use /register to register.`);
						found = true;
						break;
					}
				}

				// Check teachers
				if (!found) {
					for (const teacher of teachers) {
						const fullName = `${teacher.firstName} ${teacher.lastName}`.toLowerCase();
						if (fullName.includes(searchLower) || searchLower.includes(fullName)) {
							await ctx.reply(lang === 'ar'
								? `تم العثور على معلم مطابق: ${teacher.firstName} ${teacher.lastName}\n\nيرجى استخدام /register للتسجيل.`
								: `Found matching teacher: ${teacher.firstName} ${teacher.lastName}\n\nPlease use /register to register.`);
							found = true;
							break;
						}
					}
				}

				if (!found) {
					await ctx.reply(t('could_not_identify', lang));
				}
			} catch (error) {
				logger.error('Error identifying user with LLM', {
					error: error instanceof Error ? error.message : String(error),
				});
				await ctx.reply(t('could_not_identify', lang));
			}
			return;
		}

		// For registered users, handle commands
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

