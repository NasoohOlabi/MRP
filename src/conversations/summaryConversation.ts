import type { Conversation } from '@grammyjs/conversations';
import { InlineKeyboard } from 'grammy';
import { AttendanceRepo, MemorizationRepo, Student, StudentRepo } from '../model/drizzle/repos.js';
import type { BaseContext, MyContext } from '../types.js';
import { cancelAndGreet } from '../utils/greeting.js';
import { getLang, t } from '../utils/i18n.js';

export const createSummaryConversation = (attRepo: AttendanceRepo, studentRepo: StudentRepo, memRepo: MemorizationRepo) => async (conv: Conversation<BaseContext, MyContext>, ctx: MyContext) => {
  const first = new InlineKeyboard();
  first.text(t('attendance_summary', getLang(ctx.session)), 'attendance').row();
  first.text(t('memorization_summary', getLang(ctx.session)), 'memorization').row();
  first.text(t('cancel', getLang(ctx.session)), 'cancel');
  await ctx.reply(t('summary_menu', getLang(ctx.session)), { reply_markup: first });

  let res = await conv.wait();
  const action = res.callbackQuery?.data;
  if (res.callbackQuery) await res.answerCallbackQuery();
  if (!action) return;
  if (action === 'cancel') { await cancelAndGreet(ctx, res); return; }

  const allStudents = await studentRepo.read();
  const groups = Array.from(new Set(allStudents.map(s => s.group))).sort();

  if (action === 'attendance') {
    await ctx.reply(t('type_event_name', getLang(ctx.session)));
    const eRes = await conv.wait();
    const event = eRes.message?.text?.trim() || '';

    const gKb = new InlineKeyboard();
    gKb.text(t('all', getLang(ctx.session)), 'all');
    for (const g of groups) gKb.text(g, `group:${g}`);
    gKb.row().text(t('cancel', getLang(ctx.session)), 'cancel');
    await ctx.reply(t('select_group', getLang(ctx.session)), { reply_markup: gKb });
    const gRes = await conv.wait();
    const gCmd = gRes.callbackQuery?.data;
    if (gRes.callbackQuery) await gRes.answerCallbackQuery();
    if (!gCmd || gCmd === 'cancel') { await cancelAndGreet(ctx, gRes); return; }

    const all = await attRepo.read();
    const filteredAttendance = all.filter(a => a.event === event);
    const byId = new Map<number, Student>(allStudents.map(s => [s.id, s]));
    let view = filteredAttendance.map(a => byId.get(a.student_id)).filter(Boolean) as Student[];

    if (gCmd.startsWith('group:')) {
      const g = gCmd.split(':')[1];
      view = view.filter(s => s.group === g);
    }
    view.sort((a, b) => a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name));
    const lines = view.map(s => `${s.group} / ${s.first_name} ${s.last_name}`).join('\n');
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
          await r.answerCallbackQuery({ text: t('student_not_found', getLang(ctx.session)) });
          continue;
        }
        await r.answerCallbackQuery();

        const memorizationRecords = await memRepo.readByStudentId(studentId);
        if (memorizationRecords.length === 0) {
          await ctx.reply(t('no_memorization_records', getLang(ctx.session), { studentName: `${student.first_name} ${student.last_name}` }));
        } else {
          const lines = memorizationRecords.map(rec => `${rec.surah} - ${rec.verse_from}-${rec.verse_to} (${new Date(rec.created_at).toLocaleDateString()})`).join('\n');
          await ctx.reply(`${t('memorization_summary_for', getLang(ctx.session), { studentName: `${student.first_name} ${student.last_name}` })}\n${lines}`);
        }
        return; // Exit after displaying memorization for one student
      }
    } while (cmd);
  }
};