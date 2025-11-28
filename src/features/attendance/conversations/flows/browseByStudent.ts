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

// Browse attendance by student
export async function browseByStudentConversation(conversation: Conversation<BaseContext, MyContext>, ctx: MyContext) {
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

	// Get attendance records for the student
	await ctx.reply(t('processing', lang));
	try {
		const { records } = await attendanceService.getStudentAttendance(student.id, { limit: 100 });

		if (records.length === 0) {
			await ctx.reply(t('no_results', lang));
			return;
		}

		// Group by date and status
		const attendanceByDate: Record<string, { present: Date[]; absent: Date[] }> = {};
		let overallPresent = 0;
		let overallAbsent = 0;
		for (const record of records) {
			if (!attendanceByDate[record.date]) {
				attendanceByDate[record.date] = { present: [], absent: [] };
			}
			const entry = attendanceByDate[record.date];
			if (!entry) {
				continue;
			}
			if (record.status === 'present') {
				entry.present.push(record.createdAt);
				overallPresent++;
			} else {
				entry.absent.push(record.createdAt);
				overallAbsent++;
			}
		}

		// Build message
		let message = `**${t('attendance_for', lang) || 'Attendance for'} ${student.firstName} ${student.lastName}**\n\n`;

		// Sort dates descending
		const sortedDates = Object.keys(attendanceByDate).sort().reverse();

		for (const date of sortedDates.slice(0, 30)) {
			const entry = attendanceByDate[date];
			if (!entry) {
				continue;
			}
			const { present, absent } = entry;
			const parts: string[] = [];
			if (present.length > 0) {
				parts.push(`✅ ${present.length}`);
			}
			if (absent.length > 0) {
				parts.push(`❌ ${absent.length}`);
			}

			if (parts.length === 0) {
				continue;
			}

			message += `**${date}**: ${parts.join(' ')}\n`;
		}

		if (sortedDates.length > 30) {
			message += `... and ${sortedDates.length - 30} more dates\n`;
		}

		const overallTotal = overallPresent + overallAbsent;
		const percentage = overallTotal > 0 ? Math.round((overallPresent / overallTotal) * 100) : 0;
		message += `\n✅ ${overallPresent}/${overallTotal} ~ ${percentage}%`;

		await ctx.reply(message, { parse_mode: 'Markdown' });
	} catch (err) {
		await ctx.reply(t('operation_failed', lang));
	}
}
