// User account management conversations
import type { Conversation } from '@grammyjs/conversations';
import { InlineKeyboard } from 'grammy';
import type { BaseContext, MyContext } from '../../types.js';
import { t } from '../../utils/i18n.js';
import { UserService, type UserRole } from './model.js';
import { requireAdmin } from '../../utils/auth.js';

const userService = new UserService();

// Helper to get user's language
function getLang(ctx: MyContext): string {
	return ctx.session?.language || 'en';
}

/**
 * Register a new user account
 */
export async function registerUserConversation(conversation: Conversation<BaseContext, MyContext>, ctx: MyContext) {
	const lang = getLang(ctx);

	// Check if user already exists
	if (!ctx.from?.id) {
		await ctx.reply(t('operation_failed', lang));
		return;
	}

	const existing = await userService.getByTelegramId(ctx.from.id);
	if (existing) {
		await ctx.reply(lang === 'ar' 
			? 'أنت مسجل بالفعل! استخدم /profile لعرض معلوماتك.'
			: 'You are already registered! Use /profile to view your information.');
		return;
	}

	// Get user info from Telegram
	const firstName = ctx.from.first_name || 'User';
	const lastName = ctx.from.last_name;

	// Ask for role
	const roleKeyboard = new InlineKeyboard()
		.text('Student', 'role_student').row()
		.text('Teacher', 'role_teacher').row()
		.text(t('cancel', lang), 'cancel');

	await ctx.reply(
		lang === 'ar'
			? 'اختر دورك:\n\nطالب - للطلاب\nمعلم - للمعلمين'
			: 'Select your role:\n\nStudent - For students\nTeacher - For teachers',
		{ reply_markup: roleKeyboard }
	);

	const btnCtx = await conversation.wait();
	const roleData = btnCtx.callbackQuery?.data;

	if (!roleData || roleData === 'cancel') {
		await btnCtx.answerCallbackQuery();
		await ctx.reply(t('operation_cancelled', lang));
		return;
	}

	await btnCtx.answerCallbackQuery();

	// Delete menu
	if (btnCtx.callbackQuery?.message) {
		try {
			await ctx.api.deleteMessage(
				btnCtx.callbackQuery.message.chat.id,
				btnCtx.callbackQuery.message.message_id
			);
		} catch (err) {
			// Ignore
		}
	}

	let role: UserRole = 'student';
	if (roleData === 'role_teacher') {
		role = 'teacher';
	}

	// Ask for phone (optional)
	await ctx.reply(
		lang === 'ar'
			? 'أدخل رقم هاتفك (اختياري، أو أرسل "-" للتخطي):'
			: 'Enter your phone number (optional, or send "-" to skip):'
	);
	const phoneResponse = await conversation.wait();
	const phone = phoneResponse.message?.text?.trim();
	const phoneValue = phone && phone !== '-' ? phone : null;

	// Register user
	await ctx.reply(t('processing', lang));
	try {
		const user = await userService.register({
			telegramUserId: ctx.from.id,
			firstName,
			lastName: lastName || undefined,
			role,
			phone: phoneValue || undefined,
		});

		await ctx.reply(
			lang === 'ar'
				? `تم التسجيل بنجاح!\n\nالدور: ${role === 'student' ? 'طالب' : 'معلم'}\nالاسم: ${user.firstName} ${user.lastName || ''}`
				: `Registration successful!\n\nRole: ${role}\nName: ${user.firstName} ${user.lastName || ''}`
		);
	} catch (err) {
		await ctx.reply(t('operation_failed', lang));
	}
}

/**
 * View user profile
 */
export async function viewProfileConversation(_conversation: Conversation<BaseContext, MyContext>, ctx: MyContext) {
	const lang = getLang(ctx);

	if (!ctx.from?.id) {
		await ctx.reply(t('operation_failed', lang));
		return;
	}

	const user = await userService.getByTelegramId(ctx.from.id);

	if (!user) {
		await ctx.reply(
			lang === 'ar'
				? 'أنت غير مسجل. استخدم /register للتسجيل.'
				: 'You are not registered. Use /register to register.'
		);
		return;
	}

	const roleText = lang === 'ar'
		? (user.role === 'admin' ? 'مدير' : user.role === 'teacher' ? 'معلم' : 'طالب')
		: user.role;

	const info = lang === 'ar'
		? `
**معلومات الحساب**

معرف Telegram: \`${user.telegramUserId}\`
الدور: ${roleText}
الاسم: ${user.firstName} ${user.lastName || ''}
الهاتف: ${user.phone || 'غير متوفر'}
الحالة: ${user.isActive ? 'نشط' : 'غير نشط'}
		`.trim()
		: `
**Account Information**

Telegram User ID: \`${user.telegramUserId}\`
Role: ${roleText}
Name: ${user.firstName} ${user.lastName || ''}
Phone: ${user.phone || 'N/A'}
Status: ${user.isActive ? 'Active' : 'Inactive'}
		`.trim();

	await ctx.reply(info, { parse_mode: 'Markdown' });
}

/**
 * Admin: Assign role to user
 */
