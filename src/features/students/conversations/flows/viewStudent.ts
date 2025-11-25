import type { Conversation } from "@grammyjs/conversations";
import type { BaseContext, MyContext } from "../../../types.js";
import { t } from "../../../utils/i18n.js";
import { Student } from "../model.js";
import {
  buildStudentKeyboard,
  deleteMenuMessage,
  getLang,
  studentService,
} from "../helpers.js";

export async function viewStudentConversation(
  conversation: Conversation<BaseContext, MyContext>,
  ctx: MyContext
) {
  const lang = getLang(ctx);

  await ctx.reply("Enter the student name to search:");
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

  const info = `
**Student Information**

ID: ${student.id}
Name: ${student.firstName} ${student.lastName}
Birth Year: ${student.birthYear}
Group: ${student.group || "N/A"}
Phone: ${student.phone || "N/A"}
Father's Phone: ${student.fatherPhone || "N/A"}
Mother's Phone: ${student.motherPhone || "N/A"}
  `.trim();

  await ctx.reply(info, { parse_mode: "Markdown" });
}

