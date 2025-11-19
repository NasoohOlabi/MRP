import type { Conversation } from '@grammyjs/conversations';
import { InlineKeyboard } from 'grammy';
import { AttendanceRepo, StudentRepo, Student } from '../../model/drizzle/repos';
import type { BaseContext, MyContext } from '../../types';
import { cancelAndGreet } from '../../utils/greeting.js';
import { t, getLang } from '../../utils/i18n.js';

type AttendanceMethod = 'by_group' | 'all_students' | 'by_first_name' | 'by_last_name' | 'by_search';

export const createAttendanceTakingConversation = (attRepo: AttendanceRepo, studentRepo: StudentRepo) =>
    async (conv: Conversation<BaseContext, MyContext>, ctx: MyContext) => {
        const lang = getLang(ctx.session);

        // Step 1: Select attendance method
        const methodKb = new InlineKeyboard();
        methodKb.text(t('by_group', lang), 'by_group').row();
        methodKb.text(t('all_students', lang), 'all_students').row();
        methodKb.text(t('by_first_name', lang), 'by_first_name').row();
        methodKb.text(t('by_last_name', lang), 'by_last_name').row();
        methodKb.text(t('by_search', lang), 'by_search').row();
        methodKb.text(t('cancel', lang), 'cancel');

        await ctx.reply(t('attendance_method', lang), { reply_markup: methodKb });

        let res = await conv.wait();
        const method = res.callbackQuery?.data as AttendanceMethod | 'cancel' | undefined;
        if (res.callbackQuery) await res.answerCallbackQuery();
        if (!method || method === 'cancel') {
            await cancelAndGreet(ctx, res, 'operation_cancelled');
            return;
        }

        // Step 2: Get event name
        await ctx.reply(t('enter_event_name', lang));
        const eventRes = await conv.wait();
        const event = eventRes.message?.text?.trim() || '';
        if (!event) {
            await ctx.reply(t('operation_cancelled', lang));
            return;
        }

        // Step 3: Get all students
        const allStudents = await studentRepo.read();

        // Step 4: Route to appropriate flow
        switch (method) {
            case 'by_group':
                await handleByGroup(conv, ctx, attRepo, allStudents, event, lang);
                break;
            case 'all_students':
                await handleAllStudents(conv, ctx, attRepo, allStudents, event, lang);
                break;
            case 'by_first_name':
                await handleByFirstName(conv, ctx, attRepo, allStudents, event, lang);
                break;
            case 'by_last_name':
                await handleByLastName(conv, ctx, attRepo, allStudents, event, lang);
                break;
            case 'by_search':
                await handleBySearch(conv, ctx, attRepo, studentRepo, event, lang);
                break;
        }
    };

// Helper function to display paginated student list and handle marking
async function displayStudentList(
    conv: Conversation<BaseContext, MyContext>,
    ctx: MyContext,
    attRepo: AttendanceRepo,
    students: Student[],
    event: string,
    lang: string,
    title: string
) {
    let unmarkedStudents = students;
    const markedStudents: { student_id: number; status: 'present' | 'absent'; event: string }[] = [];
    const actionHistory: { student: Student; status: 'present' | 'absent' }[] = [];
    let page = 0;
    const pageSize = 10;
    let messageId: number | undefined;
    let cmd: string | null = null;

    do {
        const totalPages = Math.max(1, Math.ceil(unmarkedStudents.length / pageSize));
        const slice = unmarkedStudents.slice(page * pageSize, (page + 1) * pageSize);

        const kb = new InlineKeyboard();
        for (const s of slice) {
            kb.text(`${s.first_name} ${s.last_name}`, `view:${s.id}`)
                .text('❌', `absent:${s.id}`)
                .text('✅', `present:${s.id}`)
                .row();
        }

        if (page > 0) kb.text(t('previous', lang), 'previous');
        if (page < totalPages - 1) kb.text(t('next', lang), 'next');
        kb.row();

        kb.text(t('cancel', lang), 'cancel')
            .text(t('undo', lang), 'undo')
            .text(t('save', lang), 'save')
            .row();

        const pageInfo = t('page_info', lang)
            .replace('{current}', String(page + 1))
            .replace('{total}', String(totalPages));
        const attendanceFor = t('attendance_for', lang).replace('{event}', event);
        const newText = `${attendanceFor}\n${title}\n${pageInfo}`;

        if (messageId) {
            await ctx.api.editMessageText(ctx.chat?.id!, messageId, newText, { reply_markup: kb });
        } else {
            const message = await ctx.reply(newText, { reply_markup: kb });
            messageId = message.message_id;
        }

        const r = await conv.wait();
        cmd = r.callbackQuery?.data || null;

        if (!cmd) continue;

        if (cmd === 'cancel') {
            await cancelAndGreet(ctx, r, 'operation_cancelled');
            return;
        }

        if (cmd === 'next' || cmd === 'previous') {
            await r.answerCallbackQuery();
        }

        if (cmd === 'next') {
            page = Math.min(page + 1, totalPages - 1);
        } else if (cmd === 'previous') {
            page = Math.max(page - 1, 0);
        } else if (cmd === 'undo') {
            if (actionHistory.length > 0) {
                const lastAction = actionHistory.pop();
                if (lastAction) {
                    unmarkedStudents.push(lastAction.student);
                    unmarkedStudents.sort((a, b) => a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name));
                    const index = markedStudents.findIndex(
                        (ms) => ms.student_id === lastAction.student.id && ms.status === lastAction.status
                    );
                    if (index > -1) {
                        markedStudents.splice(index, 1);
                    }
                    // Adjust page if necessary after undoing
                    page = Math.min(page, Math.max(0, Math.ceil(unmarkedStudents.length / pageSize) - 1));
                }
            } else {
                await ctx.answerCallbackQuery({ text: t('nothing_to_undo', lang) });
            }
        } else if (cmd === 'save') {
            for (const record of markedStudents) {
                await attRepo.create({ student_id: record.student_id, event: record.event });
            }
            if (messageId) {
                await ctx.api.deleteMessage(ctx.chat?.id!, messageId);
            }
            await ctx.reply(t('attendance_saved', lang));
            return;
        } else if (cmd.startsWith('present:') || cmd.startsWith('absent:')) {
            const [action, idStr] = cmd.split(':');
            const id = parseInt(idStr, 10);
            const student = unmarkedStudents.find((s) => s.id === id);

            if (student) {
                const status = action === 'present' ? 'present' : 'absent';
                markedStudents.push({ student_id: id, status, event });
                actionHistory.push({ student, status });
                unmarkedStudents = unmarkedStudents.filter((s) => s.id !== id);
                // Adjust page to ensure we don't end up on an empty page if the last student on a page was marked
                page = Math.min(page, Math.max(0, Math.ceil(unmarkedStudents.length / pageSize) - 1));
                await r.answerCallbackQuery({ text: t(status === 'present' ? 'marked_present' : 'marked_absent', lang) });
            }
        }
    } while (cmd);
}

