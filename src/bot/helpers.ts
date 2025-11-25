import type { MyContext } from "../types.js";
import { logger } from "../utils/logger.js";
import { t } from "../utils/i18n.js";

export function getLang(ctx: MyContext): string {
  return ctx.session?.language || "ar";
}

export function formatDate(date: Date, lang: string): string {
  return lang === "ar" ? date.toLocaleDateString("ar-SA") : date.toLocaleDateString("en-US");
}

export function exitLLMMode(ctx: MyContext): void {
  if (ctx.session?.inLLMMode) {
    ctx.session.inLLMMode = false;
    const lang = getLang(ctx);
    ctx
      .reply(t("llm_mode_exited", lang))
      .catch((err) => {
        logger.error("Error sending LLM mode exit message", {
          error: err instanceof Error ? err.message : String(err),
        });
      });
  }
}

