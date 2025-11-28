import type { Conversation } from '@grammyjs/conversations';
import { AttendanceService } from 'src/features/attendance/model';
import { StudentService } from 'src/features/students/model';
import { t } from 'src/utils/i18n.js';
import { paginate } from 'src/utils/pagination.js';
import type { BaseContext, MyContext } from '../../../../types';

const attendanceService = new AttendanceService();
const studentService = new StudentService();

// Helper to get user's language
function getLang(ctx: MyContext): string {
	return ctx.session?.language || 'en';
}

// Mark attendance conversation
export async function markAttendanceConversation(conversation: Conversation<BaseContext, MyContext>, ctx: MyContext) {
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

	const students = results.map(r => r.item);

	// Use pagination helper for student selection
	const paginationResult = await paginate(conversation, ctx, {
		items: students,
		header: t('select_student', lang) + '\n',
		renderItem: (student) => {
			return `${student.firstName} ${student.lastName}${student.level ? ` (Level ${student.level})` : ''}`;
		},
		selectable: true,
		getItemId: (student) => `student_${student.id}`,
		lang,
	});

	if (paginationResult.cancelled || !paginationResult.selectedItem) {
		await ctx.reply(t('operation_cancelled', lang));
		return;
	}

	const student = paginationResult.selectedItem;

	// Check if already has attendance record for this date
	const hasRecord = await attendanceService.hasRecordOnDate(student.id, date);
	if (hasRecord) {
		await ctx.reply(t('already_marked', lang) || `Attendance already marked for ${date}`);
		return;
	}

	// Mark present
	await ctx.reply(t('processing', lang));
	try {
		await attendanceService.markPresent(student.id, date);
		await ctx.reply(
			`${t('marked_present', lang) || 'Marked present'}: ${student.firstName} ${student.lastName} - ${date}`
		);
	} catch (err) {
		await ctx.reply(t('operation_failed', lang));
	}
}
