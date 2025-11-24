import type { Conversation } from "@grammyjs/conversations";
import { appendFile } from "fs/promises";
import { InlineKeyboard } from "grammy";
import type {
  AnswerKey,
  BaseContext,
  ButtonOption,
  ButtonStep,
  MyContext,
  Step,
  TextStep,
  TreeConversationOptions
} from "../types";
import { cancelAndGreet, sendGreeting } from "../utils/greeting.js";
import { getLang, t } from "../utils/i18n.js";
import { logger } from "../utils/logger.js";

interface InPlaceMeta {
  chatId: number;
  messageId: number;
}

/**
 * A builder to create linear or branching conversations with type safety.
 * 
 * @example
 * ```ts
 * const conversation = new ConversationBuilder<{ name: string, role: 'admin' | 'user' }>()
 *   .text('name', 'enter_name')
 *   .menu('role', 'select_role', [
 *     { text: 'Admin', data: 'admin' },
 *     { text: 'User', data: 'user' }
 *   ])
 *   .build(async (results) => {
 *     console.log(results.name, results.role);
 *   });
 * ```
 */
export class ConversationBuilder<Shape extends Record<string, any> = Record<string, any>> {
  private steps: ((next: Step | null) => Step)[] = [];

  /**
   * Adds a text input step that prompts the user for text input.
   * 
   * @param key - The key to store the result under in the final results object
   * @param prompt - The i18n key for the prompt message
   * @param options - Configuration options
   * @param options.validate - Optional validation function. If it returns false, the error message is shown and the user is re-prompted.
   * @param options.error - i18n key for the error message shown when validation fails
   * @param options.action - Optional side-effect function called after validation passes
   * @param options.next - Optional custom next step or function. If not provided, continues to the next step in the chain.
   * @param options.promptParams - Optional parameters for the prompt message
   * 
   * @example
   * ```ts
   * .text('age', 'enter_age', {
   *   validate: (text) => {
   *     const age = parseInt(text);
   *     return !isNaN(age) && age > 0 && age < 150;
   *   },
   *   error: 'invalid_age',
   *   action: async (val) => {
   *     console.log('User entered age:', val);
   *   }
   * })
   * ```
   */
  text<K extends keyof Shape & string>(
    key: K,
    prompt: string,
    options: {
      promptParams?: Record<string, string>;
      validate?: (text: string) => boolean | Promise<boolean>;
      error?: string;
      action?: (value: string) => Promise<void> | void;
      next?: Step | ((val: string) => Promise<Step | null> | Step | null);
    } = {}
  ): this {
    this.steps.push((nextChain) => {
      const step: TextStep = {
        type: "text",
        key: key as unknown as AnswerKey,
        prompt,
        next: async (val) => {
          if (options.action) await options.action(val);

          if (options.next) {
            if (typeof options.next === 'function') {
              return options.next(val);
            }
            return options.next;
          }

          return nextChain;
        },
      };

      // Only add optional properties if they're defined
      if (options.promptParams !== undefined) step.promptParams = options.promptParams;
      if (options.validate !== undefined) step.validate = options.validate;
      if (options.error !== undefined) step.error = options.error;

      return step;
    });
    return this;
  }

  /**
   * Adds a button menu step that displays inline keyboard buttons.
   * 
   * @param key - The key to store the selected button's data under in the final results object
   * @param prompt - The i18n key for the prompt message
   * @param buttons - Array of button definitions or "__row__" to start a new row
   * @param options - Configuration options
   * @param options.inPlace - If true, edits the message instead of sending a new one (useful for pagination)
   * @param options.onSelect - Optional callback called when a button is selected
   * @param options.promptParams - Optional parameters for the prompt message
   * 
   * @example
   * ```ts
   * .menu('operation', 'select_operation', [
   *   { text: 'Create', data: 'create', next: createFlow },
   *   { text: 'Update', data: 'update' },
   *   '__row__', // Start new row
   *   { text: 'Cancel', data: 'cancel' }
   ], {
   *   inPlace: true,
   *   onSelect: async (data, ctx) => {
   *     console.log('Selected:', data);
   *   }
   * })
   * ```
   */
  menu<K extends keyof Shape & string>(
    key: K,
    prompt: string,
    buttons: (
      | {
        text: string;
        data: string;
        url?: string;
        next?: ConversationBuilder<any> | Step | null;
      }
      | "__row__"
    )[],
    options: {
      promptParams?: Record<string, string>;
      inPlace?: boolean;
      onSelect?: (data: string, ctx: MyContext, btnCtx: MyContext) => Promise<void>;
    } = {}
  ): this {
    this.steps.push((nextChain) => {
      const builtOptions: ButtonOption[] = buttons.map((b) => {
        if (b === "__row__") return { text: "", data: "__row__", next: null };

        let nextStep: Step | null | (() => Promise<Step | null>);

        if (b.next instanceof ConversationBuilder) {
          nextStep = b.next.compile();
        } else if (b.next !== undefined) {
          nextStep = b.next;
        } else {
          nextStep = nextChain;
        }

        const option: ButtonOption = {
          text: b.text,
          data: b.data,
          next: nextStep,
        };

        // Only add url if it's defined
        if (b.url !== undefined) option.url = b.url;

        return option;
      });

      const step: ButtonStep = {
        type: "button",
        key: key as unknown as AnswerKey,
        prompt,
        options: builtOptions,
      };

      // Only add optional properties if they're defined
      if (options.promptParams !== undefined) step.promptParams = options.promptParams;
      if (options.inPlace !== undefined) step.inPlace = options.inPlace;
      if (options.onSelect !== undefined) step.onSelect = options.onSelect;

      return step;
    });
    return this;
  }

