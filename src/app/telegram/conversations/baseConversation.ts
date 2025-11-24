// Base conversation system - updated imports
import type { Conversation } from '@grammyjs/conversations';
import { appendFile } from 'fs/promises';
import { InlineKeyboard } from 'grammy';
import type { AnswerKey, BaseContext, ButtonOption, ButtonStep, MyContext, Step, TextStep, TreeConversationOptions } from '../../../types.js';
import { cancelAndGreet, sendGreeting } from '../utils/greeting.js';
import { getLang, t } from '../../../infrastructure/i18n/index.js';
import { logger } from '../../../infrastructure/observability/index.js';
import { withSpan } from '../../../infrastructure/observability/tracing.js';

interface InPlaceMeta {
	chatId: number;
	messageId: number;
}

/**
 * A builder to create linear or branching conversations with type safety.
 */
export class ConversationBuilder<Shape extends Record<string, any> = Record<string, any>> {
	private steps: ((next: Step | null) => Step)[] = [];

	text<K extends keyof Shape & string>(
		key: K,
		prompt: string,
		options: {
			promptParams?: Record<string, string>;
			validate?: (text: string) => boolean | Promise<boolean>;
			error?: string;
			action?: (value: string) => Promise<void> | void;
			next?: Step | ((val: string) => Promise<Step | null> | Step | null);
		} = {},
	): this {
		this.steps.push((nextChain) => {
			const step: TextStep = {
				type: 'text',
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
			| '__row__'
		)[],
		options: {
			promptParams?: Record<string, string>;
			inPlace?: boolean;
			onSelect?: (data: string, ctx: MyContext, btnCtx: MyContext) => Promise<void>;
		} = {},
	): this {
		this.steps.push((nextChain) => {
			const builtOptions: ButtonOption[] = buttons.map((b) => {
				if (b === '__row__') return { text: '', data: '__row__', next: null };

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
				type: 'button',
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

	add(stepOrFactory: Step | ((next: Step | null) => Step)): this {
		if (typeof stepOrFactory === 'function') {
			this.steps.push(stepOrFactory);
		} else {
			this.steps.push(() => stepOrFactory);
		}
		return this;
	}

	compile(next: Step | null = null): Step {
		let current: Step | null = next;
		for (let i = this.steps.length - 1; i >= 0; i--) {
			const stepFn = this.steps[i];
			if (!stepFn) continue; // Should never happen, but TypeScript needs this check
			current = stepFn(current);
		}
		if (!current) throw new Error('ConversationBuilder cannot be empty');
		return current;
	}

	build(
		onSuccess: (results: Shape) => Promise<any> | any,
		options: { successMessage?: string; failureMessage?: string } = {},
	) {
		const entry = this.compile();
		return createTreeConversation<Shape>({
			entry,
			onSuccess,
			successMessage: options.successMessage || 'operation_completed',
			failureMessage: options.failureMessage || 'operation_failed',
		});
	}
}

/**
 * The core runner for the Tree Conversation protocol.
 */
export function createTreeConversation<Shape = Record<string, string>>(opts: TreeConversationOptions<Shape>) {
	return async (conv: Conversation<BaseContext, MyContext>, ctx: MyContext) => {
		return withSpan('conversation.execute', async () => {
			const userId = ctx.from?.id;
			const chatId = ctx.chat?.id;
			const results: Record<string, string> = {};
			let inPlaceMeta: InPlaceMeta | undefined = undefined;

			logger.info('Conversation started', {
				userId,
				chatId,
				conversationType: opts.entry?.type || 'unknown',
			});

			try {
				let step: Step | null = opts.entry;

				while (step) {
					if (step.type === 'text') {
						logger.debug('Conversation step: text input', {
							userId,
							chatId,
							stepKey: step.key,
							prompt: step.prompt,
						});
						await ctx.reply(t(step.prompt, getLang(ctx.session), step.promptParams));

						let text: string | undefined;
						while (true) {
							const res = await conv.wait();

							if (res.message?.text) {
								text = res.message.text;
								if (text.trim() === '/start') {
									logger.info('Conversation cancelled by /start command', { userId, chatId, stepKey: step.key });
									await cancelAndGreet(ctx);
									return;
								}
								break;
							} else if (res.callbackQuery) {
								await res.answerCallbackQuery();
							} else if (res.message) {
								logger.debug('Conversation: Non-text message received', {
									userId,
									chatId,
									messageType: res.message?.photo ? 'photo' : res.message?.video ? 'video' : 'other',
								});
								await ctx.reply(t('please_send_text', getLang(ctx.session)));
							}
						}

						if (step.validate && !(await step.validate(text!))) {
							logger.debug('Conversation: Validation failed', {
								userId,
								chatId,
								stepKey: step.key,
								input: text?.substring(0, 50),
							});
							if (step.error) await ctx.reply(t(step.error, getLang(ctx.session)));
							continue;
						}

						logger.debug('Conversation: Text input received', {
							userId,
							chatId,
							stepKey: step.key,
							inputLength: text?.length,
						});
						results[step.key] = text!.trim();
						step = await step.next(text!);
					} else if (step.type === 'button') {
						logger.debug('Conversation step: button menu', {
							userId,
							chatId,
							stepKey: step.key,
							prompt: step.prompt,
							optionCount: step.options.length,
						});
						const keyboard = new InlineKeyboard();
						for (const opt of step.options) {
							if (opt.data === '__row__') {
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
								await ctx.api.editMessageText(inPlaceMeta.chatId, inPlaceMeta.messageId, messageText, {
									reply_markup: keyboard,
								});
							} catch (e) {
								logger.warn('Conversation: Failed to edit message in place, sending new message', {
									userId,
									chatId,
									error: e instanceof Error ? e.message : String(e),
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
								await btnCtx.answerCallbackQuery({ text: t('please_select_option', getLang(ctx.session)) });
							}
							continue;
						}

						if (data === 'cancel') {
							logger.info('Conversation cancelled by user', { userId, chatId, stepKey: step.key });
							try {
								await btnCtx.answerCallbackQuery();
							} catch (err) {
								logger.warn('Failed to answer callback query on cancel', {
									userId,
									chatId,
									error: err instanceof Error ? err.message : String(err),
								});
							}
							try {
								await cancelAndGreet(ctx, btnCtx);
							} catch (err) {
								logger.error('Error during cancel flow', {
									userId,
									chatId,
									error: err instanceof Error ? err.message : String(err),
									errorStack: err instanceof Error ? err.stack : undefined,
								});
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
								selectedData: data,
							});
							await btnCtx.answerCallbackQuery({ text: '⚠️' });
							continue;
						}

						logger.debug('Conversation: Button selected', {
							userId,
							chatId,
							stepKey: step.key,
							selectedData: data,
						});
						await btnCtx.answerCallbackQuery({
							text: `${t('you_selected', getLang(ctx.session))} ${t(opt.text, getLang(ctx.session))}`,
						});

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

						if (!step || step.type !== 'button' || !step.inPlace) {
							inPlaceMeta = undefined;
						}
					}
				}

				await ctx.reply(t('processing', getLang(ctx.session)));
				const onSuccessResult = await conv.external(() => opts.onSuccess(results as Shape));

				if (onSuccessResult && typeof onSuccessResult === 'object' && 'exitAndEnter' in onSuccessResult) {
					logger.info('Attempting to transition to another conversation', {
						userId,
						chatId,
						targetConversation: onSuccessResult.exitAndEnter,
					});
					await conv.external(() => ctx.conversation.enter(onSuccessResult.exitAndEnter as string));
					return;
				}

				await ctx.reply(t(opts.successMessage, getLang(ctx.session)));

				logger.info('Conversation completed successfully', {
					userId,
					chatId,
					resultsCount: Object.keys(results).length,
				});
			} catch (err) {
				logger.error('Conversation error', {
					userId,
					chatId,
					error: err instanceof Error ? err.message : String(err),
					errorStack: err instanceof Error ? err.stack : undefined,
					results: Object.keys(results),
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
					};
					await appendFile('debug_error.txt', JSON.stringify(errorDetails, null, 2) + '\n\n');
				} catch (debugErr) {
					logger.error('Failed to write debug error file', { error: debugErr });
				}

				await ctx.reply(t(opts.failureMessage, getLang(ctx.session)));
			}
		});
	};
}

