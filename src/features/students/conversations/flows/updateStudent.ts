import { InlineKeyboard } from "grammy";
import type { Conversation } from "@grammyjs/conversations";
import type { BaseContext, MyContext } from "../../../../types.js";
import { t } from "../../../../utils/i18n.js";
import { Student } from "../model.js";
import { teacherService } from "../../../../bot/services.js";
import {
  buildStudentKeyboard,
  deleteMenuMessage,
  getLang,
  studentService,
} from "../helpers.js";

export async function updateStudentConversation(
  conversation: Conversation<BaseContext, MyContext>,
  ctx: MyContext
) {
  const lang = getLang(ctx);

  await ctx.reply(t("enter_student_name_search", lang));
  let response = await conversation.wait();
  const searchQuery = response.message?.text?.trim();

  if (!searchQuery) {
    await ctx.reply(t("operation_failed", lang));
    return;
  }

  const results = await studentService.search(searchQuery);

  if (results.length === 0) {
    await ctx.reply(t("no_results", lang));
    return;
  }

  const keyboard = buildStudentKeyboard(
    results.map((result) => result.item),
    lang
  );

  await ctx.reply(t("select_student", lang), { reply_markup: keyboard });

  const btnCtx = await conversation.wait();
  const selectedData = btnCtx.callbackQuery?.data;

  if (!selectedData || selectedData === "cancel") {
    await btnCtx.answerCallbackQuery();
    await ctx.reply(t("operation_cancelled", lang));
    return;
  }

  await btnCtx.answerCallbackQuery();
  await deleteMenuMessage(ctx, btnCtx);

  const studentId = parseInt(selectedData.replace("student_", ""));
  let student: Student | null = await studentService.getById(studentId);

  if (!student) {
    await ctx.reply(t("operation_failed", lang));
    return;
  }

  const updates: Partial<Student> = {};

  // Get teacher name for display
  const teacher = await teacherService.getById(student.teacherId);
  const teacherName = teacher ? ((teacher as any).name || `${(teacher as any).firstName || ''} ${(teacher as any).lastName || ''}`.trim() || `Teacher ${teacher.id}`) : `ID: ${student.teacherId}`;

  while (true) {
    const currentInfo = `
${t("current_student_info", lang)}
${t("student_info_name", lang)}: ${student.firstName} ${student.lastName}
${t("student_info_birth_year", lang)}: ${student.birthYear || t("no_value", lang)}
${t("student_info_level", lang) || "Level"}: ${student.level || t("no_value", lang)}
${t("student_info_phone", lang)}: ${student.phone || t("no_value", lang)}
${t("student_info_teacher", lang) || "Teacher"}: ${teacherName}

${t("select_field_to_update", lang)}
    `.trim();

    const fieldKeyboard = new InlineKeyboard()
      .text(t("field_first_name", lang), "field_firstName")
      .row()
      .text(t("field_last_name", lang), "field_lastName")
      .row()
      .text(t("field_birth_year", lang) || "Birth Year", "field_birthYear")
      .row()
      .text(t("field_level", lang) || "Level", "field_level")
      .row()
      .text(t("field_phone", lang), "field_phone")
      .row()
      .text(t("field_teacher", lang) || "Teacher", "field_teacher")
      .row()
      .text(t("field_finish_save", lang), "field_finish")
      .row()
      .text(t("cancel", lang), "field_cancel");

    await ctx.reply(currentInfo, { parse_mode: "Markdown", reply_markup: fieldKeyboard });

    const fieldCtx = await conversation.wait();
    const fieldAction = fieldCtx.callbackQuery?.data;

    if (!fieldAction) {
      await ctx.reply(t("operation_failed", lang));
      return;
    }

    await fieldCtx.answerCallbackQuery();
    await deleteMenuMessage(ctx, fieldCtx);

    if (fieldAction === "field_cancel") {
      await ctx.reply(t("operation_cancelled", lang));
      return;
    }

    if (fieldAction === "field_finish") {
      await ctx.reply(t("processing", lang));
      try {
        await studentService.update({ ...student, ...updates });
        await ctx.reply(t("operation_completed", lang));
        return;
      } catch (err) {
        await ctx.reply(t("operation_failed", lang));
        return;
      }
    }

    response = await handleFieldAction(fieldAction, conversation, ctx, student, updates, lang);
    if (!response) {
      continue;
    }
    student = response;
  }
}

