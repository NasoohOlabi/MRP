import type { Conversation } from '@grammyjs/conversations';
import { InlineKeyboard } from 'grammy';
import { AttendanceService } from 'src/features/attendance/model.js';
import type { Student } from 'src/features/students/model';
import { StudentService } from 'src/features/students/model.js';
import type { Teacher } from 'src/features/teachers/model';
import { TeacherService } from 'src/features/teachers/model.js';
import { t } from 'src/utils/i18n.js';
import { logger } from 'src/utils/logger.js';
import type { BaseContext, MyContext } from '../../../../types';

const attendanceService = new AttendanceService();
const studentService = new StudentService();
const teacherService = new TeacherService();

type MarkedRecord = {
	student: Student;
	status: 'present' | 'absent';
};

const ACTION_CANCEL = 'cancel_group';
const ACTION_UNDO = 'undo_group';
const ACTION_SAVE = 'save_group';
const ACTION_NOOP_STUDENT = 'noop_student';

// Helper to get user's language
function getLang(ctx: MyContext): string {
	return ctx.session?.language || 'en';
}

function parseDateInput(input: string): string | null {
	if (input === '/today') {
		return attendanceService.formatDate(new Date());
	}
	if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
		return input;
	}
	return null;
}

function safeDeleteMessage(ctx: MyContext, info?: { chatId: number; messageId: number }) {
	if (!info) return Promise.resolve();
	return ctx.api.deleteMessage(info.chatId, info.messageId).catch(() => undefined);
}

export async function eventAttendanceConversation(
	conversation: Conversation<BaseContext, MyContext>,
	ctx: MyContext
) {
	const lang = getLang(ctx);
	logger.info(`[eventAttendanceConversation] Started for user ${ctx.from?.id}`);

	await ctx.reply(t('enter_event_name_or_date', lang) || 'Enter event name (or /today for today\'s date):');
	let response = await conversation.wait();
	const input = response.message?.text?.trim();
	if (!input) {
		await ctx.reply(t('operation_cancelled', lang));
		logger.info(`[eventAttendanceConversation] Operation cancelled by user ${ctx.from?.id}: No input provided.`);
		return;
	}

	let eventName: string;
	let date: string;

	if (input === '/today') {
		eventName = attendanceService.formatDate(new Date());
		date = eventName;
		logger.info(`[eventAttendanceConversation] Input was /today. EventName: ${eventName}, Date: ${date}`);
	} else if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
		eventName = t('default_event_name', lang) || 'Attendance';
		date = input;
		logger.info(`[eventAttendanceConversation] Input was a date. EventName: ${eventName}, Date: ${date}`);
	} else {
		eventName = input;
		await ctx.reply(t('enter_date', lang) || 'Enter date (YYYY-MM-DD) or /today');
		response = await conversation.wait();
		const dateInput = response.message?.text?.trim();
		if (!dateInput) {
			await ctx.reply(t('operation_cancelled', lang));
			logger.info(`[eventAttendanceConversation] Operation cancelled by user ${ctx.from?.id}: No date input provided.`);
			return;
		}
		const parsedDate = parseDateInput(dateInput);
		if (!parsedDate) {
			await ctx.reply(t('invalid_date_format', lang) || 'Invalid date format. Please use YYYY-MM-DD or /today');
			logger.warn(`[eventAttendanceConversation] Invalid date format provided by user ${ctx.from?.id}: ${dateInput}`);
			return;
		}
		date = parsedDate;
		logger.info(`[eventAttendanceConversation] Input was event name then date. EventName: ${eventName}, Date: ${date}`);
	}

	try {
		const [teachers, students] = await Promise.all([
			teacherService.getAll(),
			studentService.getAll(),
		]);
		logger.info(`[eventAttendanceConversation] Fetched ${teachers.length} teachers and ${students.length} students.`);

		// Group students by teacher
		const studentsByTeacher = new Map<number, Student[]>();
		for (const student of students) {
			const group = studentsByTeacher.get(student.teacherId);
			if (group) {
				group.push(student);
			} else {
				studentsByTeacher.set(student.teacherId, [student]);
			}
		}

		const groupedTeachers = teachers
			.filter((teacher) => (studentsByTeacher.get(teacher.id) ?? []).length > 0)
			.sort((a, b) => a.name.localeCompare(b.name));

		if (groupedTeachers.length === 0) {
			await ctx.reply(t('no_results', lang));
			logger.info(`[eventAttendanceConversation] No teachers with students found for event: ${eventName}, date: ${date}`);
			return;
		}

		const completedGroupIds = new Set<number>();

		while (completedGroupIds.size < groupedTeachers.length) {
			const remaining = groupedTeachers.filter((teacher) => !completedGroupIds.has(teacher.id));
			if (remaining.length === 0) {
				break;
			}
			logger.info(`[eventAttendanceConversation] Prompting group selection. Remaining groups: ${remaining.length}`);
			const selectedTeacher = await promptGroupSelection(conversation, ctx, remaining, lang, eventName, date, studentsByTeacher);
			if (!selectedTeacher) {
				await ctx.reply(t('operation_cancelled', lang));
				logger.info(`[eventAttendanceConversation] Group selection cancelled by user ${ctx.from?.id}.`);
				return;
			}
			logger.info(`[eventAttendanceConversation] Selected teacher: ${selectedTeacher.name} (${selectedTeacher.id})`);

			const groupStudents = studentsByTeacher.get(selectedTeacher.id) ?? [];
			const sessionResult = await runGroupAttendanceSession(
				conversation,
				ctx,
				selectedTeacher,
				groupStudents,
				date,
				eventName,
				lang
			);

			if (sessionResult === 'cancelled') {
				logger.info(`[eventAttendanceConversation] Attendance session for ${selectedTeacher.name} cancelled.`);
				continue;
			}

			completedGroupIds.add(selectedTeacher.id);
			logger.info(`[eventAttendanceConversation] Attendance session for ${selectedTeacher.name} completed. Total completed: ${completedGroupIds.size}`);

			await ctx.reply(
				`${t('attendance_saved', lang)} - ${selectedTeacher.name}\n` +
				`${eventName} • ${date}`
			);
		}

		if (completedGroupIds.size === groupedTeachers.length) {
			await ctx.reply(`${t('attendance_saved', lang)} • ${eventName} (${date})`);
			logger.info(`[eventAttendanceConversation] All groups processed for event: ${eventName}, date: ${date}`);
		}
	} catch (err) {
		await ctx.reply(t('operation_failed', lang));
		logger.error(`[eventAttendanceConversation] Error during event attendance conversation for user ${ctx.from?.id}: ${err instanceof Error ? err.message : String(err)}`, { error: err });
	}
}

