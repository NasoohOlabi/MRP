import type { Conversation } from '@grammyjs/conversations';
import { InlineKeyboard } from 'grammy';
import { AttendanceRepo, StudentRepo, TeacherRepo } from '../../model/drizzle/repos';
import type { BaseContext, MyContext } from '../../types';
import { cancelAndGreet } from '../../utils/greeting.js';

export const createTeacherQuickAttendance = (
  attRepo: AttendanceRepo,
  studentRepo: StudentRepo,
  teacherRepo: TeacherRepo,
) => async (conv: Conversation<BaseContext, MyContext>, ctx: MyContext) => {
  const startKb = new InlineKeyboard();
  startKb.text('Class', 'ev:Class').text('Custom', 'ev:custom').row().text('Cancel', 'cancel');
  await ctx.reply('Choose event', { reply_markup: startKb });
  let res = await conv.wait();
  const ev = res.callbackQuery?.data;
  if (!ev || ev === 'cancel') { await cancelAndGreet(ctx, res); return; }
  let event = ev.startsWith('ev:') && ev !== 'ev:custom' ? ev.split(':')[1] : '';
  if (ev === 'ev:custom') {
    await ctx.reply('Type event name');
    const eRes = await conv.wait();
    event = eRes.message?.text?.trim() || '';
  }

  await ctx.reply('Enter phone number');
  const pRes = await conv.wait();
  const phone = pRes.message?.text?.trim() || '';
  const teacher = await teacherRepo.findByPhone(phone);
  if (!teacher) { await ctx.reply('Not recognized'); return; }
  const group = teacher.group;

  const students = (await studentRepo.read()).filter(s => s.group === group);
  const today = new Date();
  const isSameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const all = await attRepo.read();
  const todays = all.filter(a => a.event === event && isSameDay(new Date(a.created_at), today));
  const marked = new Set<number>(todays.map(a => a.student_id));

  let page = 0;
  let size = 10;
  let cmd: string | null = null;
  do {
    const totalPages = Math.max(1, Math.ceil(students.length / size));
    const slice = students.slice(page * size, (page + 1) * size);
    const kb = new InlineKeyboard();
    for (const s of slice) kb.text(`${marked.has(s.id) ? '✅ ' : ''}${s.first_name} ${s.last_name}`, `t:${s.id}`);
    kb.row();
    if (page > 0) kb.text('Previous', 'previous');
    if (page < totalPages - 1) kb.text('Next', 'next');
    kb.text('Finish', 'finish').text('Cancel', 'cancel');
    await ctx.reply(`${event} — ${group} — ${marked.size}/${students.length}`, { reply_markup: kb });
    const r = await conv.wait();
    cmd = r.callbackQuery?.data || null;
    if (!cmd) continue;
    if (cmd === 'cancel') { await cancelAndGreet(ctx, r); return; }
    if (cmd === 'finish') { await ctx.reply(`Saved ${marked.size}`); return; }
    if (cmd === 'next') page = Math.min(page + 1, totalPages - 1);
    if (cmd === 'previous') page = Math.max(page - 1, 0);
    if (cmd.startsWith('t:')) {
      const id = parseInt(cmd.split(':')[1], 10);
      if (marked.has(id)) {
        const ok = await attRepo.deleteToday(id, event);
        if (ok.success) marked.delete(id);
        await r.answerCallbackQuery({ text: ok.success ? 'Removed' : 'Not found' });
      } else {
        const created = await attRepo.create({ student_id: id, event });
        if (created) marked.add(id);
        await r.answerCallbackQuery({ text: created ? 'Marked' : 'Already today' });
      }
    }
  } while (cmd);
};