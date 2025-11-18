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
          await ctx.reply(step.prompt);
          const res = await conv.wait();
          const text = res.message?.text;

          if (text && step.validate && !(await step.validate(text))) {
            if (step.error) await ctx.reply(step.error);
            return; // early exit; consumer can retry by re-entering
          }

          results[step.key] = text!.trim();
          step = await step.next(text!);
        } else if (step.type === "button") {
          const keyboard = new InlineKeyboard();
          for (const opt of step.options) {
            opt.url
              ? keyboard.url(opt.text, opt.url)
              : keyboard.text(opt.text, opt.data);
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

          await sendOrEdit(step.prompt);

          /* ---------- wait for click ---------- */
          const btnCtx = await conv.wait();
          const data = btnCtx.callbackQuery?.data;

          if (!data) {
            await btnCtx.answerCallbackQuery({
              text: "Please select an option",
            });
            continue; // stay on same node
          }

          const opt: ButtonOption<AnswerKey<string>> = step.options.find((o) => o.data === data)!;
          await btnCtx.answerCallbackQuery({
            text: `You selected ${opt.text}`,
          });

          if (step.onSelect) await step.onSelect(data, ctx, btnCtx);

          results[step.key] = data;

          /* ---------- compute next node ---------- */
          const potential = await opt.next;
          step = potential;

          /* ---------- leave in-place mode? ---------- */
          if (!step || step.type !== "button" || !step.inPlace) {
            inPlaceMeta = undefined;
          }
        }
      }

      /* ---------- finished ---------- */
      await ctx.reply("Processing…");
      await conv.external(() => opts.onSuccess(results));
      await ctx.reply(opts.successMessage);
    } catch (err) {
      console.error("Tree conversation error:", err);
      await ctx.reply(opts.failureMessage);
    }
  };
}