async function handleFieldAction(
  action: string,
  conversation: Conversation<BaseContext, MyContext>,
  ctx: MyContext,
  student: Student,
  updates: Partial<Student>,
  lang: string
): Promise<Student | null> {
  let response = await conversation.wait();
  const newValue = response.message?.text?.trim();

  if (action === "field_firstName" && newValue) {
    updates.firstName = newValue;
    return { ...student, firstName: newValue };
  }

  if (action === "field_lastName" && newValue) {
    updates.lastName = newValue;
    return { ...student, lastName: newValue };
  }

  if (action === "field_birthYear") {
    await ctx.reply(t("enter_birth_year", lang) || "Enter birth year (YYYY) or send '-' to clear:");
    response = await conversation.wait();
    const text = response.message?.text?.trim();
    if (text === "-") {
      updates.birthYear = null;
      return { ...student, birthYear: null };
    } else if (text && /^\d{4}$/.test(text)) {
      const year = parseInt(text);
      updates.birthYear = year;
      return { ...student, birthYear: year };
    } else {
      await ctx.reply(t("invalid_year_format", lang) || "Invalid year format. Please enter YYYY or '-' to clear:");
      return student;
    }
  }

  if (action === "field_level") {
    await ctx.reply("Enter level (1-4) or send '-' to clear:");
    response = await conversation.wait();
    const text = response.message?.text?.trim();
    if (text === "-") {
      updates.level = null;
      return { ...student, level: null };
    } else if (text && /^[1-4]$/.test(text)) {
      const level = parseInt(text);
      updates.level = level;
      return { ...student, level };
    } else {
      await ctx.reply("Invalid level. Please enter 1, 2, 3, or 4, or '-' to clear:");
      return student;
    }
  }

  if (action === "field_teacher") {
    const teachers = await teacherService.getAll();
    if (teachers.length === 0) {
      await ctx.reply("No teachers available.");
      return student;
    }

    const teacherKeyboard = new InlineKeyboard();
    for (const teacher of teachers.slice(0, 10)) {
      const teacherDisplayName = (teacher as any).name || `${(teacher as any).firstName || ''} ${(teacher as any).lastName || ''}`.trim() || `Teacher ${teacher.id}`;
      teacherKeyboard.text(teacherDisplayName, `teacher_${teacher.id}`).row();
    }
    teacherKeyboard.text(t("cancel", lang), "teacher_cancel");

    await ctx.reply(t("select_teacher", lang) || "Select a teacher:", { reply_markup: teacherKeyboard });
    const teacherCtx = await conversation.wait();
    const teacherAction = teacherCtx.callbackQuery?.data;

    await teacherCtx.answerCallbackQuery();
    await deleteMenuMessage(ctx, teacherCtx);

    if (teacherAction && teacherAction.startsWith("teacher_")) {
      if (teacherAction === "teacher_cancel") {
        return student;
      } else {
        const selectedTeacherId = parseInt(teacherAction.substring(8));
        if (!isNaN(selectedTeacherId)) {
          updates.teacherId = selectedTeacherId;
          return { ...student, teacherId: selectedTeacherId };
        }
      }
    }
    return student;
  }

  if (action === "field_phone" && newValue) {
    if (newValue === "-") {
      updates.phone = null;
      return { ...student, phone: null };
    }
    updates.phone = newValue;
    return { ...student, phone: newValue };
  }

  return null;
}

