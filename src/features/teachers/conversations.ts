// Teacher conversations using simple procedural style
import type { Conversation } from '@grammyjs/conversations';
import { InlineKeyboard } from 'grammy';
import type { BaseContext, MyContext } from '../../types.js';
import { TeacherService } from './model.js';
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

// Create a new teacher
async function createTeacherConversation(conversation: Conversation<BaseContext, MyContext>, ctx: MyContext) {
	const lang = getLang(ctx);
	
	// Ask for first name
	await ctx.reply(t('enter_first_name', lang));
	let response = await conversation.wait();
	while (!response.message?.text?.trim()) {
		await ctx.reply(t('enter_first_name', lang));
		response = await conversation.wait();
	}
	const firstName = response.message.text.trim();
	
	// Ask for last name
	await ctx.reply(t('enter_last_name', lang));
	response = await conversation.wait();
	while (!response.message?.text?.trim()) {
		await ctx.reply(t('enter_last_name', lang));
		response = await conversation.wait();
	}
	const lastName = response.message.text.trim();
	
	// Ask for phone number
	await ctx.reply(t('enter_phone', lang));
	response = await conversation.wait();
	while (!response.message?.text?.trim()) {
		await ctx.reply(t('enter_phone', lang));
		response = await conversation.wait();
	}
	const phoneNumber = response.message.text.trim();
	
	// Ask for group
	await ctx.reply(t('enter_group', lang));
	response = await conversation.wait();
	while (!response.message?.text?.trim()) {
		await ctx.reply(t('enter_group', lang));
		response = await conversation.wait();
	}
	const group = response.message.text.trim();
	
	// Save to database
	await ctx.reply(t('processing', lang));
	try {
		const teacher = await teacherService.register({
			firstName,
			lastName,
			phoneNumber,
			group,
		});
		await ctx.reply(
			`${t('operation_completed', lang)}\n\nTeacher ID: ${teacher.id}\nName: ${teacher.firstName} ${teacher.lastName}`
		);
	} catch (err) {
		if (err instanceof Error && err.message === 'Phone number already exists') {
			await ctx.reply('Error: Phone number already exists.');
		} else {
			await ctx.reply(t('operation_failed', lang));
		}
	}
}

// Update an existing teacher
async function updateTeacherConversation(conversation: Conversation<BaseContext, MyContext>, ctx: MyContext) {
	const lang = getLang(ctx);
	
	// Search for teacher
	await ctx.reply('Enter the teacher name to search:');
	let response = await conversation.wait();
	const searchQuery = response.message?.text?.trim();
	
	if (!searchQuery) {
		await ctx.reply(t('operation_failed', lang));
		return;
	}
	
	const results = await teacherService.search(searchQuery);
	
	if (results.length === 0) {
		await ctx.reply(t('no_results', lang));
		return;
	}
	
	// Show results
	const keyboard = new InlineKeyboard();
	for (const result of results.slice(0, 10)) {
		const teacher = result.item;
		keyboard.text(
			`${teacher.firstName} ${teacher.lastName} (${teacher.group})`,
			`teacher_${teacher.id}`
		).row();
	}
	keyboard.text(t('cancel', lang), 'cancel');
	
	await ctx.reply('Select a teacher:', { reply_markup: keyboard });
	
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
	
	const teacherId = parseInt(selectedData.replace('teacher_', ''));
	const teacher = await teacherService.getById(teacherId);
	
	if (!teacher) {
		await ctx.reply(t('operation_failed', lang));
		return;
	}
	
	// Ask what to update
	await ctx.reply('Enter new first name (or send "-" to keep current):');
	response = await conversation.wait();
	const newFirstName = response.message?.text?.trim();
	const firstName = newFirstName && newFirstName !== '-' ? newFirstName : teacher.firstName;
	
	await ctx.reply('Enter new last name (or send "-" to keep current):');
	response = await conversation.wait();
	const newLastName = response.message?.text?.trim();
	const lastName = newLastName && newLastName !== '-' ? newLastName : teacher.lastName;
	
	await ctx.reply('Enter new group (or send "-" to keep current):');
	response = await conversation.wait();
	const newGroup = response.message?.text?.trim();
	const group = newGroup && newGroup !== '-' ? newGroup : teacher.group;
	
	// Save updates
	await ctx.reply(t('processing', lang));
	try {
		await teacherService.update({
			...teacher,
			firstName,
			lastName,
			group,
		});
		await ctx.reply(t('operation_completed', lang));
	} catch (err) {
		await ctx.reply(t('operation_failed', lang));
	}
}

// Delete a teacher
async function deleteTeacherConversation(conversation: Conversation<BaseContext, MyContext>, ctx: MyContext) {
	const lang = getLang(ctx);
	
	// Search for teacher
	await ctx.reply('Enter the teacher name to search:');
	let response = await conversation.wait();
	const searchQuery = response.message?.text?.trim();
	
	if (!searchQuery) {
		await ctx.reply(t('operation_failed', lang));
		return;
	}
	
	const results = await teacherService.search(searchQuery);
	
	if (results.length === 0) {
		await ctx.reply(t('no_results', lang));
		return;
	}
	
	// Show results
	const keyboard = new InlineKeyboard();
	for (const result of results.slice(0, 10)) {
		const teacher = result.item;
		keyboard.text(
			`${teacher.firstName} ${teacher.lastName} (${teacher.group})`,
			`teacher_${teacher.id}`
		).row();
	}
	keyboard.text(t('cancel', lang), 'cancel');
	
	await ctx.reply('Select a teacher:', { reply_markup: keyboard });
	
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
	
	const teacherId = parseInt(selectedData.replace('teacher_', ''));
	const teacher = await teacherService.getById(teacherId);
	
	if (!teacher) {
		await ctx.reply(t('operation_failed', lang));
		return;
	}
	
	// Confirm deletion
	const confirmKeyboard = new InlineKeyboard()
		.text('Yes, delete', 'confirm_delete')
		.text(t('cancel', lang), 'cancel');
	
	await ctx.reply(
		`Are you sure you want to delete ${teacher.firstName} ${teacher.lastName}?`,
		{ reply_markup: confirmKeyboard }
	);
	
	const confirmCtx = await conversation.wait();
	const confirmation = confirmCtx.callbackQuery?.data;
	
	await confirmCtx.answerCallbackQuery();
	
	// Delete confirmation menu
	if (confirmCtx.callbackQuery?.message) {
		try {
			await ctx.api.deleteMessage(
				confirmCtx.callbackQuery.message.chat.id,
				confirmCtx.callbackQuery.message.message_id
			);
		} catch (err) {
			// Ignore
		}
	}
	
	if (confirmation === 'confirm_delete') {
		await ctx.reply(t('processing', lang));
		try {
			await teacherService.remove(teacherId);
			await ctx.reply(t('operation_completed', lang));
		} catch (err) {
			await ctx.reply(t('operation_failed', lang));
		}
	} else {
		await ctx.reply(t('operation_cancelled', lang));
	}
}

