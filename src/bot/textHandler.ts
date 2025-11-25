import type { Bot } from "grammy";
import type { MyContext } from "../types.js";
import { getCurrentUser, requireAdmin, requireTeacher } from "../utils/auth.js";
import {
	buildHelpReply,
	isHelpQuestion,
} from "../utils/helpDetector.js";
import { t } from "../utils/i18n.js";
import {
	type ChatMessage,
	classifyIntent,
	createSystemPrompt,
	queryLMStudio,
	sanitizeTelegramMarkdown,
} from "../utils/lmStudio.js";
import { logger } from "../utils/logger.js";
import { exitLLMMode, getLang } from "./helpers.js";
const intentRoutes: Record<
	string,
	{ conversation: string; requiresRole?: "teacher" | "admin" }
> = {
	"students.menu": { conversation: "students", requiresRole: "teacher" },
	"teachers.menu": { conversation: "teachers", requiresRole: "teacher" },
	"attendance.mark": { conversation: "attendance", requiresRole: "teacher" },
	"memorization.record": { conversation: "memorization", requiresRole: "teacher" },
	"users.register": { conversation: "register_user", requiresRole: "admin" },
};

const MAX_HISTORY_LENGTH = 10;

export function registerTextHandler(bot: Bot<MyContext>): void {
	bot.on("callback_query:data", async (ctx) => {
		const data = ctx.callbackQuery?.data;
		if (!data?.startsWith("quick:")) {
			return;
		}
		try {
			await ctx.answerCallbackQuery();
			const command = data.replace("quick:", "");
			const chatId = ctx.chat?.id;
			if (!chatId) {
				return;
			}
			await ctx.api.sendMessage(chatId, command);
		} catch (error) {
			logger.error("Failed to handle quick callback command", {
				error: error instanceof Error ? error.message : String(error),
			});
		}
	});

	bot.on("message:text", async (ctx) => {
		const messageText = ctx.message.text;
		const lang = getLang(ctx);

		if (messageText.startsWith("/")) {
			return;
		}

		if (!ctx.from?.id) {
			return;
		}

		const user = await getCurrentUser(ctx);

		if (isHelpQuestion(messageText)) {
			const helpOptions: { isAdmin?: boolean; state?: string } = {
				isAdmin: user?.role === "admin",
			};
			if (ctx.session?.state) {
				helpOptions.state = ctx.session.state;
			}
			const helpReply = buildHelpReply(ctx, helpOptions);
			await ctx.reply(helpReply);
			logger.info("help-question", {
				userId: ctx.from.id,
				state: ctx.session?.state,
				lang,
			});
			appendLmHistory(ctx, [
				{ role: "user", content: messageText },
				{ role: "assistant", content: helpReply },
			]);
			return;
		}

		if (user && user.isActive && user.role === "admin" && ctx.session?.inLLMMode) {
			try {
				await ctx.api.sendChatAction(ctx.chat.id, "typing");
				const history = ctx.session.lmStudioHistory || [];
				const systemPrompt = await createSystemPrompt(lang as "en" | "ar");
				const response = await queryLMStudio(messageText, systemPrompt, {}, history);
				const sanitizedResponse = sanitizeTelegramMarkdown(response);

				if (!ctx.session.lmStudioHistory) {
					ctx.session.lmStudioHistory = [];
				}
				ctx.session.lmStudioHistory.push(
					{ role: "user", content: messageText },
					{ role: "assistant", content: sanitizedResponse }
				);
				if (ctx.session.lmStudioHistory.length > 10) {
					ctx.session.lmStudioHistory = ctx.session.lmStudioHistory.slice(-10);
				}

				try {
					await ctx.reply(sanitizedResponse, { parse_mode: "Markdown" });
				} catch (markdownError) {
					logger.warn("Markdown parsing failed, sending as plain text", {
						error: markdownError instanceof Error ? markdownError.message : String(markdownError),
					});
					await ctx.reply(sanitizedResponse);
				}
			} catch (error) {
				logger.error("Error processing LLM request", {
					error: error instanceof Error ? error.message : String(error),
				});
				await ctx.reply(t("llm_error", lang));
			}
			return;
		}

		if (await tryHandleIntent(ctx, messageText, lang)) {
			return;
		}

		if (ctx.session?.state === "START") {
			if (messageText === "/student") {
				logger.info("Text command received: /student", { userId: ctx.from?.id, chatId: ctx.chat?.id });
				exitLLMMode(ctx);
				if (await requireTeacher(ctx)) {
					await ctx.conversation.enter("students");
				}
			} else if (messageText === "/teacher") {
				logger.info("Text command received: /teacher", { userId: ctx.from?.id, chatId: ctx.chat?.id });
				exitLLMMode(ctx);
				if (await requireTeacher(ctx)) {
					await ctx.conversation.enter("teachers");
				}
			} else if (messageText === "/attendance") {
				logger.info("Text command received: /attendance", { userId: ctx.from?.id, chatId: ctx.chat?.id });
				exitLLMMode(ctx);
				if (await requireTeacher(ctx)) {
					await ctx.conversation.enter("attendance");
				}
			} else if (messageText === "/memorize") {
				logger.info("Text command received: /memorize", { userId: ctx.from?.id, chatId: ctx.chat?.id });
				exitLLMMode(ctx);
				if (await requireTeacher(ctx)) {
					await ctx.conversation.enter("memorization");
				}
			}
		}
	});
}

function appendLmHistory(ctx: MyContext, entries: ChatMessage[]) {
	if (!ctx.session) {
		return;
	}
	ctx.session.lmStudioHistory = [...(ctx.session.lmStudioHistory || []), ...entries];
	if (ctx.session.lmStudioHistory.length > MAX_HISTORY_LENGTH) {
		ctx.session.lmStudioHistory = ctx.session.lmStudioHistory.slice(-MAX_HISTORY_LENGTH);
	}
}

async function tryHandleIntent(ctx: MyContext, messageText: string, lang: string): Promise<boolean> {
	const history = ctx.session?.lmStudioHistory || [];
	const language = lang === "ar" ? "ar" : "en";
	const classification = await classifyIntent(messageText, language, history);

	if (classification) {
		appendLmHistory(ctx, [
			{ role: "user", content: messageText },
			{ role: "assistant", content: classification.reason || classification.intent },
		]);
	}

	if (!classification) {
		return false;
	}

	const route = intentRoutes[classification.intent];
	const userId = ctx.from?.id;

	if (classification.confidence >= 0.6 && route) {
		logger.info("intent-match", {
			userId,
			intent: classification.intent,
			confidence: classification.confidence,
			conversation: route.conversation,
		});
		exitLLMMode(ctx);
		let permissionGranted = true;
		if (route.requiresRole === "teacher") {
			permissionGranted = await requireTeacher(ctx);
		} else if (route.requiresRole === "admin") {
			permissionGranted = await requireAdmin(ctx);
		}

		if (!permissionGranted) {
			return true;
		}

		await ctx.conversation.enter(route.conversation);
		return true;
	}

	logger.debug("intent-miss", {
		userId,
		text: messageText,
		intent: classification.intent,
		confidence: classification.confidence,
	});
	await ctx.reply(`${t("help_prompt_hint", lang)}\n\n${t("help_examples", lang)}`);
	return false;
}

