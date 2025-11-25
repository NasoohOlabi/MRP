import { InlineKeyboard } from "grammy";
import type { MyContext } from "../../types.js";
import { StudentService } from "../model.js";
import { t } from "../../utils/i18n.js";

export const studentService = new StudentService();

export function getLang(ctx: MyContext): string {
  return ctx.session?.language || "en";
}

export async function deleteMenuMessage(ctx: MyContext, callbackCtx?: MyContext): Promise<void> {
  if (!callbackCtx?.callbackQuery?.message) {
    return;
  }
  try {
    await ctx.api.deleteMessage(
      callbackCtx.callbackQuery.message.chat.id,
      callbackCtx.callbackQuery.message.message_id
    );
  } catch (err) {
    // Ignore deletion errors
  }
}

export function buildStudentKeyboard(
  students: { id: number; firstName: string; lastName: string; group: string | null }[],
  lang: string
): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  for (const student of students.slice(0, 10)) {
    keyboard
      .text(
        `${student.firstName} ${student.lastName}${student.group ? ` (${student.group})` : ""}`,
        `student_${student.id}`
      )
      .row();
  }
  keyboard.text(t("cancel", lang), "cancel");
  return keyboard;
}

