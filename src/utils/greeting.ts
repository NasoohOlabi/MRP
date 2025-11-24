import type { MyContext } from "../types";
import { t, getLang } from "./i18n.js";

export async function sendGreeting(ctx: MyContext) {
  await ctx.reply(t("greeting", getLang(ctx.session)));
  if (ctx.session) {
    ctx.session.state = "START";
  }
}

export async function deleteCallbackMessage(btnCtx?: MyContext) {
  const m = btnCtx?.callbackQuery?.message;
  if (!m) return;
  await btnCtx!.api.deleteMessage(m.chat.id, m.message_id);
}

export async function cancelAndGreet(ctx: MyContext, btnCtx?: MyContext, summaryText?: string) {
  try {
    await deleteCallbackMessage(btnCtx);
  } catch { }
  
  const lang = getLang(ctx.session);
  await ctx.reply(t(summaryText || 'operation_cancelled', lang));
  await sendGreeting(ctx);
}