// By Group flow
async function handleByGroup(
    conv: Conversation<BaseContext, MyContext>,
    ctx: MyContext,
    attRepo: AttendanceRepo,
    allStudents: Student[],
    event: string,
    lang: string
) {
    const groups = Array.from(new Set(allStudents.map(s => s.group))).sort();

    const groupKb = new InlineKeyboard();
    for (const g of groups) {
        groupKb.text(g, `group:${g}`).row();
    }
    groupKb.text(t('cancel', lang), 'cancel');

    await ctx.reply(t('select_group', lang), { reply_markup: groupKb });

    const gRes = await conv.wait();
    const gCmd = gRes.callbackQuery?.data;
    if (gRes.callbackQuery) await gRes.answerCallbackQuery();

    if (!gCmd || gCmd === 'cancel') {
        await cancelAndGreet(ctx, gRes, 'operation_cancelled');
        return;
    }

    const group = gCmd.split(':')[1];
    const students = allStudents.filter(s => s.group === group);
    students.sort((a, b) => a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name));

    await displayStudentList(conv, ctx, attRepo, students, event, lang, `${t('by_group', lang)}: ${group}`);
}

// All Students flow
async function handleAllStudents(
    conv: Conversation<BaseContext, MyContext>,
    ctx: MyContext,
    attRepo: AttendanceRepo,
    allStudents: Student[],
    event: string,
    lang: string
) {
    const students = allStudents.slice();
    students.sort((a, b) => {
        if (a.group < b.group) return -1;
        if (a.group > b.group) return 1;
        if (a.last_name < b.last_name) return -1;
        if (a.last_name > b.last_name) return 1;
        if (a.first_name < b.first_name) return -1;
        if (a.first_name > b.first_name) return 1;
        return 0;
    });

    await displayStudentList(conv, ctx, attRepo, students, event, lang, t('all_students', lang));
}

// By First Name flow
async function handleByFirstName(
    conv: Conversation<BaseContext, MyContext>,
    ctx: MyContext,
    attRepo: AttendanceRepo,
    allStudents: Student[],
    event: string,
    lang: string
) {
    const students = allStudents.slice();
    students.sort((a, b) => a.first_name.localeCompare(b.first_name) || a.last_name.localeCompare(b.last_name));

    await displayStudentList(conv, ctx, attRepo, students, event, lang, t('by_first_name', lang));
}

// By Last Name flow
async function handleByLastName(
    conv: Conversation<BaseContext, MyContext>,
    ctx: MyContext,
    attRepo: AttendanceRepo,
    allStudents: Student[],
    event: string,
    lang: string
) {
    const students = allStudents.slice();
    students.sort((a, b) => a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name));

    await displayStudentList(conv, ctx, attRepo, students, event, lang, t('by_last_name', lang));
}

// By Search flow
async function handleBySearch(
    conv: Conversation<BaseContext, MyContext>,
    ctx: MyContext,
    attRepo: AttendanceRepo,
    studentRepo: StudentRepo,
    event: string,
    lang: string
) {
    await ctx.reply(t('type_search', lang));

    const searchRes = await conv.wait();
    const query = searchRes.message?.text?.trim() || '';

    if (!query) {
        await ctx.reply(t('operation_cancelled', lang));
        return;
    }

    const results = await studentRepo.lookFor(query);
    const students = results.map(r => r.item);

    if (students.length === 0) {
        await ctx.reply(t('no_results', lang));
        return;
    }

    await displayStudentList(conv, ctx, attRepo, students, event, lang, `${t('search', lang)}: "${query}"`);
}
