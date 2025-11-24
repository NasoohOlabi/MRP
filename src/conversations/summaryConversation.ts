import type { Conversation } from '@grammyjs/conversations';
import { InlineKeyboard } from 'grammy';
import { AttendanceRepo, MemorizationRepo, Student, StudentRepo } from '../model/drizzle/repos.js';
import type { BaseContext, MyContext } from '../types.js';
import { normalizeEventName } from '../utils/eventUtils.js';
import { cancelAndGreet } from '../utils/greeting.js';
import { getLang, t } from '../utils/i18n.js';
import { logger } from '../utils/logger.js';

export const createSummaryConversation = (attRepo: AttendanceRepo, studentRepo: StudentRepo, memRepo: MemorizationRepo) => async (conv: Conversation<BaseContext, MyContext>, ctx: MyContext) => {
  const userId = ctx.from?.id;
  const chatId = ctx.chat?.id;
  const conversationStartTime = Date.now();

  logger.info('Summary conversation started', { userId, chatId });

  const first = new InlineKeyboard();
  first.text(t('attendance_summary', getLang(ctx.session)), 'attendance').row();
  first.text(t('memorization_summary', getLang(ctx.session)), 'memorization').row();
  first.text(t('cancel', getLang(ctx.session)), 'cancel');
  await ctx.reply(t('summary_menu', getLang(ctx.session)), { reply_markup: first });

  let res = await conv.wait();
  const action = res.callbackQuery?.data;
  if (res.callbackQuery) await res.answerCallbackQuery();
  if (!action) {
    logger.warn('Summary conversation: No action selected', { userId, chatId });
    return;
  }
  if (action === 'cancel') {
    logger.info('Summary conversation cancelled', { userId, chatId });
    await cancelAndGreet(ctx, res);
    return;
  }

  logger.info('Summary action selected', { userId, chatId, action });
  const allStudents = await studentRepo.read();
  const groups = Array.from(new Set(allStudents.map(s => s.group))).sort();
  logger.debug('Students and groups loaded for summary', { userId, chatId, studentCount: allStudents.length, groupCount: groups.length });

  if (action === 'attendance') {
    logger.info('Attendance summary requested', { userId, chatId });
    await ctx.reply(t('type_event_name', getLang(ctx.session)));
    const eRes = await conv.wait();
    const rawEvent = eRes.message?.text?.trim() || '';
    const event = normalizeEventName(rawEvent);

    if (!event) {
      logger.warn('Summary conversation: Empty event name', { userId, chatId });
      await ctx.reply(t('operation_cancelled', getLang(ctx.session)));
      return;
    }

    logger.info('Event name received for attendance summary', { userId, chatId, rawEvent, event });

    const gKb = new InlineKeyboard();
    gKb.text(t('all', getLang(ctx.session)), 'all');
    for (const g of groups) gKb.text(g, `group:${g}`);
    gKb.row().text(t('cancel', getLang(ctx.session)), 'cancel');
    await ctx.reply(t('select_group', getLang(ctx.session)), { reply_markup: gKb });
    const gRes = await conv.wait();
    const gCmd = gRes.callbackQuery?.data;
    if (gRes.callbackQuery) await gRes.answerCallbackQuery();
    if (!gCmd || gCmd === 'cancel') {
      logger.info('Summary conversation cancelled at group selection', { userId, chatId });
      await cancelAndGreet(ctx, gRes);
      return;
    }

    const summaryStartTime = Date.now();
    const all = await attRepo.read();
    const filteredAttendance = all.filter(a => a.event === event);
    const byId = new Map<number, Student>(allStudents.map(s => [s.id, s]));
    let view = filteredAttendance.map(a => byId.get(a.student_id)).filter(Boolean) as Student[];

    if (gCmd.startsWith('group:')) {
      const g = gCmd.split(':')[1];
      logger.info('Filtering attendance summary by group', { userId, chatId, event, group: g });
      view = view.filter(s => s.group === g);
    }
    view.sort((a, b) => a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name));
    const lines = view.map(s => `${s.group} / ${s.first_name} ${s.last_name}`).join('\n');

    const summaryDuration = Date.now() - summaryStartTime;
    logger.info('Attendance summary generated', {
      userId,
      chatId,
      event,
      group: gCmd.startsWith('group:') ? gCmd.split(':')[1] : 'all',
      studentCount: view.length,
      durationMs: summaryDuration
    });

    await ctx.reply(`${t('attendance_summary_for', getLang(ctx.session), { event })} (${view.length})\n${lines || t('no_attendance_yet', getLang(ctx.session))}`);
  } else if (action === 'memorization') {
    const gKb = new InlineKeyboard();
    for (const g of groups) gKb.text(g, `group:${g}`);
    gKb.row().text(t('cancel', getLang(ctx.session)), 'cancel');
    await ctx.reply(t('select_group', getLang(ctx.session)), { reply_markup: gKb });
    let gRes = await conv.wait();
    const gCmd = gRes.callbackQuery?.data;
    if (gRes.callbackQuery) await gRes.answerCallbackQuery();
    if (!gCmd || gCmd === 'cancel') { await cancelAndGreet(ctx, gRes); return; }
    const group = gCmd.split(':')[1];
    const studentsInGroup = allStudents.filter(s => s.group === group);

    let page = 0;
    let pageSize = 10;
    let cmd: string | null = null;
    do {
      const totalPages = Math.max(1, Math.ceil(studentsInGroup.length / pageSize));
      const slice = studentsInGroup.slice(page * pageSize, (page + 1) * pageSize);
      const kb = new InlineKeyboard();
      for (const s of slice) kb.text(`${s.first_name} ${s.last_name}`, `student:${s.id}`);
      kb.row();
      if (page > 0) kb.text(t('previous', getLang(ctx.session)), 'previous');
      if (page < totalPages - 1) kb.text(t('next', getLang(ctx.session)), 'next');
      kb.text(t('cancel', getLang(ctx.session)), 'cancel');
      await ctx.reply(`${t('select_student', getLang(ctx.session))} (${group}) — page ${page + 1}/${totalPages}`, { reply_markup: kb });
      const r = await conv.wait();
      cmd = r.callbackQuery?.data || null;
      if (!cmd) continue;
      if (cmd === 'cancel') { await cancelAndGreet(ctx, r); return; }
      if (cmd === 'next' || cmd === 'previous') { await r.answerCallbackQuery(); }
      if (cmd === 'next') page = Math.min(page + 1, totalPages - 1);
      if (cmd === 'previous') page = Math.max(page - 1, 0);
      if (cmd.startsWith('student:')) {
        const studentId = parseInt(cmd.split(':')[1], 10);
        const student = allStudents.find(s => s.id === studentId);
        if (!student) {
          logger.warn('Memorization summary: Student not found', { userId, chatId, studentId });
          await r.answerCallbackQuery({ text: t('student_not_found', getLang(ctx.session)) });
          continue;
        }
        await r.answerCallbackQuery();

        logger.info('Memorization summary requested', { userId, chatId, studentId, studentName: `${student.first_name} ${student.last_name}` });
        const summaryStartTime = Date.now();
        const memorizationRecords = await memRepo.readByStudentId(studentId);
        const summaryDuration = Date.now() - summaryStartTime;

        if (memorizationRecords.length === 0) {
          logger.info('Memorization summary: No records found', { userId, chatId, studentId });
          await ctx.reply(t('no_memorization_records', getLang(ctx.session), { studentName: `${student.first_name} ${student.last_name}` }));
        } else {
          // Note: The schema only has 'page' field, but the code expects surah/verse_from/verse_to
          // This will need to be fixed, but for now we'll log what we have
          logger.info('Memorization summary generated', {
            userId,
            chatId,
            studentId,
            recordCount: memorizationRecords.length,
            durationMs: summaryDuration
          });
          // Using page field as fallback since schema doesn't have surah/verse fields
          const lines = memorizationRecords.map(rec => `Page ${rec.page} (${new Date(rec.created_at).toLocaleDateString()})`).join('\n');
          await ctx.reply(`${t('memorization_summary_for', getLang(ctx.session), { studentName: `${student.first_name} ${student.last_name}` })}\n${lines}`);
        }
        return; // Exit after displaying memorization for one student
      }
    } while (cmd);
  }

  const totalDuration = Date.now() - conversationStartTime;
  logger.info('Summary conversation completed', { userId, chatId, action, totalDurationMs: totalDuration });
};