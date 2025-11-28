// Attendance conversations using simple procedural style
import type { Conversation } from '@grammyjs/conversations';
import { InlineKeyboard } from 'grammy';
import type { BaseContext, MyContext } from '../../types.js';
import { t } from '../../utils/i18n.js';
import { browseByEventConversation } from './conversations/flows/browseByEvent.js';
import { browseByStudentConversation } from './conversations/flows/browseByStudent.js';
import { markAttendanceConversation } from './conversations/flows/markAttendance.js';
import { eventAttendanceConversation } from './conversations/flows/takeEventAttendance.js';

// Helper to get user's language
function getLang(ctx: MyContext): string {
	return ctx.session?.language || 'en';
}

// Main attendance conversation
export async function attendanceConversation(conversation: Conversation<BaseContext, MyContext>, ctx: MyContext) {
	// Ensure session is initialized
	if (!ctx.session) {
		ctx.session = { state: 'START', language: 'en' };
	}
	const lang = getLang(ctx);

	// Show menu with options
	const keyboard = new InlineKeyboard()
		.text(t('mark_attendance', lang) || 'Mark Attendance', 'mark_attendance').row()
		.text(t('by_group', lang) || 'By Group', 'by_group').row()
		.text(t('browse_by_date', lang) || 'Browse by Date', 'browse_by_event').row()
		.text(t('browse_by_student', lang) || 'Browse by Student', 'browse_by_student').row()
		.text(t('cancel', lang), 'cancel');

	await ctx.reply(t('attendance_menu', lang) || 'What would you like to do?', { reply_markup: keyboard });

	const btnCtx = await conversation.wait();
	const action = btnCtx.callbackQuery?.data;

	if (!action || action === 'cancel') {
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

	// Route to appropriate function
	if (action === 'mark_attendance') {
		await markAttendanceConversation(conversation, ctx);
	} else if (action === 'by_group') {
		await eventAttendanceConversation(conversation, ctx);
	} else if (action === 'browse_by_event') {
		await browseByEventConversation(conversation, ctx);
	} else if (action === 'browse_by_student') {
		await browseByStudentConversation(conversation, ctx);
	}
}

