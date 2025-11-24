// Student conversations using simple procedural style
import type { Conversation } from '@grammyjs/conversations';
import { InlineKeyboard } from 'grammy';
import type { BaseContext, MyContext } from '../../types.js';
import { t } from '../../utils/i18n.js';
import { StudentService } from './model.js';

const studentService = new StudentService();

// Helper to get user's language
function getLang(ctx: MyContext): string {
	return ctx.session?.language || 'en';
}

// Main student menu
export async function studentMenuConversation(conversation: Conversation<BaseContext, MyContext>, ctx: MyContext) {
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
		.text(t('view_info', lang), 'view_info').row()
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
		await createStudentConversation(conversation, ctx);
	} else if (action === 'update') {
		await updateStudentConversation(conversation, ctx);
	} else if (action === 'delete') {
		await deleteStudentConversation(conversation, ctx);
	} else if (action === 'view_info') {
		await viewStudentConversation(conversation, ctx);
	}
}

// Create a new student
async function createStudentConversation(conversation: Conversation<BaseContext, MyContext>, ctx: MyContext) {
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

	// Ask for birth year
	await ctx.reply(t('enter_birth_year', lang));
	let birthYear: number | null = null;
	while (birthYear === null) {
		response = await conversation.wait();
		const text = response.message?.text?.trim();
		if (text && /^\d{4}$/.test(text)) {
			birthYear = parseInt(text);
		} else {
			await ctx.reply('Invalid year format. Please enter a 4-digit year (e.g., 2010).');
		}
	}

	// Ask for group (optional)
	await ctx.reply(t('enter_group_optional', lang) || `${t('enter_group', lang)} (${t('optional', lang) || 'optional'})`);
	response = await conversation.wait();
	const group = response.message?.text?.trim() || null;

	// Ask for phone (optional)
	await ctx.reply(t('enter_phone_optional', lang));
	response = await conversation.wait();
	const phone = response.message?.text?.trim() || null;

	// Ask for father's phone (optional)
	await ctx.reply(t('enter_father_phone_optional', lang));
	response = await conversation.wait();
	const fatherPhone = response.message?.text?.trim() || null;

	// Ask for mother's phone (optional)
	await ctx.reply(t('enter_mother_phone_optional', lang));
	response = await conversation.wait();
	const motherPhone = response.message?.text?.trim() || null;

	// Save to database
	await ctx.reply(t('processing', lang));
	try {
		const student = await studentService.register({
			firstName,
			lastName,
			birthYear,
			group,
			phone,
			fatherPhone,
			motherPhone,
		});
		await ctx.reply(
			`${t('operation_completed', lang)}\n\nStudent ID: ${student.id}\nName: ${student.firstName} ${student.lastName}`
		);
	} catch (err) {
		await ctx.reply(t('operation_failed', lang));
	}
}

// Update an existing student
async function updateStudentConversation(conversation: Conversation<BaseContext, MyContext>, ctx: MyContext) {
	const lang = getLang(ctx);

	// Search for student
	await ctx.reply('Enter the student name to search:');
	let response = await conversation.wait();
	const searchQuery = response.message?.text?.trim();

	if (!searchQuery) {
		await ctx.reply(t('operation_failed', lang));
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

	// Ask what to update
	await ctx.reply('Enter new first name (or send "-" to keep current):');
	response = await conversation.wait();
	const newFirstName = response.message?.text?.trim();
	const firstName = newFirstName && newFirstName !== '-' ? newFirstName : student.firstName;

	await ctx.reply('Enter new last name (or send "-" to keep current):');
	response = await conversation.wait();
	const newLastName = response.message?.text?.trim();
	const lastName = newLastName && newLastName !== '-' ? newLastName : student.lastName;

	await ctx.reply('Enter new group (or send "-" to keep current, or send empty to remove):');
	response = await conversation.wait();
	const newGroup = response.message?.text?.trim();
	const group = newGroup === '-' ? student.group : (newGroup || null);

	// Save updates
	await ctx.reply(t('processing', lang));
	try {
		await studentService.update({
			...student,
			firstName,
			lastName,
			group,
		});
		await ctx.reply(t('operation_completed', lang));
	} catch (err) {
		await ctx.reply(t('operation_failed', lang));
	}
}

// Delete a student
async function deleteStudentConversation(conversation: Conversation<BaseContext, MyContext>, ctx: MyContext) {
	const lang = getLang(ctx);

	// Search for student
	await ctx.reply('Enter the student name to search:');
	let response = await conversation.wait();
	const searchQuery = response.message?.text?.trim();

	if (!searchQuery) {
		await ctx.reply(t('operation_failed', lang));
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

	// Confirm deletion
	const confirmKeyboard = new InlineKeyboard()
		.text('Yes, delete', 'confirm_delete')
		.text(t('cancel', lang), 'cancel');

	await ctx.reply(
		`Are you sure you want to delete ${student.firstName} ${student.lastName}?`,
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
			await studentService.remove(studentId);
			await ctx.reply(t('operation_completed', lang));
		} catch (err) {
			await ctx.reply(t('operation_failed', lang));
		}
	} else {
		await ctx.reply(t('operation_cancelled', lang));
	}
}

// View student information
async function viewStudentConversation(conversation: Conversation<BaseContext, MyContext>, ctx: MyContext) {
	const lang = getLang(ctx);

	// Search for student
	await ctx.reply('Enter the student name to search:');
	let response = await conversation.wait();
	const searchQuery = response.message?.text?.trim();

	if (!searchQuery) {
		await ctx.reply(t('operation_failed', lang));
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

	// Display student info
	const info = `
**Student Information**

ID: ${student.id}
Name: ${student.firstName} ${student.lastName}
Birth Year: ${student.birthYear}
Group: ${student.group || 'N/A'}
Phone: ${student.phone || 'N/A'}
Father's Phone: ${student.fatherPhone || 'N/A'}
Mother's Phone: ${student.motherPhone || 'N/A'}
	`.trim();

	await ctx.reply(info, { parse_mode: 'Markdown' });
}

