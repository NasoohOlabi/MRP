import { InlineKeyboard } from "grammy";
import type { Conversation } from "@grammyjs/conversations";
import type { BaseContext, MyContext } from "../../../../types.js";
import { t } from "../../../../utils/i18n.js";
import { Student } from "../model.js";
import {
  buildStudentKeyboard,
  deleteMenuMessage,
  getLang,
  studentService,
} from "../helpers.js";

export async function deleteStudentConversation(
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
  const student: Student | null = await studentService.getById(studentId);

  if (!student) {
    await ctx.reply(t("operation_failed", lang));
    return;
  }

  const confirmKeyboard = new InlineKeyboard()
    .text(t("confirm_delete_yes", lang), "confirm_delete")
    .text(t("cancel", lang), "cancel");

  await ctx.reply(
    t("confirm_delete_prompt", lang).replace(
      "{name}",
      `${student.firstName} ${student.lastName}`
    ),
    { reply_markup: confirmKeyboard }
  );

  const confirmCtx = await conversation.wait();
  const confirmation = confirmCtx.callbackQuery?.data;

  await confirmCtx.answerCallbackQuery();
  await deleteMenuMessage(ctx, confirmCtx);

  if (confirmation === "confirm_delete") {
    await ctx.reply(t("processing", lang));
    try {
      await studentService.remove(studentId);
      await ctx.reply(t("operation_completed", lang));
    } catch (err) {
      await ctx.reply(t("operation_failed", lang));
    }
  } else {
    await ctx.reply(t("operation_cancelled", lang));
  }
}

