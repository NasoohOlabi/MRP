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

// Browse attendance by date
export async function browseByEventConversation(conversation: Conversation<BaseContext, MyContext>, ctx: MyContext) {
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
		const { records } = await attendanceService.getDateAttendance(date);

		if (records.length === 0) {
			await ctx.reply(t('no_results', lang));
			return;
		}

		// Fetch all students upfront for efficiency
		const studentMap = new Map<number, Awaited<ReturnType<typeof studentService.getById>>>();
		const studentIds = new Set(records.map(r => r.studentId));
		await Promise.all(
			Array.from(studentIds).map(async (id) => {
				const student = await studentService.getById(id);
				if (student) {
					studentMap.set(id, student);
				}
			})
		);

		// Create items with student info
		const items = records.map((record) => ({
			record,
			student: studentMap.get(record.studentId),
		}));

		// Count present and absent
		const presentCount = records.filter(r => r.status === 'present').length;
		const absentCount = records.filter(r => r.status === 'absent').length;

		const header = `**${t('attendance_for', lang, { event: date })}**\n\n` +
			`**${t('present', lang) || 'Present'}**: ${presentCount} | **${t('absent', lang) || 'Absent'}**: ${absentCount}\n`;

		// Use pagination helper
		await paginate(conversation, ctx, {
			items,
			header,
			renderItem: (item) => {
				const { record, student } = item;
				if (!student) {
					return `• Unknown Student (ID: ${record.studentId})`;
				}
				const statusIcon = record.status === 'present' ? '✅' : '❌';
				const timeLocale = lang === 'ar' ? 'ar-SA' : 'en-US';
				const time = new Date(record.createdAt).toLocaleTimeString(timeLocale, {
					hour: '2-digit',
					minute: '2-digit',
				});
				return `${statusIcon} ${student.firstName} ${student.lastName}${student.level ? ` (Level ${student.level})` : ''} - ${time}`;
			},
			selectable: false,
			lang,
		});
	} catch (err) {
		await ctx.reply(t('operation_failed', lang));
	}
}
