import type { MyContext } from "../types";
import { t, getLang } from "./i18n.js";

export async function sendGreeting(ctx: MyContext) {
  await ctx.reply(t("greeting", getLang(ctx.session)));
  ctx.session.state = "START";
}

export async function deleteCallbackMessage(btnCtx?: MyContext) {
  const m = btnCtx?.callbackQuery?.message;
  if (!m) return;
  await btnCtx!.api.deleteMessage(m.chat.id, m.message_id);
}

export async function cancelAndGreet(ctx: MyContext, btnCtx?: MyContext) {
  try {
    await deleteCallbackMessage(btnCtx);
  } catch { }
  await sendGreeting(ctx);
}