// Teacher conversations using simple procedural style
import type { Conversation } from '@grammyjs/conversations';
import { InlineKeyboard } from 'grammy';
import type { BaseContext, MyContext } from '../../types.js';
import { TeacherService } from './model.js';
import type { Teacher } from './model.js';
import { t } from '../../utils/i18n.js';

const teacherService = new TeacherService();

// Helper to get user's language
function getLang(ctx: MyContext): string {
	return ctx.session?.language || 'en';
}

// Main teacher menu
export async function teacherMenuConversation(conversation: Conversation<BaseContext, MyContext>, ctx: MyContext) {
	// Ensure session is initialized
	if (!ctx.session) {
		ctx.session = { state: 'START', language: 'en' };
	}
	const lang = getLang(ctx);
	
	// Show menu
	const keyboard = new InlineKeyboard()
		.text(t('create', lang), 'create').row()
		.text(t('update', lang), 'update').row()
		.text(t('delete', lang), 'delete').row()
		.text(t('cancel', lang), 'cancel');
	
	await ctx.reply(t('what_operation', lang), { reply_markup: keyboard });
	
	// Wait for button selection
	const btnCtx = await conversation.wait();
	const action = btnCtx.callbackQuery?.data;
	
	if (!action) {
		await ctx.reply(t('operation_failed', lang));
		return;
	}
	
	await btnCtx.answerCallbackQuery();
	
	// Delete the menu message
	if (btnCtx.callbackQuery?.message) {
		try {
			await ctx.api.deleteMessage(
				btnCtx.callbackQuery.message.chat.id,
				btnCtx.callbackQuery.message.message_id
			);
		} catch (err) {
			// Ignore deletion errors
		}
	}
	
	if (action === 'cancel') {
		await ctx.reply(t('operation_cancelled', lang));
		return;
	}
	
	// Route to appropriate conversation
	if (action === 'create') {
		await createTeacherConversation(conversation, ctx);
	} else if (action === 'update') {
		await updateTeacherConversation(conversation, ctx);
	} else if (action === 'delete') {
		await deleteTeacherConversation(conversation, ctx);
	}
}

async function promptForNonEmptyText(
	conversation: Conversation<BaseContext, MyContext>,
	ctx: MyContext,
	lang: string,
	key: string,
	fallback: string
): Promise<string> {
	while (true) {
		await ctx.reply(t(key, lang) || fallback);
		const response = await conversation.wait();
		const text = response.message?.text?.trim();
		if (text) {
			return text;
		}
	}
}

async function selectTeacherFromSearch(
	conversation: Conversation<BaseContext, MyContext>,
	ctx: MyContext,
	lang: string
): Promise<Teacher | null> {
	const searchQuery = await promptForNonEmptyText(
		conversation,
		ctx,
		lang,
		'enter_teacher_name_search',
		'Enter the teacher name to search:'
	);

	const results = await teacherService.search(searchQuery);
	if (results.length === 0) {
		await ctx.reply(t('no_results', lang));
		return null;
	}

	const keyboard = new InlineKeyboard();
	for (const result of results.slice(0, 10)) {
		const teacher = result.item;
		keyboard.text(teacher.name, `teacher_${teacher.id}`).row();
	}
	keyboard.text(t('cancel', lang), 'cancel');

	const message = await ctx.reply(t('select_teacher', lang) || 'Select a teacher:', {
		reply_markup: keyboard,
	});

	while (true) {
		const btnCtx = await conversation.wait();
		const selectedData = btnCtx.callbackQuery?.data;

		if (!selectedData) {
			if (btnCtx.callbackQuery) {
				await btnCtx.answerCallbackQuery();
			}
			continue;
		}

		await btnCtx.answerCallbackQuery();
		if (btnCtx.callbackQuery?.message) {
			try {
				await ctx.api.deleteMessage(
					btnCtx.callbackQuery.message.chat.id,
					btnCtx.callbackQuery.message.message_id
				);
			} catch {
				// Ignore failures
			}
		}

		if (selectedData === 'cancel') {
			return null;
		}

		const teacherId = parseInt(selectedData.replace('teacher_', ''), 10);
		if (Number.isNaN(teacherId)) {
			continue;
		}

		return teacherService.getById(teacherId);
	}
}

// Create a new teacher
async function createTeacherConversation(conversation: Conversation<BaseContext, MyContext>, ctx: MyContext) {
	const lang = getLang(ctx);
	const name = await promptForNonEmptyText(
		conversation,
		ctx,
		lang,
		'enter_teacher_name',
		'Enter teacher name:'
	);

	await ctx.reply(t('processing', lang));
	try {
		const teacher = await teacherService.register({ name });
		await ctx.reply(
			`${t('operation_completed', lang)}\n\nTeacher ID: ${teacher.id}\nName: ${teacher.name}`
		);
	} catch (err) {
		if (err instanceof Error && err.message === 'Teacher already exists') {
			await ctx.reply('Teacher already exists.');
		} else {
			await ctx.reply(t('operation_failed', lang));
		}
	}
}

// Update an existing teacher
async function updateTeacherConversation(conversation: Conversation<BaseContext, MyContext>, ctx: MyContext) {
	const lang = getLang(ctx);
	const teacher = await selectTeacherFromSearch(conversation, ctx, lang);
	if (!teacher) {
		await ctx.reply(t('operation_cancelled', lang));
		return;
	}

	await ctx.reply(
		t('enter_teacher_new_name', lang) || "Enter new teacher name (or '-' to keep current):"
	);
	const response = await conversation.wait();
	const newNameInput = response.message?.text?.trim();
	const updatedName = newNameInput && newNameInput !== '-' ? newNameInput : teacher.name;

	await ctx.reply(t('processing', lang));
	try {
		await teacherService.update({ ...teacher, name: updatedName });
		await ctx.reply(t('operation_completed', lang));
	} catch (err) {
		await ctx.reply(t('operation_failed', lang));
	}
}

// Delete a teacher
async function deleteTeacherConversation(conversation: Conversation<BaseContext, MyContext>, ctx: MyContext) {
	const lang = getLang(ctx);
	const teacher = await selectTeacherFromSearch(conversation, ctx, lang);
	if (!teacher) {
		await ctx.reply(t('operation_cancelled', lang));
		return;
	}

	const confirmKeyboard = new InlineKeyboard()
		.text(t('confirm_delete_yes', lang) || 'Yes, delete', 'confirm_delete')
		.text(t('cancel', lang), 'cancel');

	await ctx.reply(
		(t('confirm_delete_prompt', lang) || 'Are you sure you want to delete {name}?').replace('{name}', teacher.name),
		{ reply_markup: confirmKeyboard }
	);

	const confirmCtx = await conversation.wait();
	const confirmation = confirmCtx.callbackQuery?.data;
	await confirmCtx.answerCallbackQuery();

	if (confirmCtx.callbackQuery?.message) {
		try {
			await ctx.api.deleteMessage(
				confirmCtx.callbackQuery.message.chat.id,
				confirmCtx.callbackQuery.message.message_id
			);
		} catch {
			// Ignore
		}
	}

	if (confirmation === 'confirm_delete') {
		await ctx.reply(t('processing', lang));
		try {
			await teacherService.remove(teacher.id);
			await ctx.reply(t('operation_completed', lang));
		} catch (err) {
			await ctx.reply(t('operation_failed', lang));
		}
	} else {
		await ctx.reply(t('operation_cancelled', lang));
	}
}

