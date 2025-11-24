// Memorization conversations using simple procedural style
import type { Conversation } from '@grammyjs/conversations';
import { InlineKeyboard } from 'grammy';
import type { BaseContext, MyContext } from '../../types.js';
import { MemorizationService } from './model.js';
import { StudentService } from '../students/model.js';
import { t } from '../../utils/i18n.js';

const memorizationService = new MemorizationService();
const studentService = new StudentService();

// Helper to get user's language
function getLang(ctx: MyContext): string {
	return ctx.session?.language || 'en';
}

// Main memorization conversation
export async function memorizationConversation(conversation: Conversation<BaseContext, MyContext>, ctx: MyContext) {
	// Ensure session is initialized
	if (!ctx.session) {
		ctx.session = { state: 'START', language: 'en' };
	}
	const lang = getLang(ctx);
	
	// Search for student
	await ctx.reply(t('enter_student_name', lang));
	let response = await conversation.wait();
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
			`${student.firstName} ${student.lastName}${student.group ? ` (${student.group})` : ''}`,
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
	
	// Ask for page number
	await ctx.reply(
		t('selected_student_enter_page', lang).replace('{name}', `${student.firstName} ${student.lastName}`)
	);
	
	let page: number | null = null;
	while (page === null) {
		response = await conversation.wait();
		const text = response.message?.text?.trim();
		if (text && /^\d+$/.test(text)) {
			const num = parseInt(text);
			if (num >= 0 && num <= 604) {
				page = num;
			} else {
				await ctx.reply(t('invalid_page', lang));
			}
		} else {
			await ctx.reply(t('invalid_page', lang));
		}
	}
	
	// Save memorization
	await ctx.reply(t('processing', lang));
	try {
		await memorizationService.record(studentId, page);
		await ctx.reply(t('memorization_saved', lang));
	} catch (err) {
		await ctx.reply(t('memorization_failed', lang));
	}
}

