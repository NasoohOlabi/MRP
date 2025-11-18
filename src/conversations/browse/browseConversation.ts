import type { Conversation } from '@grammyjs/conversations';
import { InlineKeyboard } from 'grammy';
import { Student, StudentRepo, TeacherRepo } from '../../model/drizzle/repos';
import type { BaseContext, MyContext } from '../../types';

export const createBrowseConversation = (studentRepo: StudentRepo, teacherRepo: TeacherRepo, isTeacher: boolean) => async (conv: Conversation<BaseContext, MyContext>, ctx: MyContext) => {
    const first = new InlineKeyboard();
    first.text('Students', 'students').text('Teachers', 'teachers').row().text('Cancel', 'cancel');
    let inPlace: { chatId: number; messageId: number } | null = null;
    const sendOrEdit = async (text: string, kb?: InlineKeyboard) => {
        if (inPlace) {
            if (kb) return ctx.api.editMessageText(inPlace.chatId, inPlace.messageId, text, { reply_markup: kb });
            return ctx.api.editMessageText(inPlace.chatId, inPlace.messageId, text);
        }
        const sent = await ctx.reply(text, kb ? { reply_markup: kb } : undefined);
        inPlace = { chatId: sent.chat.id, messageId: sent.message_id };
    };

    await sendOrEdit('What do you want to browse?', first);

    let res = await conv.wait();
    const kind = res.callbackQuery?.data;
    if (res.callbackQuery) await res.answerCallbackQuery();
    if (!kind) return;
    if (kind === 'cancel') {
        await sendOrEdit('Cancelled.');
        return;
    }

    let baseList = kind === 'students' ? await studentRepo.read() : await teacherRepo.read();
    baseList.sort((a, b) => {
        if (a.group < b.group) return -1;
        if (a.group > b.group) return 1;
        if (a.last_name < b.last_name) return -1;
        if (a.last_name > b.last_name) return 1;
        if (a.first_name < b.first_name) return -1;
        if (a.first_name > b.first_name) return 1;
        return 0;
    });

    const groups = Array.from(new Set(baseList.map(x => x.group))).sort();
    const filterKb = new InlineKeyboard();
    filterKb.text('All', 'all');
    for (const g of groups) filterKb.text(g, `group:${g}`);
    filterKb.row().text('Search', 'search').text('Cancel', 'cancel');
    await sendOrEdit('Filter by group or search', filterKb);

    res = await conv.wait();
    let filterCmd = res.callbackQuery?.data;
    let filtered = baseList.slice();
    if (res.callbackQuery) await res.answerCallbackQuery();
    if (!filterCmd) return;
    if (filterCmd === 'cancel') {
        await sendOrEdit('Cancelled.');
        return;
    }
    if (filterCmd.startsWith('group:')) {
        const g = filterCmd.split(':')[1];
        filtered = baseList.filter(x => x.group === g);
    } else if (filterCmd === 'search') {
        await sendOrEdit('Type a name to search');
        const t = await conv.wait();
        const q = t.message?.text?.trim() || '';
        if (kind === 'students') {
            const hits = await studentRepo.lookFor(q);
            filtered = hits.map(h => h.item);
        } else {
            const hits = await teacherRepo.lookFor(q);
            filtered = hits.map(h => h.item);
        }
    }

    const sizeKb = new InlineKeyboard();
    sizeKb.text('2', 'size:2').text('5', 'size:5').text('10', 'size:10').row().text('Cancel', 'cancel');
    await sendOrEdit('Page size', sizeKb);
    res = await conv.wait();
    const sizeCmd = res.callbackQuery?.data;
    if (res.callbackQuery) await res.answerCallbackQuery();
    if (!sizeCmd) return;
    if (sizeCmd === 'cancel') {
        await sendOrEdit('Cancelled.');
        return;
    }
    let pageSize = sizeCmd.startsWith('size:') ? parseInt(sizeCmd.split(':')[1], 10) : 5;

    let page = 0;
    let cmd: string | null = null;
    do {
        const kb = new InlineKeyboard();
        const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
        if (page > 0) kb.text('Previous', 'previous');
        if (page < totalPages - 1) kb.text('Next', 'next');
        kb.row().text('Change size', 'change_size').text('Change filter', 'change_filter').text('Cancel', 'cancel');

        const slice = filtered.slice(page * pageSize, (page + 1) * pageSize);
        const title = kind === 'students' ? 'Students' : 'Teachers';
        const lines = slice.map(s => kind === 'students'
            ? `${s.group} / ${s.first_name} ${s.last_name} (${(s as Student).birth_date})`
            : `${s.group} / ${s.first_name} ${s.last_name}`
        ).join('\n');
        await sendOrEdit(`${title} (${filtered.length})\n${lines || 'No results'}`, kb);
        res = await conv.wait();
        cmd = res.callbackQuery?.data || null;
        if (!cmd) continue;
        if (cmd === 'cancel') {
            if (res.callbackQuery) await res.answerCallbackQuery({ text: 'Cancelled' });
            return;
        }
        if (cmd === 'next' || cmd === 'previous') { if (res.callbackQuery) await res.answerCallbackQuery(); }
        if (cmd === 'next') page = Math.min(page + 1, totalPages - 1);
        if (cmd === 'previous') page = Math.max(page - 1, 0);
        if (cmd === 'change_size') {
            const kb2 = new InlineKeyboard();
            kb2.text('2', 'size:2').text('5', 'size:5').text('10', 'size:10').row().text('Cancel', 'cancel');
            await sendOrEdit('Page size', kb2);
            const r2 = await conv.wait();
            const c2 = r2.callbackQuery?.data;
            if (r2.callbackQuery) await r2.answerCallbackQuery();
            if (c2 === 'cancel') return;
            if (c2 && c2.startsWith('size:')) pageSize = parseInt(c2.split(':')[1], 10);
        }
        if (cmd === 'change_filter') {
            const kb3 = new InlineKeyboard();
            kb3.text('All', 'all');
            for (const g of groups) kb3.text(g, `group:${g}`);
            kb3.row().text('Search', 'search').text('Cancel', 'cancel');
            await sendOrEdit('Filter by group or search', kb3);
            const r3 = await conv.wait();
            const c3 = r3.callbackQuery?.data;
            if (r3.callbackQuery) await r3.answerCallbackQuery();
            if (!c3 || c3 === 'cancel') return;
            if (c3.startsWith('group:')) {
                const g = c3.split(':')[1];
                filtered = baseList.filter(x => x.group === g);
            } else if (c3 === 'all') {
                filtered = baseList.slice();
            } else if (c3 === 'search') {
                await sendOrEdit('Type a name to search');
                const t2 = await conv.wait();
                const q2 = t2.message?.text?.trim() || '';
                if (kind === 'students') {
                    const hits2 = await studentRepo.lookFor(q2);
                    filtered = hits2.map(h => h.item);
                } else {
                    const hits2 = await teacherRepo.lookFor(q2);
                    filtered = hits2.map(h => h.item);
                }
            }
            page = 0;
        }
    } while (cmd);
};