async function promptGroupSelection(
	conversation: Conversation<BaseContext, MyContext>,
	ctx: MyContext,
	teachers: Teacher[],
	lang: string,
	eventName: string,
	date: string,
	studentsByTeacher: Map<number, Student[]>
): Promise<Teacher | null> {
	const headerLines = [
		t('select_group', lang) || 'Select a group:',
		`${eventName} • ${date}`,
		`Groups remaining: ${teachers.length}`,
		'',
		'Groups:',
		...teachers.map((teacher, idx) => {
			const studentCount = (studentsByTeacher.get(teacher.id) ?? []).length;
			return `${idx + 1}. ${teacher.name} (${studentCount} students)`;
		}),
	];
	const keyboard = new InlineKeyboard();

	for (let i = 0; i < teachers.length; i += 2) {
		const current = teachers[i];
		if (!current) {
			continue;
		}
		keyboard.text(`${current.name}`, `group_${current.id}`);
		const next = teachers[i + 1];
		if (next) {
			keyboard.text(`${next.name}`, `group_${next.id}`);
		}
		keyboard.row();
	}

	keyboard.row().text(t('cancel', lang), 'cancel_groups');

	const message = await ctx.reply(headerLines.join('\n'), {
		reply_markup: keyboard,
	});

	while (true) {
		const btnCtx = await conversation.wait();
		const callbackData = btnCtx.callbackQuery?.data;

		if (!callbackData) {
			if (btnCtx.callbackQuery) {
				await btnCtx.answerCallbackQuery();
			}
			continue;
		}

		if (callbackData === 'cancel_groups') {
			await btnCtx.answerCallbackQuery();
			await safeDeleteMessage(ctx, { chatId: message.chat.id, messageId: message.message_id });
			return null;
		}

		if (callbackData.startsWith('group_')) {
			const teacherId = parseInt(callbackData.replace('group_', ''), 10);
			const teacher = teachers.find((item) => item.id === teacherId);
			await btnCtx.answerCallbackQuery();
			await safeDeleteMessage(ctx, { chatId: message.chat.id, messageId: message.message_id });
			return teacher ?? null;
		}

		await btnCtx.answerCallbackQuery();
	}
}

