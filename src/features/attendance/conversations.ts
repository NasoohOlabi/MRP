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
	
	// Show menu with options
	const keyboard = new InlineKeyboard()
		.text(t('mark_attendance', lang) || 'Mark Attendance', 'mark_attendance').row()
		.text(t('browse_by_event', lang) || 'Browse by Event', 'browse_by_event').row()
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
	} else if (action === 'browse_by_event') {
		await browseByEventConversation(conversation, ctx);
	} else if (action === 'browse_by_student') {
		await browseByStudentConversation(conversation, ctx);
	}
}

// Mark attendance conversation
async function markAttendanceConversation(conversation: Conversation<BaseContext, MyContext>, ctx: MyContext) {
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

// Browse attendance by event
async function browseByEventConversation(conversation: Conversation<BaseContext, MyContext>, ctx: MyContext) {
	const lang = getLang(ctx);
	
	// Ask for event name
	await ctx.reply(t('enter_event_name', lang));
	let response = await conversation.wait();
	const event = response.message?.text?.trim();
	
	if (!event) {
		await ctx.reply(t('operation_cancelled', lang));
		return;
	}
	
	// Get attendance records for the event
	await ctx.reply(t('processing', lang));
	try {
		const { records } = await attendanceService.getEventAttendance(event, { limit: 100 });
		
		if (records.length === 0) {
			await ctx.reply(t('no_results', lang));
			return;
		}
		
		// Group by date and get student info
		const attendanceByDate: Record<string, Array<{ studentId: number; createdAt: Date }>> = {};
		for (const record of records) {
			const dateKey = record.createdAt.toISOString().split('T')[0];
			if (!attendanceByDate[dateKey]) {
				attendanceByDate[dateKey] = [];
			}
			attendanceByDate[dateKey].push({ studentId: record.studentId, createdAt: record.createdAt });
		}
		
		// Build message
		let message = `**${t('attendance_for', lang).replace('{event}', event)}**\n\n`;
		
		for (const [date, attendances] of Object.entries(attendanceByDate).sort().reverse()) {
			message += `**${date}** (${attendances.length} ${attendances.length === 1 ? 'student' : 'students'})\n`;
			
			// Get student names
			for (const att of attendances.slice(0, 20)) {
				const student = await studentService.getById(att.studentId);
				if (student) {
					const time = new Date(att.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
					message += `• ${student.firstName} ${student.lastName}${student.group ? ` (${student.group})` : ''} - ${time}\n`;
				}
			}
			
			if (attendances.length > 20) {
				message += `... and ${attendances.length - 20} more\n`;
			}
			
			message += '\n';
		}
		
		await ctx.reply(message, { parse_mode: 'Markdown' });
	} catch (err) {
		await ctx.reply(t('operation_failed', lang));
	}
}

// Browse attendance by student
async function browseByStudentConversation(conversation: Conversation<BaseContext, MyContext>, ctx: MyContext) {
	const lang = getLang(ctx);
	
	// Search for student
	await ctx.reply('Enter student name to view attendance:');
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
	
	// Get attendance records for the student
	await ctx.reply(t('processing', lang));
	try {
		const { records } = await attendanceService.getStudentAttendance(studentId, { limit: 100 });
		
		if (records.length === 0) {
			await ctx.reply(t('no_results', lang));
			return;
		}
		
		// Group by event
		const attendanceByEvent: Record<string, Date[]> = {};
		for (const record of records) {
			if (!attendanceByEvent[record.event]) {
				attendanceByEvent[record.event] = [];
			}
			attendanceByEvent[record.event].push(record.createdAt);
		}
		
		// Build message
		let message = `**Attendance for ${student.firstName} ${student.lastName}**\n\n`;
		
		for (const [event, dates] of Object.entries(attendanceByEvent).sort()) {
			message += `**${event}**: ${dates.length} ${dates.length === 1 ? 'time' : 'times'}\n`;
			
			// Show recent dates
			const recentDates = dates
				.sort((a, b) => b.getTime() - a.getTime())
				.slice(0, 10)
				.map(d => d.toISOString().split('T')[0]);
			
			message += `Recent: ${recentDates.join(', ')}\n`;
			if (dates.length > 10) {
				message += `... and ${dates.length - 10} more\n`;
			}
			message += '\n';
		}
		
		await ctx.reply(message, { parse_mode: 'Markdown' });
	} catch (err) {
		await ctx.reply(t('operation_failed', lang));
	}
}

