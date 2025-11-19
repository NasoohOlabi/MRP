import type { Conversation } from '@grammyjs/conversations';
import { InlineKeyboard } from 'grammy';
import { Student, StudentRepo, Teacher, TeacherRepo } from '../../model/drizzle/repos';
import type { BaseContext, MyContext } from '../../types';
import { cancelAndGreet } from '../../utils/greeting.js';
import { t, getLang } from '../../utils/i18n.js';

export const createBrowseConversation = (studentRepo: StudentRepo, teacherRepo: TeacherRepo, isTeacher: boolean) => async (conv: Conversation<BaseContext, MyContext>, ctx: MyContext) => {
    const first = new InlineKeyboard();
    first.text(t('students', getLang(ctx.session)), 'students').text(t('teachers', getLang(ctx.session)), 'teachers').row().text(t('cancel', getLang(ctx.session)), 'cancel');
    let inPlace: { chatId: number; messageId: number } | null = null;
    const sendOrEdit = async (text: string, kb?: InlineKeyboard) => {
        if (inPlace) {
            if (kb) return ctx.api.editMessageText(inPlace.chatId, inPlace.messageId, text, { reply_markup: kb });
            return ctx.api.editMessageText(inPlace.chatId, inPlace.messageId, text);
        }
        const sent = await ctx.reply(text, kb ? { reply_markup: kb } : undefined);
        inPlace = { chatId: sent.chat.id, messageId: sent.message_id };
    };

    await sendOrEdit(t('what_browse', getLang(ctx.session)), first);

    let res = await conv.wait();
    const kind = res.callbackQuery?.data;
    if (res.callbackQuery) await res.answerCallbackQuery();
    if (!kind) return;
    if (kind === 'cancel') { await cancelAndGreet(ctx, res); return; }

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
    filterKb.text(t('all', getLang(ctx.session)), 'all');
    for (const g of groups) filterKb.text(g, `group:${g}`);
    filterKb.row().text(t('search', getLang(ctx.session)), 'search').text(t('cancel', getLang(ctx.session)), 'cancel');
    await sendOrEdit(t('filter_search', getLang(ctx.session)), filterKb);

    res = await conv.wait();
    let filterCmd = res.callbackQuery?.data;
    let filtered = baseList.slice();
    if (res.callbackQuery) await res.answerCallbackQuery();
    if (!filterCmd) return;
    if (filterCmd === 'cancel') { await cancelAndGreet(ctx, res); return; }
    if (filterCmd.startsWith('group:')) {
        const g = filterCmd.split(':')[1];
        if (kind === 'students') {
            filtered = (baseList as Student[]).filter(x => x.group === g);
        } else {
            filtered = (baseList as Teacher[]).filter(x => x.group === g);
        }
    } else if (filterCmd === 'search') {
        await sendOrEdit(t('type_search', getLang(ctx.session)));
        const textMsg = await conv.wait();
        const q = textMsg.message?.text?.trim() || '';
        if (kind === 'students') {
            const hits = await studentRepo.lookFor(q);
            filtered = hits.map(h => h.item);
        } else {
            const hits = await teacherRepo.lookFor(q);
            filtered = hits.map(h => h.item);
        }
    }

    const sizeKb = new InlineKeyboard();
    sizeKb.text('2', 'size:2').text('5', 'size:5').text('10', 'size:10').row().text(t('cancel', getLang(ctx.session)), 'cancel');
    await sendOrEdit(t('page_size', getLang(ctx.session)), sizeKb);
    res = await conv.wait();
    const sizeCmd = res.callbackQuery?.data;
    if (res.callbackQuery) await res.answerCallbackQuery();
    if (!sizeCmd) return;
    if (sizeCmd === 'cancel') { await cancelAndGreet(ctx, res); return; }
    let pageSize = sizeCmd.startsWith('size:') ? parseInt(sizeCmd.split(':')[1], 10) : 5;

    let page = 0;
    let cmd: string | null = null;
    do {
        const kb = new InlineKeyboard();
        const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
        if (page > 0) kb.text(t('previous', getLang(ctx.session)), 'previous');
        if (page < totalPages - 1) kb.text(t('next', getLang(ctx.session)), 'next');
        kb.row().text(t('change_size', getLang(ctx.session)), 'change_size').text(t('change_filter', getLang(ctx.session)), 'change_filter').text(t('cancel', getLang(ctx.session)), 'cancel');

        const slice = filtered.slice(page * pageSize, (page + 1) * pageSize);
        const title = kind === 'students' ? t('students', getLang(ctx.session)) : t('teachers', getLang(ctx.session));
        const lines = slice.map(s => kind === 'students'
            ? `${s.group} / ${s.first_name} ${s.last_name} (${(s as Student).birth_year})`
            : `${s.group} / ${s.first_name} ${s.last_name}`
        ).join('\n');
        await sendOrEdit(`${title} (${filtered.length})\n${lines || t('no_results', getLang(ctx.session))}`, kb);
        res = await conv.wait();
        cmd = res.callbackQuery?.data || null;
        if (!cmd) continue;
        if (cmd === 'cancel') { await cancelAndGreet(ctx, res); return; }
        if (cmd === 'next' || cmd === 'previous') { if (res.callbackQuery) await res.answerCallbackQuery(); }
        if (cmd === 'next') page = Math.min(page + 1, totalPages - 1);
        if (cmd === 'previous') page = Math.max(page - 1, 0);
        if (cmd === 'change_size') {
            const kb2 = new InlineKeyboard();
            kb2.text('2', 'size:2').text('5', 'size:5').text('10', 'size:10').row().text(t('cancel', getLang(ctx.session)), 'cancel');
            await sendOrEdit(t('page_size', getLang(ctx.session)), kb2);
            const r2 = await conv.wait();
            const c2 = r2.callbackQuery?.data;
            if (r2.callbackQuery) await r2.answerCallbackQuery();
            if (c2 === 'cancel') { await cancelAndGreet(ctx, r2); return; }
            if (c2 && c2.startsWith('size:')) pageSize = parseInt(c2.split(':')[1], 10);
        }
        if (cmd === 'change_filter') {
            const kb3 = new InlineKeyboard();
            kb3.text(t('all', getLang(ctx.session)), 'all');
            for (const g of groups) kb3.text(g, `group:${g}`);
            kb3.row().text(t('search', getLang(ctx.session)), 'search').text(t('cancel', getLang(ctx.session)), 'cancel');
            await sendOrEdit(t('filter_search', getLang(ctx.session)), kb3);
            const r3 = await conv.wait();
            const c3 = r3.callbackQuery?.data;
            if (r3.callbackQuery) await r3.answerCallbackQuery();
            if (!c3 || c3 === 'cancel') { await cancelAndGreet(ctx, r3); return; }
            if (c3.startsWith('group:')) {
                const g = c3.split(':')[1];
                if (kind === 'students') {
                    filtered = (baseList as Student[]).filter(x => x.group === g);
                } else {
                    filtered = (baseList as Teacher[]).filter(x => x.group === g);
                }
            } else if (c3 === 'all') {
                filtered = baseList.slice();
            } else if (c3 === 'search') {
                await sendOrEdit(t('type_search', getLang(ctx.session)));
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
