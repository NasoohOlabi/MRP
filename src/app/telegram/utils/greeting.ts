// Greeting utilities
import type { MyContext } from '../../../types.js';
import { t, getLang } from '../../../infrastructure/i18n/index.js';

export async function sendGreeting(ctx: MyContext): Promise<void> {
	await ctx.reply(t('greeting', getLang(ctx.session)));
	ctx.session.state = 'START';
}

export async function deleteCallbackMessage(btnCtx?: MyContext): Promise<void> {
	const m = btnCtx?.callbackQuery?.message;
	if (!m) return;
	await btnCtx!.api.deleteMessage(m.chat.id, m.message_id);
}

export async function cancelAndGreet(ctx: MyContext, btnCtx?: MyContext, summaryText?: string): Promise<void> {
	try {
		await deleteCallbackMessage(btnCtx);
	} catch {
		// Ignore errors
	}
	try {
		const lang = getLang(ctx.session);
		await ctx.reply(t(summaryText || 'operation_cancelled', lang));
		await sendGreeting(ctx);
	} catch (err) {
		// If sending messages fails, try to at least send greeting
		try {
			await sendGreeting(ctx);
		} catch {
			// If even greeting fails, rethrow the original error
			throw err;
		}
	}
}

