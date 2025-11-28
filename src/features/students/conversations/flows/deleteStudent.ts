import { InlineKeyboard } from "grammy";
import type { Conversation } from "@grammyjs/conversations";
import type { BaseContext, MyContext } from "../../../../types.js";
import { t } from "../../../../utils/i18n.js";
import { paginate } from "../../../../utils/pagination.js";
import { Student } from "../model.js";
import {
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

  const student: Student = paginationResult.selectedItem;

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
      await studentService.remove(student.id);
      await ctx.reply(t("operation_completed", lang));
    } catch (err) {
      await ctx.reply(t("operation_failed", lang));
    }
  } else {
    await ctx.reply(t("operation_cancelled", lang));
  }
}

