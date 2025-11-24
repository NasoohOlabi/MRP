// Student conversations using simple procedural style
import type { Conversation } from '@grammyjs/conversations';
import { InlineKeyboard } from 'grammy';
import type { BaseContext, MyContext } from '../../types.js';
import { getCurrentUser } from '../../utils/auth.js';
import { t } from '../../utils/i18n.js';
import { StudentService, type Student } from './model.js';

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

	// Check user role - teachers can only view, admins can do everything
	const user = await getCurrentUser(ctx);
	const isTeacherOnly = user?.role === 'teacher';

	// Show menu based on role
	const keyboard = new InlineKeyboard();

	if (!isTeacherOnly) {
		// Admin can create, update, delete, and view
		keyboard
			.text(t('create', lang), 'create').row()
			.text(t('update', lang), 'update').row()
			.text(t('delete', lang), 'delete').row()
			.text(t('view_info', lang), 'view_info').row()
			.text(t('cancel', lang), 'cancel');
	} else {
		// Teacher can only view (read-only)
		keyboard
			.text(t('view_info', lang), 'view_info').row()
			.text(t('cancel', lang), 'cancel');
	}

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
	// Teachers can only access view_info
	if (isTeacherOnly && action !== 'view_info') {
		await ctx.reply(lang === 'ar'
			? 'ليس لديك صلاحية للوصول إلى هذه العملية.'
			: 'You don\'t have permission to access this operation.');
		return;
	}

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
	let student = await studentService.getById(studentId);

	if (!student) {
		await ctx.reply(t('operation_failed', lang));
		return;
	}

	// Keep track of updates
	const updates: Partial<Student> = {};

	// Field selection loop
	while (true) {
		// Show current student info and field selection menu
		const currentInfo = `
**Current Student Information:**
Name: ${student.firstName} ${student.lastName}
Group: ${student.group || 'None'}
Phone: ${student.phone || 'None'}
Father's Phone: ${student.fatherPhone || 'None'}
Mother's Phone: ${student.motherPhone || 'None'}

Select a field to update:
		`.trim();

		const fieldKeyboard = new InlineKeyboard()
			.text('First Name', 'field_firstName').row()
			.text('Last Name', 'field_lastName').row()
			.text('Group', 'field_group').row()
			.text('Phone', 'field_phone').row()
			.text("Father's Phone", 'field_fatherPhone').row()
			.text("Mother's Phone", 'field_motherPhone').row()
			.text('Finish & Save', 'field_finish').row()
			.text(t('cancel', lang), 'field_cancel');

		await ctx.reply(currentInfo, { parse_mode: 'Markdown', reply_markup: fieldKeyboard });

		const fieldCtx = await conversation.wait();
		const fieldAction = fieldCtx.callbackQuery?.data;

		if (!fieldAction) {
			await ctx.reply(t('operation_failed', lang));
			return;
		}

		await fieldCtx.answerCallbackQuery();

		// Delete field selection menu
		if (fieldCtx.callbackQuery?.message) {
			try {
				await ctx.api.deleteMessage(
					fieldCtx.callbackQuery.message.chat.id,
					fieldCtx.callbackQuery.message.message_id
				);
			} catch (err) {
				// Ignore
			}
		}

		if (fieldAction === 'field_cancel') {
			await ctx.reply(t('operation_cancelled', lang));
			return;
		}

		if (fieldAction === 'field_finish') {
			// Save all updates
			await ctx.reply(t('processing', lang));
			try {
				await studentService.update({
					...student,
					...updates,
				});
				await ctx.reply(t('operation_completed', lang));
				return;
			} catch (err) {
				await ctx.reply(t('operation_failed', lang));
				return;
			}
		}

		// Handle field updates
		if (fieldAction === 'field_firstName') {
			await ctx.reply(`Enter new first name (current: ${student.firstName}):`);
			response = await conversation.wait();
			const newValue = response.message?.text?.trim();
			if (newValue) {
				updates.firstName = newValue;
				student = { ...student, firstName: newValue };
				await ctx.reply('First name updated!');
			}
		} else if (fieldAction === 'field_lastName') {
			await ctx.reply(`Enter new last name (current: ${student.lastName}):`);
			response = await conversation.wait();
			const newValue = response.message?.text?.trim();
			if (newValue) {
				updates.lastName = newValue;
				student = { ...student, lastName: newValue };
				await ctx.reply('Last name updated!');
			}
		} else if (fieldAction === 'field_group') {
			// Get all existing groups
			const groups = await studentService.getAllGroups();

			const groupKeyboard = new InlineKeyboard();

			// Add existing groups as buttons
			if (groups.length > 0) {
				for (const group of groups.slice(0, 10)) {
					// Truncate group name if too long for callback data (64 byte limit)
					const callbackData = `group_${group}`;
					if (callbackData.length <= 64) {
						groupKeyboard.text(group, callbackData).row();
					}
				}
			}

			// Add option to remove group (only if student has a group)
			if (student.group) {
				groupKeyboard.text('Remove Group', 'group_remove').row();
			}
			groupKeyboard.text(t('cancel', lang), 'group_cancel');

			const groupMessage = groups.length === 0
				? `No groups available. Current group: ${student.group || 'None'}`
				: `Select a group (current: ${student.group || 'None'}):`;

			await ctx.reply(groupMessage, { reply_markup: groupKeyboard });

			const groupCtx = await conversation.wait();
			const groupAction = groupCtx.callbackQuery?.data;

			await groupCtx.answerCallbackQuery();

			// Delete group selection menu
			if (groupCtx.callbackQuery?.message) {
				try {
					await ctx.api.deleteMessage(
						groupCtx.callbackQuery.message.chat.id,
						groupCtx.callbackQuery.message.message_id
					);
				} catch (err) {
					// Ignore
				}
			}

			if (groupAction && groupAction.startsWith('group_')) {
				if (groupAction === 'group_remove') {
					updates.group = null;
					student = { ...student, group: null };
					await ctx.reply('Group removed!');
				} else if (groupAction !== 'group_cancel') {
					// Extract group name by removing the 'group_' prefix (6 characters)
					const selectedGroup = groupAction.substring(6);
					updates.group = selectedGroup;
					student = { ...student, group: selectedGroup };
					await ctx.reply(`Group updated to: ${selectedGroup}`);
				}
			}
		} else if (fieldAction === 'field_phone') {
			await ctx.reply(`Enter new phone (current: ${student.phone || 'None'}, or send "-" to remove):`);
			response = await conversation.wait();
			const newValue = response.message?.text?.trim();
			if (newValue === '-') {
				updates.phone = null;
				student = { ...student, phone: null };
				await ctx.reply('Phone removed!');
			} else if (newValue) {
				updates.phone = newValue;
				student = { ...student, phone: newValue };
				await ctx.reply('Phone updated!');
			}
		} else if (fieldAction === 'field_fatherPhone') {
			await ctx.reply(`Enter new father's phone (current: ${student.fatherPhone || 'None'}, or send "-" to remove):`);
			response = await conversation.wait();
			const newValue = response.message?.text?.trim();
			if (newValue === '-') {
				updates.fatherPhone = null;
				student = { ...student, fatherPhone: null };
				await ctx.reply("Father's phone removed!");
			} else if (newValue) {
				updates.fatherPhone = newValue;
				student = { ...student, fatherPhone: newValue };
				await ctx.reply("Father's phone updated!");
			}
		} else if (fieldAction === 'field_motherPhone') {
			await ctx.reply(`Enter new mother's phone (current: ${student.motherPhone || 'None'}, or send "-" to remove):`);
			response = await conversation.wait();
			const newValue = response.message?.text?.trim();
			if (newValue === '-') {
				updates.motherPhone = null;
				student = { ...student, motherPhone: null };
				await ctx.reply("Mother's phone removed!");
			} else if (newValue) {
				updates.motherPhone = newValue;
				student = { ...student, motherPhone: newValue };
				await ctx.reply("Mother's phone updated!");
			}
		}
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

