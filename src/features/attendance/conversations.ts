// Attendance conversations using simple procedural style
import type { Conversation } from '@grammyjs/conversations';
import { InlineKeyboard } from 'grammy';
import type { BaseContext, MyContext } from '../../types.js';
import { AttendanceService } from './model.js';
import { StudentService } from '../students/model.js';
import { t } from '../../utils/i18n.js';

const attendanceService = new AttendanceService();
const studentService = new StudentService();

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
	
	// Ask for event name
	await ctx.reply(t('enter_event_name', lang));
	let response = await conversation.wait();
	const event = response.message?.text?.trim();
	
	if (!event) {
		await ctx.reply(t('operation_cancelled', lang));
		return;
	}
	
	// Search for student
	await ctx.reply('Enter student name to mark attendance:');
	response = await conversation.wait();
	const searchQuery = response.message?.text?.trim();
	
	if (!searchQuery) {
		await ctx.reply(t('operation_cancelled', lang));
		return;
	}
	
	const results = await studentService.search(searchQuery);
	
	if (results.length === 0) {
		await ctx.reply(t('no_results', lang));
		return;
	}
	
	// Show results
	const keyboard = new InlineKeyboard();
	for (const result of results.slice(0, 10)) {
		const student = result.item;
		keyboard.text(
			`${student.firstName} ${student.lastName} (${student.group})`,
			`student_${student.id}`
		).row();
	}
	keyboard.text(t('cancel', lang), 'cancel');
	
	await ctx.reply(t('select_student', lang), { reply_markup: keyboard });
	
	const btnCtx = await conversation.wait();
	const selectedData = btnCtx.callbackQuery?.data;
	
	if (!selectedData || selectedData === 'cancel') {
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
	
	const studentId = parseInt(selectedData.replace('student_', ''));
	const student = await studentService.getById(studentId);
	
	if (!student) {
		await ctx.reply(t('operation_failed', lang));
		return;
	}
	
	// Check if already attended
	const hasAttended = await attendanceService.hasAttendedToday(studentId, event);
	
	if (hasAttended) {
		await ctx.reply(t('already_marked', lang));
		return;
	}
	
	// Mark present
	await ctx.reply(t('processing', lang));
	try {
		await attendanceService.markPresent(studentId, event);
		await ctx.reply(
			`${t('marked_present', lang)}: ${student.firstName} ${student.lastName} - ${event}`
		);
	} catch (err) {
		await ctx.reply(t('operation_failed', lang));
	}
}