  /**
   * Adds a custom step or a step generator function.
   * Useful for integrating dynamic steps (like pagination) that can't be expressed with the builder API.
   * 
   * @param stepOrFactory - Either a Step object or a function that takes the next step and returns a Step
   * 
   * @example
   * ```ts
   * .add((next) => ({
   *   type: 'button',
   *   key: 'custom' as AnswerKey,
   *   prompt: 'custom_prompt',
   *   options: [...]
   * }))
   * ```
   */
  add(stepOrFactory: Step | ((next: Step | null) => Step)): this {
    if (typeof stepOrFactory === 'function') {
      this.steps.push(stepOrFactory);
    } else {
      this.steps.push(() => stepOrFactory);
    }
    return this;
  }

  /**
   * Compiles the builder into a Step tree.
   * Internal use mostly, but can be used to compose builders or create branches.
   * 
   * @param next - Optional next step to chain after this builder's steps
   * @returns The compiled Step tree
   */
  compile(next: Step | null = null): Step {
    let current: Step | null = next;
    for (let i = this.steps.length - 1; i >= 0; i--) {
      const stepFn = this.steps[i];
      if (!stepFn) continue; // Should never happen, but TypeScript needs this check
      current = stepFn(current);
    }
    if (!current) throw new Error("ConversationBuilder cannot be empty");
    return current;
  }

  /**
   * Builds the conversation function to be registered with bot.use(createConversation(...)).
   * 
   * @param onSuccess - Callback called when the conversation completes successfully. Receives the collected results.
   * @param options - Optional configuration
   * @param options.successMessage - i18n key for the success message (default: "operation_completed")
   * @param options.failureMessage - i18n key for the failure message (default: "operation_failed")
   * @returns A conversation function compatible with @grammyjs/conversations
   * 
   * @example
   * ```ts
   * .build(
   *   async (results) => {
   *     await saveToDatabase(results);
   *   },
   *   {
   *     successMessage: 'data_saved',
   *     failureMessage: 'save_failed'
   *   }
   * )
   * ```
   */
  build(
    onSuccess: (results: Shape) => Promise<any> | any,
    options: { successMessage?: string; failureMessage?: string } = {}
  ) {
    const entry = this.compile();
    return createTreeConversation<Shape>({
      entry,
      onSuccess,
      successMessage: options.successMessage || "operation_completed",
      failureMessage: options.failureMessage || "operation_failed",
    });
  }
}

/**
 * The core runner for the Tree Conversation protocol.
 */
