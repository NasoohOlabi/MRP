import type { Conversation } from '@grammyjs/conversations';
import { InlineKeyboard } from 'grammy';
import { AttendanceRepo, MemorizationRepo, Student, StudentRepo } from '../../../model/drizzle/repos';
import type { BaseContext, MyContext } from '../../../types';
import { cancelAndGreet } from '../../../utils/greeting.js';
import { t, getLang } from '../../../utils/i18n.js';

const PAGE_SIZE = 10;

export const createViewConversation = (studentRepo: StudentRepo, memorizationRepo: MemorizationRepo, attendanceRepo: AttendanceRepo) => {
	return async (conv: Conversation<BaseContext, MyContext>, ctx: MyContext) => {
		const lang = getLang(ctx.session);
		let inPlace: { chatId: number; messageId: number } | null = null;
		
		const sendOrEdit = async (text: string, kb?: InlineKeyboard) => {
			if (inPlace && kb) {
				try {
					await ctx.api.editMessageText(inPlace.chatId, inPlace.messageId, text, { reply_markup: kb });
					return;
				} catch (e) {
					// If edit fails, send new message
				}
			}
			const sent = await ctx.reply(text, kb ? { reply_markup: kb } : undefined);
			inPlace = { chatId: sent.chat.id, messageId: sent.message_id };
		};

		// Step 1: Select student
		await ctx.reply(t('enter_student_name', lang));
		const nameRes = await conv.wait();
		const studentName = nameRes.message?.text?.trim();
		if (!studentName) {
			await cancelAndGreet(ctx, nameRes);
			return;
		}

		// Search for student
		const searchResults = await studentRepo.lookFor(studentName);
		if (searchResults.length === 0) {
			await ctx.reply(t('no_results', lang));
			return;
		}

		// If only one result, use it directly; otherwise show selection
		let selectedStudent: Student;
		if (searchResults.length === 1) {
			selectedStudent = searchResults[0].item;
		} else {
			// Show selection menu for multiple results
			const selectKb = new InlineKeyboard();
			const maxShow = Math.min(searchResults.length, 10);
			for (let i = 0; i < maxShow; i++) {
				const s = searchResults[i].item;
				selectKb.text(`${s.first_name} ${s.last_name}`, `select_${i}`);
				if ((i + 1) % 2 === 0) selectKb.row();
			}
			if (maxShow % 2 === 1) selectKb.row();
			selectKb.text(t('cancel', lang), 'cancel');
			
			await sendOrEdit(t('select_student', lang), selectKb);
			const selectionRes = await conv.wait();
			const callbackData = selectionRes.callbackQuery?.data;
			if (selectionRes.callbackQuery) await selectionRes.answerCallbackQuery();
			if (!callbackData || callbackData === 'cancel') {
				await cancelAndGreet(ctx, selectionRes);
				return;
			}
			if (callbackData.startsWith('select_')) {
				const index = parseInt(callbackData.split('_')[1]);
				selectedStudent = searchResults[index].item;
			} else {
				await cancelAndGreet(ctx, selectionRes);
				return;
			}
		}

		// Step 2: Choose what to view
		const infoKb = new InlineKeyboard();
		infoKb.text(t('view_memorizations', lang), 'memorizations');
		infoKb.text(t('view_attendance', lang), 'attendance');
		infoKb.row();
		infoKb.text(t('cancel', lang), 'cancel');
		
		await sendOrEdit(
			t('what_to_view', lang, { name: `${selectedStudent.first_name} ${selectedStudent.last_name}` }),
			infoKb
		);

		const infoRes = await conv.wait();
		const infoType = infoRes.callbackQuery?.data;
		if (infoRes.callbackQuery) await infoRes.answerCallbackQuery();
		if (!infoType || infoType === 'cancel') {
			await cancelAndGreet(ctx, infoRes);
			return;
		}

		// Step 3: Choose time filter
		const filterKb = new InlineKeyboard();
		filterKb.text(t('all_time', lang), 'all');
		filterKb.text(t('last_week', lang), 'week');
		filterKb.text(t('last_month', lang), 'month');
		filterKb.row();
		filterKb.text(t('custom_range', lang), 'custom');
		filterKb.row();
		filterKb.text(t('cancel', lang), 'cancel');

		await sendOrEdit(t('select_time_filter', lang), filterKb);
		const filterRes = await conv.wait();
		const filterType = filterRes.callbackQuery?.data;
		if (filterRes.callbackQuery) await filterRes.answerCallbackQuery();
		if (!filterType || filterType === 'cancel') {
			await cancelAndGreet(ctx, filterRes);
			return;
		}

		let fromDate: Date | undefined;
		let toDate: Date | undefined;

		if (filterType === 'week') {
			const now = new Date();
			toDate = now;
			fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
		} else if (filterType === 'month') {
			const now = new Date();
			toDate = now;
			fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
		} else if (filterType === 'custom') {
			await ctx.reply(t('enter_start_date', lang));
			const startRes = await conv.wait();
			const startText = startRes.message?.text?.trim();
			if (!startText) {
				await cancelAndGreet(ctx, startRes);
				return;
			}
			const parsedFromDate = parseDate(startText);
			if (!parsedFromDate) {
				await ctx.reply(t('invalid_date', lang));
				return;
			}
			fromDate = parsedFromDate;

			await ctx.reply(t('enter_end_date', lang));
			const endRes = await conv.wait();
			const endText = endRes.message?.text?.trim();
			if (!endText) {
				await cancelAndGreet(ctx, endRes);
				return;
			}
			const parsedToDate = parseDate(endText);
			if (!parsedToDate) {
				await ctx.reply(t('invalid_date', lang));
				return;
			}
			toDate = parsedToDate;
		}

		// Step 4: Display paginated results
		let page = 0;
		let cmd: string | null = null;

		do {
			const offset = page * PAGE_SIZE;
			let records: any[] = [];
			let total = 0;
			let title = '';

			if (infoType === 'memorizations') {
				const result = await memorizationRepo.readByStudentIdPaginated(selectedStudent.id, {
					fromDate,
					toDate,
					limit: PAGE_SIZE,
					offset,
				});
				records = result.records;
				total = result.total;
				title = t('memorizations', lang);
			} else {
				const result = await attendanceRepo.readByStudentId(selectedStudent.id, {
					fromDate,
					toDate,
					limit: PAGE_SIZE,
					offset,
				});
				records = result.records;
				total = result.total;
				title = t('attendance', lang);
			}

			const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
			const kb = new InlineKeyboard();
			
			if (page > 0) kb.text(t('previous', lang), 'previous');
			if (page < totalPages - 1) kb.text(t('next', lang), 'next');
			kb.row();
			kb.text(t('change_filter', lang), 'change_filter');
			kb.text(t('cancel', lang), 'cancel');

			const lines = records.map((r, idx) => {
				if (infoType === 'memorizations') {
					const date = new Date(r.created_at).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US');
					return `${idx + 1 + offset}. ${t('page', lang)} ${r.page} - ${date}`;
				} else {
					const date = new Date(r.created_at).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US');
					return `${idx + 1 + offset}. ${r.event} - ${date}`;
				}
			}).join('\n');

			const studentName = `${selectedStudent.first_name} ${selectedStudent.last_name}`;
			const message = `${title} - ${studentName}\n${t('page_info', lang, { current: String(page + 1), total: String(totalPages) })}\n\n${lines || t('no_results', lang)}`;

			await sendOrEdit(message, kb);

			const navRes = await conv.wait();
			cmd = navRes.callbackQuery?.data || null;
			if (navRes.callbackQuery) await navRes.answerCallbackQuery();
			
			if (!cmd) continue;
			if (cmd === 'cancel') {
				await cancelAndGreet(ctx, navRes);
				return;
			}
			if (cmd === 'next') {
				page = Math.min(page + 1, totalPages - 1);
			} else if (cmd === 'previous') {
				page = Math.max(page - 1, 0);
			} else if (cmd === 'change_filter') {
				// Go back to filter selection
				const filterKb2 = new InlineKeyboard();
				filterKb2.text(t('all_time', lang), 'all');
				filterKb2.text(t('last_week', lang), 'week');
				filterKb2.text(t('last_month', lang), 'month');
				filterKb2.row();
				filterKb2.text(t('custom_range', lang), 'custom');
				filterKb2.row();
				filterKb2.text(t('cancel', lang), 'cancel');

				await sendOrEdit(t('select_time_filter', lang), filterKb2);
				const filterRes2 = await conv.wait();
				const filterType2 = filterRes2.callbackQuery?.data;
				if (filterRes2.callbackQuery) await filterRes2.answerCallbackQuery();
				if (!filterType2 || filterType2 === 'cancel') {
					await cancelAndGreet(ctx, filterRes2);
					return;
				}

				if (filterType2 === 'week') {
					const now = new Date();
					toDate = now;
					fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
				} else if (filterType2 === 'month') {
					const now = new Date();
					toDate = now;
					fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
				} else if (filterType2 === 'custom') {
					await ctx.reply(t('enter_start_date', lang));
					const startRes2 = await conv.wait();
					const startText2 = startRes2.message?.text?.trim();
					if (!startText2) {
						await cancelAndGreet(ctx, startRes2);
						return;
					}
					const parsedFromDate2 = parseDate(startText2);
					if (!parsedFromDate2) {
						await ctx.reply(t('invalid_date', lang));
						return;
					}
					fromDate = parsedFromDate2;

					await ctx.reply(t('enter_end_date', lang));
					const endRes2 = await conv.wait();
					const endText2 = endRes2.message?.text?.trim();
					if (!endText2) {
						await cancelAndGreet(ctx, endRes2);
						return;
					}
					const parsedToDate2 = parseDate(endText2);
					if (!parsedToDate2) {
						await ctx.reply(t('invalid_date', lang));
						return;
					}
					toDate = parsedToDate2;
				} else {
					fromDate = undefined;
					toDate = undefined;
				}
				page = 0;
			}
		} while (cmd);
	};
};

function parseDate(dateStr: string): Date | null {
	// Try common date formats: YYYY-MM-DD, MM/DD/YYYY, DD/MM/YYYY
	const formats = [
		/^(\d{4})-(\d{2})-(\d{2})$/, // YYYY-MM-DD
		/^(\d{2})\/(\d{2})\/(\d{4})$/, // MM/DD/YYYY or DD/MM/YYYY
		/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, // M/D/YYYY
	];

	for (const format of formats) {
		const match = dateStr.match(format);
		if (match) {
			if (format === formats[0]) {
				// YYYY-MM-DD
				return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
			} else {
				// Try MM/DD/YYYY first
				const month = parseInt(match[1]);
				const day = parseInt(match[2]);
				const year = parseInt(match[3]);
				if (month > 12) {
					// Assume DD/MM/YYYY
					return new Date(year, day - 1, month);
				}
				return new Date(year, month - 1, day);
			}
		}
	}

	return null;
}

