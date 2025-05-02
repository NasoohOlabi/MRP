import type { Conversation } from '@grammyjs/conversations';
import { InlineKeyboard } from 'grammy';
import type { BaseContext, MyContext, Step, TreeConversationOptions } from '../types';


export function createTreeConversation<T>({
	entry,
	onSuccess,
	successMessage,
	failureMessage,
}: TreeConversationOptions<T>) {
	return async (conv: Conversation<BaseContext, MyContext>, ctx: MyContext) => {
		const results: Record<string, string> = {};
		try {
			let step: Step | null = entry;

			while (step) {
				if (step.type === 'text') {
					await ctx.reply(step.prompt);
					const res = await conv.wait();
					const text = res.message?.text;
					if (!step.validate(text)) {
						await ctx.reply(step.error);
						return;
					}

					const value = text!.trim();
					results[step.prompt] = value;
					step = await step.next(value);
				} else if (step.type === 'button') {
					const keyboard = new InlineKeyboard();
					for (const opt of step.options) {
						opt.url
							? keyboard.url(opt.text, opt.url)
							: keyboard.text(opt.text, opt.data);
					}

					await ctx.reply(step.prompt, { reply_markup: keyboard });
					const btnResponse = await conv.wait();
					const data = btnResponse.callbackQuery?.data;

					if (!data) {
						await btnResponse.reply("Please select an option.");
						return;
					}

					await btnResponse.answerCallbackQuery({ text: `You selected ${data}` });

					if (step.onSelect) await step.onSelect(data, ctx, btnResponse);

					results[step.prompt] = data;

					const selected: {
						text: string;
						data: string;
						url?: string | undefined;
						next: Step | null;
					} = step.options.find((o) => o.data === data)!;
					step = selected?.next ?? null;
				}
			}

			await ctx.reply("Processing...");
			await conv.external(() => onSuccess(results));
			await ctx.reply(successMessage);
		} catch (err) {
			console.error("Tree conversation error:", err);
			console.log((err as Error).message)
			console.log((err as Error).stack)
			await ctx.reply(failureMessage);
		}
	};
}