export function createTreeConversation<Shape = Record<string, string>>(
  opts: TreeConversationOptions<Shape>,
) {
  return async (conv: Conversation<BaseContext, MyContext>, ctx: MyContext) => {
    const conversationStartTime = Date.now();
    const userId = ctx.from?.id;
    const chatId = ctx.chat?.id;
    const results: Record<string, string> = {};
    let inPlaceMeta: InPlaceMeta | undefined = undefined;

    logger.info('Conversation started', {
      userId,
      chatId,
      conversationType: opts.entry?.type || 'unknown'
    });

    try {
      let step: Step | null = opts.entry;

      while (step) {
        if (step.type === "text") {
          logger.debug('Conversation step: text input', {
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
              // Check if user sent /start to cancel the conversation
              if (text.trim() === '/start') {
                logger.info('Conversation cancelled by /start command', { userId, chatId, stepKey: step.key });
                await cancelAndGreet(ctx);
                return;
              }
              break;
            } else if (res.callbackQuery) {
              await res.answerCallbackQuery();
            } else if (res.message) {
              // User sent a non-text message (photo, video, etc.)
              logger.debug('Conversation: Non-text message received', {
                userId,
                chatId,
                messageType: res.message?.photo ? 'photo' : res.message?.video ? 'video' : 'other'
              });
              await ctx.reply(t("please_send_text", getLang(ctx.session)));
            }
          }

          if (step.validate && !(await step.validate(text))) {
            logger.debug('Conversation: Validation failed', {
              userId,
              chatId,
              stepKey: step.key,
              input: text?.substring(0, 50)
            });
            if (step.error) await ctx.reply(t(step.error, getLang(ctx.session)));
            continue;
          }

          logger.debug('Conversation: Text input received', {
            userId,
            chatId,
            stepKey: step.key,
            inputLength: text?.length
          });
          results[step.key] = text.trim();
          step = await step.next(text);
        }

        else if (step.type === "button") {
          logger.debug('Conversation step: button menu', {
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
              logger.warn('Conversation: Failed to edit message in place, sending new message', {
                userId,
                chatId,
                error: e instanceof Error ? e.message : String(e)
              });
              sentMessage = await ctx.reply(messageText, { reply_markup: keyboard });
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

          if (data === 'cancel') {
            logger.info('Conversation cancelled by user', { userId, chatId, stepKey: step.key });
            // Always answer the callback query first
            try {
              await btnCtx.answerCallbackQuery();
            } catch (err) {
              logger.warn('Failed to answer callback query on cancel', {
                userId,
                chatId,
                error: err instanceof Error ? err.message : String(err),
              });
            }
            // Then handle the cancel flow
            try {
              await cancelAndGreet(ctx, btnCtx);
            } catch (err) {
              logger.error('Error during cancel flow', {
                userId,
                chatId,
                error: err instanceof Error ? err.message : String(err),
                errorStack: err instanceof Error ? err.stack : undefined,
              });
              // Still try to send greeting even if cancelAndGreet failed
              try {
                await sendGreeting(ctx);
              } catch (greetErr) {
                logger.error('Error sending greeting after cancel', {
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
            logger.warn('Conversation: Invalid option selected', {
              userId,
              chatId,
              stepKey: step.key,
              selectedData: data
            });
            await btnCtx.answerCallbackQuery({ text: "⚠️" });
            continue;
          }

          logger.debug('Conversation: Button selected', {
            userId,
            chatId,
            stepKey: step.key,
            selectedData: data
          });
          await btnCtx.answerCallbackQuery({
            text: `${t("you_selected", getLang(ctx.session))} ${t(opt.text, getLang(ctx.session))}`
          });

          // Delete the button message to prevent ghost buttons
          try {
            if (inPlaceMeta) {
              await ctx.api.deleteMessage(inPlaceMeta.chatId, inPlaceMeta.messageId);
            } else if (btnCtx.callbackQuery?.message) {
              const msg = btnCtx.callbackQuery.message;
              await btnCtx.api.deleteMessage(msg.chat.id, msg.message_id);
            }
          } catch (err) {
            logger.warn('Failed to delete button message', {
              userId,
              chatId,
              error: err instanceof Error ? err.message : String(err),
            });
          }

          if (step.onSelect) await step.onSelect(data, ctx, btnCtx);

          results[step.key] = data;

          let potential: Step | null;
          if (typeof opt.next === 'function') {
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

      // Check if onSuccess returned a special object indicating we should exit and enter another conversation
      if (onSuccessResult && typeof onSuccessResult === 'object' && 'exitAndEnter' in onSuccessResult) {
        const targetConversation = onSuccessResult.exitAndEnter as string;
        logger.info('Attempting to transition to another conversation', {
          userId,
          chatId,
          targetConversation
        });
        try {
          // Ensure session exists
          if (!ctx.session) {
            logger.error('Session is undefined, cannot transition conversation', {
              userId,
              chatId,
              targetConversation
            });
            // Initialize session if it doesn't exist
            ctx.session = { state: 'START', language: 'en' };
          }
          
          // Set pending conversation in session
          ctx.session.pendingConversation = targetConversation;
          logger.info('Pending conversation set in session', {
            userId,
            chatId,
            targetConversation
          });
          
          // Exit current conversation - the middleware will handle entering the new one
          // Note: We need to ensure the middleware runs after conversations exit
          await conv.skip();
          
          logger.info('Current conversation skipped', {
            userId,
            chatId,
            targetConversation
          });
        } catch (err) {
          logger.error('Failed to transition to target conversation', {
            userId,
            chatId,
            targetConversation,
            error: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined
          });
          // Clear pending conversation on error
          if (ctx.session) {
            ctx.session.pendingConversation = undefined;
          }
          await ctx.reply(t(opts.failureMessage, getLang(ctx.session)));
        }
        return;
      }

      await ctx.reply(t(opts.successMessage, getLang(ctx.session)));

      const totalDuration = Date.now() - conversationStartTime;
      logger.info('Conversation completed successfully', {
        userId,
        chatId,
        resultsCount: Object.keys(results).length,
        onSuccessDurationMs: onSuccessDuration,
        totalDurationMs: totalDuration
      });

    } catch (err) {
      const totalDuration = Date.now() - conversationStartTime;
      logger.error('Conversation error', {
        userId,
        chatId,
        error: err instanceof Error ? err.message : String(err),
        errorStack: err instanceof Error ? err.stack : undefined,
        results: Object.keys(results),
        totalDurationMs: totalDuration
      });

      // Debug: Write error details to file
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
        await appendFile('debug_error.txt', JSON.stringify(errorDetails, null, 2) + '\n\n');
      } catch (debugErr) {
        logger.error('Failed to write debug error file', { error: debugErr });
      }

      await ctx.reply(t(opts.failureMessage, getLang(ctx.session)));
    }
  };
}
