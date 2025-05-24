import {
	conversations,
	createConversation
} from '@grammyjs/conversations';
import dotenv from 'dotenv';
import { Bot, session } from 'grammy';
import { studentCrudConversation } from './conversations/students/studentCrud.js';
import { teacherCrudConversation } from './conversations/teachers/teacherCrud.js';
import { StudentRepo } from './model/Student.js';
import { TeacherRepo } from './model/Teacher.js';
import { getSheetDBClient } from './sheetdb/sheetdb.js';
import type { MyContext, MySession } from './types.js';

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
const teacherRepo = new TeacherRepo(sheetdb);


const bot = new Bot<MyContext>(process.env.BOT_TOKEN!);

// --- middlewares ---
bot.use(session({ initial: (): MySession => ({ state: 'START' }) }));
bot.use(conversations());


// Register it with a name
bot.use(createConversation(studentCrudConversation(studentRepo), 'createStudentConversation'));

bot.use(createConversation(teacherCrudConversation(teacherRepo), 'createTeacherConversation'));

// --- commands & handlers ---
bot.command('start', async (ctx) => {
	await ctx.reply('Welcome! /students or /teachers?');
	ctx.session.state = 'START';
});

bot.on('message:text', async (ctx) => {
	if (ctx.session.state === 'START') {
		if (ctx.message.text.includes('student')) {
			// conversation.enter is now typed properly
			await ctx.conversation.enter('createStudentConversation');
		} else if (ctx.message.text.includes('teacher')) {
			// conversation.enter is now typed properly
			await ctx.conversation.enter('createTeacherConversation');
		} else {
			await ctx.reply("Sorry, I didn't understand.");
		}
	}
});

bot.catch(console.error);
bot.start();



