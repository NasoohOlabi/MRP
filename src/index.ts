// import Fuse from "fuse.js";

// const f = new Fuse([
// 	{
// 		id: "0",
// 		first_name: "mike",
// 		last_name: "bens",
// 		group: "gg",
// 		birth_date: "2001-05-30",
// 		created_at: "2025-05-02T07:58:22.380Z",
// 		updated_at: "2025-05-02T07:58:22.381Z",
// 	}, {
// 		id: "0",
// 		first_name: "mike 2",
// 		last_name: "benz",
// 		group: "gg",
// 		birth_date: "2000-52-55",
// 		created_at: "2025-05-02T08:00:20.937Z",
// 		updated_at: "2025-05-02T08:00:20.937Z",
// 	}, {
// 		id: "1746189638398",
// 		first_name: "John",
// 		last_name: "Doe",
// 		group: "gg",
// 		birth_date: "2003-03-10",
// 		created_at: "2025-05-02T12:40:38.398Z",
// 		updated_at: "2025-05-02T12:40:38.398Z",
// 	}, {
// 		id: "4452722",
// 		first_name: "m",
// 		last_name: "n",
// 		group: "gg",
// 		birth_date: "2000-10-10",
// 		created_at: "2025-05-02T13:54:51.120Z",
// 		updated_at: "2025-05-02T13:54:51.120Z",
// 	}
// ], { keys: ['first_name', 'last_name', 'group'] })

// console.log(f.search('doe'))

import {
	Conversation,
	conversations,
	createConversation,
} from '@grammyjs/conversations';
import dotenv from 'dotenv';
import { Bot, session } from 'grammy';
import { studentCrudConversation } from './conversations/students/create';
import { StudentRepo } from './model/Student.js';
import { getSheetDBClient } from './sheetdb/sheetdb.js';
import type { BaseContext, MyContext, MySession } from './types.js';

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
const studentRepo = new StudentRepo(sheetdb);


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

const studentCreationConversation = studentCrudConversation(studentRepo)

// Register it with a name
bot.use(createConversation(studentCreationConversation, 'createStudentConversation'));

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
		} else if (ctx.message.text === 'Student') {
			// conversation.enter is now typed properly
			await ctx.conversation.enter('createStudentConversation');
		} else if (ctx.message.text === 'Support') {
			await ctx.reply('Support flow coming soon.');
		} else {
			await ctx.reply("Sorry, I didn't understand.");
		}
	}
});

bot.catch(console.error);
bot.start();



