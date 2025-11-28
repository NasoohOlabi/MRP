import { InlineKeyboard } from "grammy";
import type { Conversation } from "@grammyjs/conversations";
import type { BaseContext, MyContext } from "../../../../types.js";
import { t } from "../../../../utils/i18n.js";
import { paginate } from "../../../../utils/pagination.js";
import { Student } from "../model.js";
import { teacherService } from "../../../../bot/services.js";
import {
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

  const students = results.map(r => r.item);

  // Use pagination helper for student selection
  const paginationResult = await paginate(conversation, ctx, {
    items: students,
    header: t("select_student", lang) + "\n",
    renderItem: (student) => {
      return `${student.firstName} ${student.lastName}${student.level ? ` (Level ${student.level})` : ""}`;
    },
    selectable: true,
    getItemId: (student) => `student_${student.id}`,
    lang,
  });

  if (paginationResult.cancelled || !paginationResult.selectedItem) {
    await ctx.reply(t("operation_cancelled", lang));
    return;
  }

  let student: Student = paginationResult.selectedItem;

  const updates: Partial<Student> = {};

  // Get teacher name for display
  const teacher = await teacherService.getById(student.teacherId);
  const teacherName = teacher?.name ?? `ID: ${student.teacherId}`;

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

    // Use pagination helper for teacher selection
    const paginationResult = await paginate(conversation, ctx, {
      items: teachers,
      header: (t("select_teacher", lang) || "Select a teacher:") + "\n",
      renderItem: (teacher) => teacher.name || `Teacher ${teacher.id}`,
      selectable: true,
      getItemId: (teacher) => `teacher_${teacher.id}`,
      lang,
    });

    if (paginationResult.cancelled || !paginationResult.selectedItem) {
      return student;
    }

    const selectedTeacher = paginationResult.selectedItem;
    updates.teacherId = selectedTeacher.id;
    return { ...student, teacherId: selectedTeacher.id };
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

