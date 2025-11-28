import type { Conversation } from "@grammyjs/conversations";
import { InlineKeyboard } from "grammy";
import type { BaseContext, MyContext } from "../../../types.js";
import { getCurrentUser } from "../../../features/auth/model.js";
import { t } from "../../../utils/i18n.js";
import { createStudentConversation } from "./flows/createStudent.js";
import { deleteStudentConversation } from "./flows/deleteStudent.js";
import { updateStudentConversation } from "./flows/updateStudent.js";
import { viewStudentConversation } from "./flows/viewStudent.js";
import { getLang } from "./helpers.js";

export async function studentMenuConversation(
	conversation: Conversation<BaseContext, MyContext>,
	ctx: MyContext
) {
	if (!ctx.session) {
		ctx.session = { state: "START", language: "en" };
	}
	const lang = getLang(ctx);

	const user = await getCurrentUser(ctx);
	const isTeacherOnly = user?.role === "teacher";

	const keyboard = new InlineKeyboard();

	if (!isTeacherOnly) {
		keyboard
			.text(t("create", lang), "create")
			.row()
			.text(t("update", lang), "update")
			.row()
			.text(t("delete", lang), "delete")
			.row()
			.text(t("view_info", lang), "view_info")
			.row()
			.text(t("cancel", lang), "cancel");
	} else {
		keyboard
			.text(t("view_info", lang), "view_info")
			.row()
			.text(t("cancel", lang), "cancel");
	}

	await ctx.reply(t("what_operation", lang), { reply_markup: keyboard });

	const btnCtx = await conversation.wait();
	const action = btnCtx.callbackQuery?.data;

	if (!action) {
		await ctx.reply(t("operation_failed", lang));
		return;
	}

	await btnCtx.answerCallbackQuery();

	if (btnCtx.callbackQuery?.message) {
		try {
			await ctx.api.deleteMessage(
				btnCtx.callbackQuery.message.chat.id,
				btnCtx.callbackQuery.message.message_id
			);
		} catch (err) {
			// Ignore deletion errors
		}
	}

	if (action === "cancel") {
		await ctx.reply(t("operation_cancelled", lang));
		return;
	}

	if (isTeacherOnly && action !== "view_info") {
		await ctx.reply(t("permission_denied_operation", lang));
		return;
	}

	if (action === "create") {
		await createStudentConversation(conversation, ctx);
	} else if (action === "update") {
		await updateStudentConversation(conversation, ctx);
	} else if (action === "delete") {
		await deleteStudentConversation(conversation, ctx);
	} else if (action === "view_info") {
		await viewStudentConversation(conversation, ctx);
	}
}

