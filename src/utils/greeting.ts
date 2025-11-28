import { InlineKeyboard } from "grammy";
import type { MyContext } from "../types";
import { getLang, t } from "./i18n.js";
import { logger } from "./logger.js";

const quickCommandButtons = [
  { key: "students", command: "/student" },
  { key: "teachers", command: "/teacher" },
  { key: "attendance", command: "/attendance" },
];

export async function sendGreeting(ctx: MyContext) {
  const lang = getLang(ctx.session);
  const locale = lang;
  await ctx.reply(t("greeting", locale));
  if (!ctx.session) {
    return;
  }
  ctx.session.state = "START";
  ctx.session.language = ctx.session.language as 'en' | 'ar' || locale;

  if (ctx.chat?.type === "private") {
    const keyboard = new InlineKeyboard();
    for (const btn of quickCommandButtons) {
      keyboard.text(t(btn.key, locale), `quick:${btn.command}`);
    }
    try {
      await ctx.reply(t("tap_button_hint", locale), {
        reply_markup: keyboard,
      });
    } catch (err) {
      logger.warn("Failed to send quick command keyboard", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
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