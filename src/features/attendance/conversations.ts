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
	} else if (action === 'browse_by_event') {
		await browseByEventConversation(conversation, ctx);
	} else if (action === 'browse_by_student') {
		await browseByStudentConversation(conversation, ctx);
	}
}

// Mark attendance conversation
async function markAttendanceConversation(conversation: Conversation<BaseContext, MyContext>, ctx: MyContext) {
	const lang = getLang(ctx);
	
	// Ask for date
	await ctx.reply(`${t('enter_date', lang) || 'Enter date (YYYY-MM-DD) or /today'}`);
	let response = await conversation.wait();
	let dateInput = response.message?.text?.trim();
	
	if (!dateInput) {
		await ctx.reply(t('operation_cancelled', lang));
		return;
	}
	
	// If user replied with /today, set date to current date in YYYY-MM-DD format
	let date: string;
	if (dateInput === '/today') {
		const now = new Date();
		const year = now.getFullYear();
		const month = String(now.getMonth() + 1).padStart(2, '0');
		const day = String(now.getDate()).padStart(2, '0');
		date = `${year}-${month}-${day}`;
	} else if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
		date = dateInput;
	} else {
		await ctx.reply(t('invalid_date_format', lang) || 'Invalid date format. Please use YYYY-MM-DD or /today');
		return;
	}
	
	// Search for student
	await ctx.reply(t('enter_student_name_mark_attendance', lang));
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
			`${student.firstName} ${student.lastName}${student.level ? ` (Level ${student.level})` : ''}`,
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
	
	// Check if already has attendance record for this date
	const hasRecord = await attendanceService.hasRecordOnDate(studentId, date);
	if (hasRecord) {
		await ctx.reply(t('already_marked', lang) || `Attendance already marked for ${date}`);
		return;
	}
	
	// Mark present
	await ctx.reply(t('processing', lang));
	try {
		await attendanceService.markPresent(studentId, date);
		await ctx.reply(
			`${t('marked_present', lang) || 'Marked present'}: ${student.firstName} ${student.lastName} - ${date}`
		);
	} catch (err) {
		await ctx.reply(t('operation_failed', lang));
	}
}

// Browse attendance by date
async function browseByEventConversation(conversation: Conversation<BaseContext, MyContext>, ctx: MyContext) {
	const lang = getLang(ctx);
	
	// Ask for date
	await ctx.reply(t('enter_date', lang) || 'Enter date (YYYY-MM-DD) or /today');
	let response = await conversation.wait();
	let dateInput = response.message?.text?.trim();
	
	if (!dateInput) {
		await ctx.reply(t('operation_cancelled', lang));
		return;
	}
	
	// Parse date input
	let date: string;
	if (dateInput === '/today') {
		const now = new Date();
		const year = now.getFullYear();
		const month = String(now.getMonth() + 1).padStart(2, '0');
		const day = String(now.getDate()).padStart(2, '0');
		date = `${year}-${month}-${day}`;
	} else if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
		date = dateInput;
	} else {
		await ctx.reply(t('invalid_date_format', lang) || 'Invalid date format. Please use YYYY-MM-DD or /today');
		return;
	}
	
	// Get attendance records for the date
	await ctx.reply(t('processing', lang));
	try {
		const { records } = await attendanceService.getDateAttendance(date, { limit: 100 });
		
		if (records.length === 0) {
			await ctx.reply(t('no_results', lang));
			return;
		}
		
		// Separate present and absent
		const present: Array<{ studentId: number; createdAt: Date }> = [];
		const absent: Array<{ studentId: number; createdAt: Date }> = [];
		
		for (const record of records) {
			if (record.status === 'present') {
				present.push({ studentId: record.studentId, createdAt: record.createdAt });
			} else {
				absent.push({ studentId: record.studentId, createdAt: record.createdAt });
			}
		}
		
		// Build message
		let message = `**${t('attendance_for', lang) || 'Attendance for'} ${date}**\n\n`;
		
		if (present.length > 0) {
			message += `**${t('present', lang) || 'Present'}** (${present.length})\n`;
			for (const att of present.slice(0, 20)) {
				const student = await studentService.getById(att.studentId);
				if (student) {
					const timeLocale = lang === 'ar' ? 'ar-SA' : 'en-US';
					const time = new Date(att.createdAt).toLocaleTimeString(timeLocale, {
						hour: '2-digit',
						minute: '2-digit',
					});
					message += `• ${student.firstName} ${student.lastName}${student.level ? ` (Level ${student.level})` : ''} - ${time}\n`;
				}
			}
			if (present.length > 20) {
				message += `... and ${present.length - 20} more\n`;
			}
			message += '\n';
		}
		
		if (absent.length > 0) {
			message += `**${t('absent', lang) || 'Absent'}** (${absent.length})\n`;
			for (const att of absent.slice(0, 20)) {
				const student = await studentService.getById(att.studentId);
				if (student) {
					const timeLocale = lang === 'ar' ? 'ar-SA' : 'en-US';
					const time = new Date(att.createdAt).toLocaleTimeString(timeLocale, {
						hour: '2-digit',
						minute: '2-digit',
					});
					message += `• ${student.firstName} ${student.lastName}${student.level ? ` (Level ${student.level})` : ''} - ${time}\n`;
				}
			}
			if (absent.length > 20) {
				message += `... and ${absent.length - 20} more\n`;
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
	await ctx.reply(t('enter_student_name_view_attendance', lang));
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
			`${student.firstName} ${student.lastName}${student.level ? ` (Level ${student.level})` : ''}`,
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
		
		// Group by date and status
		const attendanceByDate: Record<string, { present: Date[]; absent: Date[] }> = {};
		for (const record of records) {
			if (!attendanceByDate[record.date]) {
				attendanceByDate[record.date] = { present: [], absent: [] };
			}
			if (record.status === 'present') {
				attendanceByDate[record.date].present.push(record.createdAt);
			} else {
				attendanceByDate[record.date].absent.push(record.createdAt);
			}
		}
		
		// Build message
		let message = `**${t('attendance_for', lang) || 'Attendance for'} ${student.firstName} ${student.lastName}**\n\n`;
		
		// Sort dates descending
		const sortedDates = Object.keys(attendanceByDate).sort().reverse();
		
		for (const date of sortedDates.slice(0, 30)) {
			const { present, absent } = attendanceByDate[date];
			const total = present.length + absent.length;
			
			message += `**${date}**: `;
			if (present.length > 0) {
				message += `${t('present', lang) || 'Present'}: ${present.length}`;
			}
			if (present.length > 0 && absent.length > 0) {
				message += ', ';
			}
			if (absent.length > 0) {
				message += `${t('absent', lang) || 'Absent'}: ${absent.length}`;
			}
			message += '\n';
		}
		
		if (sortedDates.length > 30) {
			message += `... and ${sortedDates.length - 30} more dates\n`;
		}
		
		await ctx.reply(message, { parse_mode: 'Markdown' });
	} catch (err) {
		await ctx.reply(t('operation_failed', lang));
	}
}