async function runGroupAttendanceSession(
	conversation: Conversation<BaseContext, MyContext>,
	ctx: MyContext,
	teacher: Teacher,
	students: Student[],
	date: string,
	eventName: string,
	lang: string
): Promise<'saved' | 'cancelled'> {
	const pendingStudents = [...students];
	const actionStack: MarkedRecord[] = [];
	const recorded = new Map<number, MarkedRecord>();
	let messageInfo: { chatId: number; messageId: number } | null = null;

	const getSummaryLabel = () => {
		return (t('attendance_summary', lang) || 'Attendance').replace(/\*/g, '');
	};

	const buildText = () => {
		const presentCount = Array.from(recorded.values()).filter((r) => r.status === 'present').length;
		const absentCount = Array.from(recorded.values()).filter((r) => r.status === 'absent').length;
		const pendingCount = pendingStudents.length;

		const lines = [
			`${getSummaryLabel()} • ${teacher.name}`,
			`Event: ${eventName}`,
			`Date: ${date}`,
			`Marked: ✅ ${presentCount} | ❌ ${absentCount} | Pending: ${pendingCount}`,
			'Students:',
			...pendingStudents.map((student, index) =>
				`${index + 1}. ${student.firstName} ${student.lastName}   ❌   ✅`
			),
		];

		if (pendingStudents.length === 0) {
			lines.push('All students have been marked. Tap Save or Undo if needed.');
		}

		lines.push('Unmarked students default to absent when saved.');

		return lines.join('\n');
	};

	const buildKeyboard = () => {
		const keyboard = new InlineKeyboard();
		for (const student of pendingStudents) {
			const name = `${student.firstName} ${student.lastName}`;
			keyboard
				.text(name, `${ACTION_NOOP_STUDENT}_${student.id}`)
				.text('❌', `absent_${student.id}`)
				.text('✅', `present_${student.id}`)
				.row();
		}
		keyboard
			.row()
			.text(t('cancel', lang), ACTION_CANCEL)
			.text(t('undo', lang), ACTION_UNDO)
			.text(t('save', lang), ACTION_SAVE);
		return keyboard;
	};

	const updateMessage = async () => {
		const text = buildText();
		const keyboard = buildKeyboard();

		if (!messageInfo) {
			const firstMessage = await ctx.reply(text, { reply_markup: keyboard });
			messageInfo = { chatId: firstMessage.chat.id, messageId: firstMessage.message_id };
			return;
		}

		try {
			await ctx.api.editMessageText(
				messageInfo.chatId,
				messageInfo.messageId,
				text,
				{ reply_markup: keyboard }
			);
		} catch (err) {
			const fallback = await ctx.reply(text, { reply_markup: keyboard });
			messageInfo = { chatId: fallback.chat.id, messageId: fallback.message_id };
		}
	};

	await updateMessage();

	while (true) {
		const btnCtx = await conversation.wait();
		const data = btnCtx.callbackQuery?.data;

		if (!data) {
			if (btnCtx.callbackQuery) {
				await btnCtx.answerCallbackQuery();
			}
			continue;
		}

		if (data === ACTION_UNDO && actionStack.length === 0) {
			await btnCtx.answerCallbackQuery(t('nothing_to_undo', lang));
			continue;
		}

		await btnCtx.answerCallbackQuery();

		if (data === ACTION_CANCEL) {
			await safeDeleteMessage(ctx, messageInfo ?? undefined);
			return 'cancelled';
		}

		if (data === ACTION_UNDO) {
			const lastAction = actionStack.pop();
			if (lastAction) {
				recorded.delete(lastAction.student.id);
				pendingStudents.unshift(lastAction.student);
				await updateMessage();
			}
			continue;
		}

		if (data === ACTION_SAVE) {
			const presentEntries = Array.from(recorded.values()).filter((r) => r.status === 'present');
			const absentEntries = Array.from(recorded.values()).filter((r) => r.status === 'absent');
			const unmarked = [...pendingStudents];

			try {
				await Promise.all([
					...presentEntries.map((entry) =>
						attendanceService.markPresent(entry.student.id, date, teacher.id)
					),
					...absentEntries.map((entry) =>
						attendanceService.markAbsent(entry.student.id, date, teacher.id)
					),
					...unmarked.map((student) =>
						attendanceService.markAbsent(student.id, date, teacher.id)
					),
				]);
			} catch (err) {
				await ctx.reply(t('operation_failed', lang));
				await safeDeleteMessage(ctx, messageInfo ?? undefined);
				return 'cancelled';
			}

			const totalPresent = presentEntries.length;
			const totalAbsent = absentEntries.length + unmarked.length;
			await ctx.reply(
				`${t('attendance_saved', lang)} • ${teacher.name}\n` +
				`✅ ${totalPresent} | ❌ ${totalAbsent}`
			);
			await safeDeleteMessage(ctx, messageInfo ?? undefined);
			return 'saved';
		}

		if (data.startsWith('present_') || data.startsWith('absent_')) {
			const studentId = parseInt(data.split('_')[1] ?? '', 10);
			const index = pendingStudents.findIndex((student) => student.id === studentId);
			if (index === -1) {
				continue;
			}
			const [student] = pendingStudents.splice(index, 1);
			if (!student) {
				continue;
			}
			const status = data.startsWith('present_') ? 'present' : 'absent';
			const record: MarkedRecord = { student, status };
			actionStack.push(record);
			recorded.set(student.id, record);
			await updateMessage();
			continue;
		}

		if (data.startsWith(`${ACTION_NOOP_STUDENT}_`)) {
			await btnCtx.answerCallbackQuery();
			continue;
		}
	}
}

