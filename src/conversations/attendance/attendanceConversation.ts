import type { Conversation } from '@grammyjs/conversations';
import { InlineKeyboard } from 'grammy';
import { AttendanceRepo, StudentRepo, Student } from '../../model/drizzle/repos';
import type { BaseContext, MyContext } from '../../types';
import { cancelAndGreet } from '../../utils/greeting.js';

export const createAttendanceConversation = (attRepo: AttendanceRepo, studentRepo: StudentRepo) => async (conv: Conversation<BaseContext, MyContext>, ctx: MyContext) => {
  const first = new InlineKeyboard();
  first.text('Mark', 'mark').text('View Today', 'view').text('Undo Today', 'undo').row().text('Cancel', 'cancel');
  await ctx.reply('Attendance', { reply_markup: first });

  let res = await conv.wait();
  const action = res.callbackQuery?.data;
  if (res.callbackQuery) await res.answerCallbackQuery();
  if (!action) return;
  if (action === 'cancel') { await cancelAndGreet(ctx, res); return; }

  const allStudents = await studentRepo.read();
  const groups = Array.from(new Set(allStudents.map(s => s.group))).sort();

  if (action === 'mark') {
    await ctx.reply('Type event name');
    const eRes = await conv.wait();
    const event = eRes.message?.text?.trim() || '';

    const gKb = new InlineKeyboard();
    for (const g of groups) gKb.text(g, `group:${g}`);
    gKb.row().text('Cancel', 'cancel');
    await ctx.reply('Select group', { reply_markup: gKb });
    let gRes = await conv.wait();
    const gCmd = gRes.callbackQuery?.data;
    if (gRes.callbackQuery) await gRes.answerCallbackQuery();
    if (!gCmd || gCmd === 'cancel') { await cancelAndGreet(ctx, gRes); return; }
    const group = gCmd.split(':')[1];
    const pool = allStudents.filter(s => s.group === group);

    let page = 0;
    let pageSize = 10;
    let cmd: string | null = null;
    do {
      const totalPages = Math.max(1, Math.ceil(pool.length / pageSize));
      const slice = pool.slice(page * pageSize, (page + 1) * pageSize);
      const kb = new InlineKeyboard();
      for (const s of slice) kb.text(`${s.first_name} ${s.last_name}`, `mark:${s.id}`);
      kb.row();
      if (page > 0) kb.text('Previous', 'previous');
      if (page < totalPages - 1) kb.text('Next', 'next');
      kb.text('Cancel', 'cancel');
      await ctx.reply(`Mark present (${event})\n${group} — page ${page + 1}/${totalPages}`, { reply_markup: kb });
      const r = await conv.wait();
      cmd = r.callbackQuery?.data || null;
      if (!cmd) continue;
      if (cmd === 'cancel') { await cancelAndGreet(ctx, r); return; }
      if (cmd === 'next' || cmd === 'previous') { await r.answerCallbackQuery(); }
      if (cmd === 'next') page = Math.min(page + 1, totalPages - 1);
      if (cmd === 'previous') page = Math.max(page - 1, 0);
      if (cmd.startsWith('mark:')) {
        const id = parseInt(cmd.split(':')[1], 10);
        const created = await attRepo.create({ student_id: id, event });
        if (created) await r.answerCallbackQuery({ text: 'Marked present' }); else await r.answerCallbackQuery({ text: 'Already marked today' });
      }
    } while (cmd);
    return;
  }

  if (action === 'view') {
    await ctx.reply('Type event name');
    const eRes = await conv.wait();
    const event = eRes.message?.text?.trim() || '';

    const gKb = new InlineKeyboard();
    gKb.text('All', 'all');
    for (const g of groups) gKb.text(g, `group:${g}`);
    gKb.row().text('Cancel', 'cancel');
    await ctx.reply('Select group', { reply_markup: gKb });
    const gRes = await conv.wait();
    const gCmd = gRes.callbackQuery?.data;
    if (gRes.callbackQuery) await gRes.answerCallbackQuery();
    if (!gCmd || gCmd === 'cancel') { await cancelAndGreet(ctx, gRes); return; }
    const today = new Date();
    const isSameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    const all = await attRepo.read();
    const todays = all.filter(a => a.event === event && isSameDay(new Date(a.created_at), today));
    const byId = new Map<number, Student>(allStudents.map(s => [s.id, s]));
    let view = todays.map(a => byId.get(a.student_id)).filter(Boolean) as Student[];
    if (gCmd.startsWith('group:')) {
      const g = gCmd.split(':')[1];
      view = view.filter(s => s.group === g);
    }
    view.sort((a, b) => a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name));
    const lines = view.map(s => `${s.group} / ${s.first_name} ${s.last_name}`).join('\n');
    await ctx.reply(`Today (${event}) — ${view.length}\n${lines || 'No attendance yet'}`);
    return;
  }

  if (action === 'undo') {
    await ctx.reply('Type event name');
    const eRes = await conv.wait();
    const event = eRes.message?.text?.trim() || '';

    const gKb = new InlineKeyboard();
    for (const g of groups) gKb.text(g, `group:${g}`);
    gKb.row().text('Cancel', 'cancel');
    await ctx.reply('Select group', { reply_markup: gKb });
    const gRes = await conv.wait();
    const gCmd = gRes.callbackQuery?.data;
    if (!gCmd || gCmd === 'cancel') { await cancelAndGreet(ctx, gRes); return; }
    const group = gCmd.split(':')[1];
    const today = new Date();
    const isSameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    const all = await attRepo.read();
    const todays = all.filter(a => a.event === event && isSameDay(new Date(a.created_at), today));
    const byId = new Map<number, Student>(allStudents.map(s => [s.id, s]));
    const candidates = todays.map(a => byId.get(a.student_id)).filter(Boolean) as Student[];
    const pool = candidates.filter(s => s.group === group);

    let page = 0;
    let pageSize = 10;
    let cmd: string | null = null;
    do {
      const totalPages = Math.max(1, Math.ceil(pool.length / pageSize));
      const slice = pool.slice(page * pageSize, (page + 1) * pageSize);
      const kb = new InlineKeyboard();
      for (const s of slice) kb.text(`${s.first_name} ${s.last_name}`, `undo:${s.id}`);
      kb.row();
      if (page > 0) kb.text('Previous', 'previous');
      if (page < totalPages - 1) kb.text('Next', 'next');
      kb.text('Cancel', 'cancel');
      await ctx.reply(`Undo present (${event})\n${group} — page ${page + 1}/${totalPages}`, { reply_markup: kb });
      const r = await conv.wait();
      cmd = r.callbackQuery?.data || null;
      if (!cmd) continue;
      if (cmd === 'cancel') { await cancelAndGreet(ctx, r); return; }
      if (cmd === 'next' || cmd === 'previous') { await r.answerCallbackQuery(); }
      if (cmd === 'next') page = Math.min(page + 1, totalPages - 1);
      if (cmd === 'previous') page = Math.max(page - 1, 0);
      if (cmd.startsWith('undo:')) {
        const id = parseInt(cmd.split(':')[1], 10);
        const ok = await attRepo.deleteToday(id, event);
        if (ok.success) await r.answerCallbackQuery({ text: 'Undone' }); else await r.answerCallbackQuery({ text: 'Not found' });
      }
    } while (cmd);
    return;
  }
};