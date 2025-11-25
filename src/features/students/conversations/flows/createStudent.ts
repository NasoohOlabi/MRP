import type { Conversation } from "@grammyjs/conversations";
import type { BaseContext, MyContext } from "../../../types.js";
import { t } from "../../../utils/i18n.js";
import { studentService, getLang } from "../helpers.js";

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

  await ctx.reply(t("enter_birth_year", lang));
  let birthYear: number | null = null;
  while (birthYear === null) {
    response = await conversation.wait();
    const text = response.message?.text?.trim();
    if (text && /^\d{4}$/.test(text)) {
      birthYear = parseInt(text);
    } else {
      await ctx.reply("Invalid year format. Please enter a 4-digit year (e.g., 2010).");
    }
  }

  await ctx.reply(
    t("enter_group_optional", lang) || `${t("enter_group", lang)} (${t("optional", lang) || "optional"})`
  );
  response = await conversation.wait();
  const group = response.message?.text?.trim() || null;

  await ctx.reply(t("enter_phone_optional", lang));
  response = await conversation.wait();
  const phone = response.message?.text?.trim() || null;

  await ctx.reply(t("enter_father_phone_optional", lang));
  response = await conversation.wait();
  const fatherPhone = response.message?.text?.trim() || null;

  await ctx.reply(t("enter_mother_phone_optional", lang));
  response = await conversation.wait();
  const motherPhone = response.message?.text?.trim() || null;

  await ctx.reply(t("processing", lang));
  try {
    const student = await studentService.register({
      firstName,
      lastName,
      birthYear,
      group,
      phone,
      fatherPhone,
      motherPhone,
    });
    await ctx.reply(
      `${t("operation_completed", lang)}\n\nStudent ID: ${student.id}\nName: ${student.firstName} ${student.lastName}`
    );
  } catch (err) {
    await ctx.reply(t("operation_failed", lang));
  }
}

