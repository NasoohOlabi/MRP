import type { Conversation } from "@grammyjs/conversations";
import { InlineKeyboard } from "grammy";
import type { BaseContext, MyContext } from "../../../../types.js";
import { t } from "../../../../utils/i18n.js";
import { teacherService } from "../../../../bot/services.js";
import { getLang, studentService, deleteMenuMessage } from "../helpers.js";

export async function createStudentConversation(conversation: Conversation<BaseContext, MyContext>, ctx: MyContext) {
  const lang = getLang(ctx);

  await ctx.reply(t("enter_first_name", lang));
  let response = await conversation.wait();
  while (!response.message?.text?.trim()) {
    await ctx.reply(t("enter_first_name", lang));
    response = await conversation.wait();
  }
  const firstName = response.message.text.trim();

  await ctx.reply(t("enter_last_name", lang));
  response = await conversation.wait();
  while (!response.message?.text?.trim()) {
    await ctx.reply(t("enter_last_name", lang));
    response = await conversation.wait();
  }
  const lastName = response.message.text.trim();

  await ctx.reply(t("enter_birth_year", lang) || "Enter birth year (YYYY) or send '-' to skip:");
  let birthYear: number | null = null;
  while (birthYear === null) {
    response = await conversation.wait();
    const text = response.message?.text?.trim();
    if (text === "-") {
      birthYear = null;
      break;
    } else if (text && /^\d{4}$/.test(text)) {
      birthYear = parseInt(text);
    } else {
      await ctx.reply(t("invalid_year_format", lang) || "Invalid year format. Please enter YYYY or '-' to skip:");
    }
  }

  await ctx.reply(t("enter_phone_optional", lang) || "Enter phone number (optional, send '-' to skip):");
  response = await conversation.wait();
  const phone = response.message?.text?.trim() === "-" ? null : (response.message?.text?.trim() || null);

  await ctx.reply(t("enter_level_optional", lang) || "Enter level (1-4) or send '-' to skip:");
  let level: number | null = null;
  while (level === null) {
    response = await conversation.wait();
    const text = response.message?.text?.trim();
    if (text === "-") {
      level = null;
      break;
    } else if (text && /^[1-4]$/.test(text)) {
      level = parseInt(text);
    } else {
      await ctx.reply("Invalid level. Please enter 1, 2, 3, or 4, or '-' to skip:");
    }
  }

  // Select teacher
  const teachers = await teacherService.getAll();
  if (teachers.length === 0) {
    await ctx.reply("No teachers available. Please create a teacher first.");
    return;
  }

  const teacherKeyboard = new InlineKeyboard();
  for (const teacher of teachers.slice(0, 10)) {
    const teacherDisplayName = teacher.name || `Teacher ${teacher.id}`;
    teacherKeyboard.text(teacherDisplayName, `teacher_${teacher.id}`).row();
  }
  teacherKeyboard.text(t("cancel", lang), "cancel");

  await ctx.reply(t("select_teacher", lang) || "Select a teacher:", { reply_markup: teacherKeyboard });

  const btnCtx = await conversation.wait();
  const selectedTeacher = btnCtx.callbackQuery?.data;

  if (!selectedTeacher || selectedTeacher === "cancel") {
    await btnCtx.answerCallbackQuery();
    await ctx.reply(t("operation_cancelled", lang));
    return;
  }

  await btnCtx.answerCallbackQuery();
  await deleteMenuMessage(ctx, btnCtx);

  const teacherId = parseInt(selectedTeacher.replace("teacher_", ""));
  if (isNaN(teacherId)) {
    await ctx.reply(t("operation_failed", lang));
    return;
  }

  await ctx.reply(t("processing", lang));
  try {
    const student = await studentService.register({
      firstName,
      lastName,
      birthYear,
      phone,
      level,
      teacherId,
    });
    await ctx.reply(
      `${t("operation_completed", lang)}\n\nStudent ID: ${student.id}\nName: ${student.firstName} ${student.lastName}`
    );
  } catch (err) {
    await ctx.reply(t("operation_failed", lang));
  }
}

