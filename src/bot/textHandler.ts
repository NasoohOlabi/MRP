import type { Bot } from "grammy";
import type { MyContext } from "../types.js";
import type { User } from "../features/users/model.js";
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
import { getLang } from "./helpers.js";
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

const MAX_HISTORY_LENGTH = 20;

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
		const chatId = ctx.chat?.id;
		const rawMessage = ctx.message.text ?? "";
		const messageText = rawMessage.trim();
		const lang = getLang(ctx) as "en" | "ar";

		if (!chatId || !messageText || messageText.startsWith("/")) {
			return;
		}

		if (!ctx.from?.id) {
			return;
		}

		let currentUser: User | null = null;
		const respondWithFallback = (reason: LlmFallbackReason, error?: unknown) =>
			respondWithLLMFallback(ctx, {
				messageText,
				lang,
				user: currentUser,
				reason,
				error,
			});

		try {
			currentUser = await getCurrentUser(ctx);

			if (isHelpQuestion(messageText)) {
				const helpOptions: { isAdmin?: boolean; state?: string } = {
					isAdmin: currentUser?.role === "admin",
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

			const handled = await tryHandleIntent(ctx, messageText, lang);
			if (handled) {
				return;
			}

			await respondWithFallback("unhandled_message");
		} catch (error) {
			logger.error("text-handler-error", {
				userId: ctx.from?.id,
				chatId,
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
			});
			await respondWithFallback("handler_error", error);
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
	const language = lang;
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

