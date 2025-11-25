import type { Conversation } from "@grammyjs/conversations";
import { appendFile } from "fs/promises";
import { InlineKeyboard } from "grammy";
import type {
  AnswerKey,
  BaseContext,
  ButtonOption,
  MyContext,
  Step,
  TreeConversationOptions
} from "../../types.js";
import { cancelAndGreet, sendGreeting } from "../../utils/greeting.js";
import { getLang, t } from "../../utils/i18n.js";
import { logger } from "../../utils/logger.js";

interface InPlaceMeta {
  chatId: number;
  messageId: number;
}

export function createTreeConversation<Shape = Record<string, string>>(
  opts: TreeConversationOptions<Shape>,
) {
  return async (conv: Conversation<BaseContext, MyContext>, ctx: MyContext) => {
    const conversationStartTime = Date.now();
    const userId = ctx.from?.id;
    const chatId = ctx.chat?.id;
    const results: Record<string, string> = {};
    let inPlaceMeta: InPlaceMeta | undefined = undefined;

    logger.info("Conversation started", {
      userId,
      chatId,
      conversationType: opts.entry?.type || "unknown"
    });

    try {
      let step: Step | null = opts.entry;

      while (step) {
        if (step.type === "text") {
          logger.debug("Conversation step: text input", {
            userId,
            chatId,
            stepKey: step.key,
            prompt: step.prompt
          });
          await ctx.reply(t(step.prompt, getLang(ctx.session), step.promptParams));

          let text: string | undefined;
          while (true) {
            const res = await conv.wait();

            if (res.message?.text) {
              text = res.message.text;
              if (text.trim() === "/start") {
                logger.info("Conversation cancelled by /start command", { userId, chatId, stepKey: step.key });
                await cancelAndGreet(ctx);
                return;
              }
              break;
            } else if (res.callbackQuery) {
              await res.answerCallbackQuery();
            } else if (res.message) {
              logger.debug("Conversation: Non-text message received", {
                userId,
                chatId,
                messageType: res.message?.photo ? "photo" : res.message?.video ? "video" : "other"
              });
              await ctx.reply(t("please_send_text", getLang(ctx.session)));
            }
          }

          if (step.validate && !(await step.validate(text))) {
            logger.debug("Conversation: Validation failed", {
              userId,
              chatId,
              stepKey: step.key,
              input: text?.substring(0, 50)
            });
            if (step.error) await ctx.reply(t(step.error, getLang(ctx.session)));
            continue;
          }

          logger.debug("Conversation: Text input received", {
            userId,
            chatId,
            stepKey: step.key,
            inputLength: text?.length
          });
          results[step.key] = text.trim();
          step = await step.next(text);
        }

        else if (step.type === "button") {
          logger.debug("Conversation step: button menu", {
            userId,
            chatId,
            stepKey: step.key,
            prompt: step.prompt,
            optionCount: step.options.length
          });
          const keyboard = new InlineKeyboard();
          for (const opt of step.options) {
            if (opt.data === "__row__") {
              keyboard.row();
              continue;
            }
            opt.url
              ? keyboard.url(t(opt.text, getLang(ctx.session)), opt.url)
              : keyboard.text(t(opt.text, getLang(ctx.session)), opt.data);
          }

          const messageText = t(step.prompt, getLang(ctx.session), step.promptParams);
          let sentMessage: Awaited<ReturnType<typeof ctx.reply>> | undefined;

          if (step.inPlace && inPlaceMeta) {
            try {
              await ctx.api.editMessageText(
                inPlaceMeta.chatId,
                inPlaceMeta.messageId,
                messageText,
                { reply_markup: keyboard },
              );
            } catch (e) {
              logger.warn("Conversation: Failed to edit message in place, sending new message", {
                userId,
                chatId,
                error: e instanceof Error ? e.message : String(e)
              });
              const fallbackMessage = `${messageText}\n\n${t("tap_button_hint", getLang(ctx.session))}`;
              sentMessage = await ctx.reply(fallbackMessage, { reply_markup: keyboard });
            }
          } else {
            sentMessage = await ctx.reply(messageText, { reply_markup: keyboard });
          }

          if (sentMessage && step.inPlace) {
            inPlaceMeta = {
              chatId: sentMessage.chat.id,
              messageId: sentMessage.message_id,
            };
          }

          const btnCtx = await conv.wait();
          const data = btnCtx.callbackQuery?.data;

          if (!data) {
            if (btnCtx.callbackQuery) {
              await btnCtx.answerCallbackQuery({ text: t("please_select_option", getLang(ctx.session)) });
            }
            continue;
          }

          if (data === "cancel") {
            logger.info("Conversation cancelled by user", { userId, chatId, stepKey: step.key });
            try {
              await btnCtx.answerCallbackQuery();
            } catch (err) {
              logger.warn("Failed to answer callback query on cancel", {
                userId,
                chatId,
                error: err instanceof Error ? err.message : String(err),
              });
            }
            try {
              await cancelAndGreet(ctx, btnCtx);
            } catch (err) {
              logger.error("Error during cancel flow", {
                userId,
                chatId,
                error: err instanceof Error ? err.message : String(err),
                errorStack: err instanceof Error ? err.stack : undefined,
              });
              try {
                await sendGreeting(ctx);
              } catch (greetErr) {
                logger.error("Error sending greeting after cancel", {
                  userId,
                  chatId,
                  error: greetErr instanceof Error ? greetErr.message : String(greetErr),
                });
              }
            }
            inPlaceMeta = undefined;
            return;
          }

          const opt: ButtonOption<AnswerKey> | undefined = step.options.find((o) => o.data === data);
          if (!opt) {
            logger.warn("Conversation: Invalid option selected", {
              userId,
              chatId,
              stepKey: step.key,
              selectedData: data
            });
            await btnCtx.answerCallbackQuery({ text: t("invalid_selection", getLang(ctx.session)) });
            continue;
          }

          logger.debug("Conversation: Button selected", {
            userId,
            chatId,
            stepKey: step.key,
            selectedData: data
          });
          await btnCtx.answerCallbackQuery({
            text: `${t("you_selected", getLang(ctx.session))} ${t(opt.text, getLang(ctx.session))}`
          });

          try {
            if (inPlaceMeta) {
              await ctx.api.deleteMessage(inPlaceMeta.chatId, inPlaceMeta.messageId);
            } else if (btnCtx.callbackQuery?.message) {
              const msg = btnCtx.callbackQuery.message;
              await btnCtx.api.deleteMessage(msg.chat.id, msg.message_id);
            }
          } catch (err) {
            logger.warn("Failed to delete button message", {
              userId,
              chatId,
              error: err instanceof Error ? err.message : String(err),
            });
          }

          if (step.onSelect) await step.onSelect(data, ctx, btnCtx);
          results[step.key] = data;

          let potential: Step | null;
          if (typeof opt.next === "function") {
            potential = await (opt.next as () => Promise<Step | null>)();
          } else {
            potential = await opt.next;
          }
          step = potential;

          if (!step || step.type !== "button" || !step.inPlace) {
            inPlaceMeta = undefined;
          }
        }
      }

      await ctx.reply(t("processing", getLang(ctx.session)));
      const onSuccessStartTime = Date.now();
      const onSuccessResult = await conv.external(() => opts.onSuccess(results as Shape));
      const onSuccessDuration = Date.now() - onSuccessStartTime;

      if (onSuccessResult && typeof onSuccessResult === "object" && "exitAndEnter" in onSuccessResult) {
        const targetConversation = onSuccessResult.exitAndEnter as string;
        logger.info("Attempting to transition to another conversation", {
          userId,
          chatId,
          targetConversation
        });
        try {
          if (!ctx.session) {
            logger.error("Session is undefined, cannot transition conversation", {
              userId,
              chatId,
              targetConversation
            });
            ctx.session = { state: "START", language: "en" };
          }

          ctx.session.pendingConversation = targetConversation;
          logger.info("Pending conversation set in session", {
            userId,
            chatId,
            targetConversation
          });

          await conv.skip();

          logger.info("Current conversation skipped", {
            userId,
            chatId,
            targetConversation
          });
        } catch (err) {
          logger.error("Failed to transition to target conversation", {
            userId,
            chatId,
            targetConversation,
            error: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined
          });
          if (ctx.session) {
            ctx.session.pendingConversation = undefined;
          }
          await ctx.reply(t(opts.failureMessage, getLang(ctx.session)));
        }
        return;
      }

      await ctx.reply(t(opts.successMessage, getLang(ctx.session)));

      const totalDuration = Date.now() - conversationStartTime;
      logger.info("Conversation completed successfully", {
        userId,
        chatId,
        resultsCount: Object.keys(results).length,
        onSuccessDurationMs: onSuccessDuration,
        totalDurationMs: totalDuration
      });

    } catch (err) {
      const totalDuration = Date.now() - conversationStartTime;
      logger.error("Conversation error", {
        userId,
        chatId,
        error: err instanceof Error ? err.message : String(err),
        errorStack: err instanceof Error ? err.stack : undefined,
        results: Object.keys(results),
        totalDurationMs: totalDuration
      });

      try {
        const errorDetails = {
          timestamp: new Date().toISOString(),
          userId,
          chatId,
          error: err instanceof Error ? err.message : String(err),
          errorStack: err instanceof Error ? err.stack : undefined,
          results: Object.keys(results),
          resultsData: results,
          totalDurationMs: totalDuration,
        };
        await appendFile("debug_error.txt", JSON.stringify(errorDetails, null, 2) + "\n\n");
      } catch (debugErr) {
        logger.error("Failed to write debug error file", { error: debugErr });
      }

      await ctx.reply(t(opts.failureMessage, getLang(ctx.session)));
    }
  };
}