export async function assignRoleConversation(conversation: Conversation<BaseContext, MyContext>, ctx: MyContext) {
	const lang = getLang(ctx);

	if (!(await requireAdmin(ctx))) {
		return;
	}

	// Ask for Telegram user ID or username
	await ctx.reply(
		lang === 'ar'
			? 'أدخل معرف المستخدم في Telegram (User ID) أو اسم المستخدم (Username):'
			: 'Enter the Telegram User ID or Username (e.g., 123456789 or @username):'
	);

	let response = await conversation.wait();
	const input = response.message?.text?.trim();

	if (!input) {
		await ctx.reply(t('operation_failed', lang));
		return;
	}

	// Try to resolve user ID
	let telegramUserId: number | null = null;

	// If it's a number, use it directly
	const numericId = parseInt(input);
	if (!isNaN(numericId)) {
		telegramUserId = numericId;
	} else if (input.startsWith('@')) {
		// If it's a username, try to resolve it
		try {
			const username = input.slice(1); // Remove @
			const chat = await ctx.api.getChat(`@${username}`);
			if ('id' in chat) {
				telegramUserId = chat.id;
			} else {
				await ctx.reply(
					lang === 'ar'
						? 'لا يمكن العثور على المستخدم بهذا الاسم.'
						: 'Could not find user with that username.'
				);
				return;
			}
		} catch (err) {
			await ctx.reply(
				lang === 'ar'
					? 'خطأ في البحث عن المستخدم. تأكد من أن المستخدم موجود وأن البوت يمكنه الوصول إليه.'
					: 'Error finding user. Make sure the user exists and the bot can access them.'
			);
			return;
		}
	} else {
		await ctx.reply(
			lang === 'ar'
				? 'صيغة غير صحيحة. استخدم معرف المستخدم (رقم) أو اسم المستخدم (يبدأ بـ @).'
				: 'Invalid format. Use user ID (number) or username (starting with @).'
		);
		return;
	}

	if (!telegramUserId) {
		await ctx.reply(
			lang === 'ar'
				? 'معرف المستخدم غير صحيح.'
				: 'Invalid user ID.'
		);
		return;
	}

	const targetUser = await userService.getByTelegramId(telegramUserId);
	if (!targetUser) {
		await ctx.reply(
			lang === 'ar'
				? 'المستخدم غير موجود.'
				: 'User not found.'
		);
		return;
	}

	// Ask for role
	const roleKeyboard = new InlineKeyboard()
		.text('Admin', 'set_admin').row()
		.text('Teacher', 'set_teacher').row()
		.text('Student', 'set_student').row()
		.text(t('cancel', lang), 'cancel');

	await ctx.reply(
		lang === 'ar'
			? `اختر الدور الجديد للمستخدم:\n\nالمستخدم الحالي: ${targetUser.firstName} ${targetUser.lastName || ''}\nالدور الحالي: ${targetUser.role}`
			: `Select new role for user:\n\nCurrent user: ${targetUser.firstName} ${targetUser.lastName || ''}\nCurrent role: ${targetUser.role}`,
		{ reply_markup: roleKeyboard }
	);

	const btnCtx = await conversation.wait();
	const roleData = btnCtx.callbackQuery?.data;

	if (!roleData || roleData === 'cancel') {
		await btnCtx.answerCallbackQuery();
		await ctx.reply(t('operation_cancelled', lang));
		return;
	}

	await btnCtx.answerCallbackQuery();

	// Delete menu
	if (btnCtx.callbackQuery?.message) {
		try {
			await ctx.api.deleteMessage(
				btnCtx.callbackQuery.message.chat.id,
				btnCtx.callbackQuery.message.message_id
			);
		} catch (err) {
			// Ignore
		}
	}

	let newRole: UserRole = 'student';
	if (roleData === 'set_admin') {
		newRole = 'admin';
	} else if (roleData === 'set_teacher') {
		newRole = 'teacher';
	}

	// Update role
	await ctx.reply(t('processing', lang));
	try {
		await userService.updateRole(targetUser.id, newRole);
		await ctx.reply(
			lang === 'ar'
				? `تم تحديث دور المستخدم بنجاح إلى: ${newRole}`
				: `User role updated successfully to: ${newRole}`
		);
	} catch (err) {
		await ctx.reply(t('operation_failed', lang));
	}
}

/**
 * Admin: List all users
 */
export async function listUsersConversation(_conversation: Conversation<BaseContext, MyContext>, ctx: MyContext) {
	const lang = getLang(ctx);

	if (!(await requireAdmin(ctx))) {
		return;
	}

	const allUsers = await userService.getAll();

	if (allUsers.length === 0) {
		await ctx.reply(
			lang === 'ar'
				? 'لا يوجد مستخدمون مسجلون.'
				: 'No users registered.'
		);
		return;
	}

	const userList = allUsers.map((user, index) => {
		const roleText = lang === 'ar'
			? (user.role === 'admin' ? 'مدير' : user.role === 'teacher' ? 'معلم' : 'طالب')
			: user.role;
		return `${index + 1}. ${user.firstName} ${user.lastName || ''} (${roleText}) - ${user.isActive ? 'Active' : 'Inactive'}`;
	}).join('\n');

	await ctx.reply(
		lang === 'ar'
			? `**قائمة المستخدمين**\n\n${userList}`
			: `**Users List**\n\n${userList}`,
		{ parse_mode: 'Markdown' }
	);
}

