// load .env file
import dotenv from 'dotenv';
import { getSheetDBClient } from './sheetdb/sheetdb.js';

const env = dotenv.config().parsed! as {
	BOT_TOKEN: string,
	GOOGLE_SHEET_ID: string,
	LOG_LEVEL: string,
	SHEET_DB: string,
	SHEET_DB_TOKEN: string,
};

// Example of using the modernized SheetDB client
const sheetdb = getSheetDBClient({
	address: env.SHEET_DB,
	version: '1',
	token: env.SHEET_DB_TOKEN
});


import type {
	ConversationFlavor,
} from '@grammyjs/conversations';
import {
	Conversation,
	conversations,
	createConversation,
} from '@grammyjs/conversations';
import type { SessionFlavor } from 'grammy';
import { Bot, Context, session } from 'grammy';

type MySession = { state?: string };

// 1) BaseContext knows about `session` but not yet conversations
type BaseContext = Context & SessionFlavor<MySession>;

// 2) MyContext adds the conversation flavor *on top* of BaseContext
type MyContext = BaseContext & ConversationFlavor<BaseContext>;

const bot = new Bot<MyContext>(process.env.BOT_TOKEN!);

// --- middlewares ---
bot.use(session({ initial: (): MySession => ({ state: 'START' }) }));
bot.use(conversations());

// --- your conversation ---
async function orderConversation(
	conv: Conversation<BaseContext, MyContext>,
	ctx: MyContext
) {
	await ctx.reply('What would you like to order?');
	const { message } = await conv.wait();
	await ctx.reply(`You ordered: ${message!.text}`);
}

// register it
bot.use(createConversation(orderConversation));

// --- commands & handlers ---
bot.command('start', async (ctx) => {
	await ctx.reply('Welcome! Order or Support?');
	ctx.session.state = 'START';
});

bot.on('message:text', async (ctx) => {
	if (ctx.session.state === 'START') {
		if (ctx.message.text === 'Order') {
			// conversation.enter is now typed properly
			await ctx.conversation.enter('orderConversation');
		} else if (ctx.message.text === 'Support') {
			await ctx.reply('Support flow coming soon.');
		} else {
			await ctx.reply("Sorry, I didn't understand.");
		}
	}
});

bot.catch(console.error);
bot.start();
