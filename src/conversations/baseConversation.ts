import type { Conversation } from "@grammyjs/conversations";
import { InlineKeyboard } from "grammy";
import type {
  AnswerKey,
  BaseContext,
  ButtonOption,
  MyContext,
  Step,
  TreeConversationOptions,
} from "../types";
import { cancelAndGreet } from "../utils/greeting.js";
import { t, getLang } from "../utils/i18n.js";

interface InPlaceMeta {
  chatId: number;
  messageId: number;
}

export function createTreeConversation<S extends Step>(
  opts: TreeConversationOptions,
) {
  return async (conv: Conversation<BaseContext, MyContext>, ctx: MyContext) => {
    const results: Record<string, string> = {};
    let inPlaceMeta: InPlaceMeta | undefined = undefined;

    try {
      let step: Step | null = opts.entry;

      while (step) {
        if (step.type === "text") {
          await ctx.reply(t(step.prompt, getLang(ctx.session), step.promptParams));
          const res = await conv.wait();
          const text = res.message?.text;

          if (text && step.validate && !(await step.validate(text))) {
            if (step.error) await ctx.reply(t(step.error, getLang(ctx.session)));
            return; // early exit; consumer can retry by re-entering
          }

          results[step.key] = text!.trim();
          step = await step.next(text!);
        } else if (step.type === "button") {
          const keyboard = new InlineKeyboard();
          for (const opt of step.options) {
            // Support row breaks using a sentinel data value
            if (opt.data === "__row__") {
              keyboard.row();
              continue;
            }
            opt.url
              ? keyboard.url(t(opt.text, getLang(ctx.session)), opt.url)
              : keyboard.text(t(opt.text, getLang(ctx.session)), opt.data);
          }

          /* ---------- send or edit ---------- */
          const sendOrEdit = async (text: string) => {
            if (step && step.type === 'button' && step.inPlace && inPlaceMeta) {
              return ctx.api.editMessageText(
                inPlaceMeta.chatId,
                inPlaceMeta.messageId,
                text,
                { reply_markup: keyboard },
              );
            }
            const sent = await ctx.reply(text, { reply_markup: keyboard });
            if (step && step.type === 'button' && step.inPlace) {
              inPlaceMeta = {
                chatId: sent.chat.id,
                messageId: sent.message_id,
              };
            }
          };

          await sendOrEdit(t(step.prompt, getLang(ctx.session), step.promptParams));

          /* ---------- wait for click ---------- */
          const btnCtx = await conv.wait();
          const data = btnCtx.callbackQuery?.data;

          if (!data) {
            if (btnCtx.callbackQuery) {
              await btnCtx.answerCallbackQuery({ text: t("please_select_option", getLang(ctx.session)) });
            }
            continue; // stay on same node
          }

          if (data === 'cancel') {
            await cancelAndGreet(ctx, btnCtx);
            inPlaceMeta = undefined;
            return;
          }
          const opt: ButtonOption<AnswerKey<string>> = step.options.find((o) => o.data === data)!;
          await btnCtx.answerCallbackQuery({ text: `${t("you_selected", getLang(ctx.session))} ${t(opt.text, getLang(ctx.session))}` });

          if (step.onSelect) await step.onSelect(data, ctx, btnCtx);

          results[step.key] = data;

          /* ---------- compute next node ---------- */
          let potential: Step | null;
          if (typeof opt.next === 'function') {
            potential = await (opt.next as () => Promise<Step | null>)();
          } else {
            potential = await opt.next;
          }
          step = potential;

          /* ---------- leave in-place mode? ---------- */
          if (!step || step.type !== "button" || !step.inPlace) {
            inPlaceMeta = undefined;
          }
        }
      }

      /* ---------- finished ---------- */
      await ctx.reply(t("processing", getLang(ctx.session)));
      await conv.external(() => opts.onSuccess(results));
      await ctx.reply(t(opts.successMessage, getLang(ctx.session)));
    } catch (err) {
      console.error("Tree conversation error:", err);
      await ctx.reply(t(opts.failureMessage, getLang(ctx.session)));
    }
  };
}
