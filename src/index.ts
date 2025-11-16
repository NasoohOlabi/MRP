import {
	conversations,
	createConversation
} from '@grammyjs/conversations';
import dotenv from 'dotenv';
import { Bot, session } from 'grammy';
import { createBrowseConversation } from './conversations/browse/browseConversation.js';
import { studentCrudConversation } from './conversations/students/studentCrud.js';
import { teacherCrudConversation } from './conversations/teachers/teacherCrud.js';
import { StudentRepo, TeacherRepo } from './model/drizzle/repos.js';

import type { MyContext, MySession } from './types.js';

const env = dotenv.config().parsed! as {
	BOT_TOKEN: string,
	LOG_LEVEL: string,
};


// Remove SheetDB client wiring; use drizzle-backed repos
const studentRepo = new StudentRepo();
const teacherRepo = new TeacherRepo();


const bot = new Bot<MyContext>(process.env.BOT_TOKEN!);

// --- middlewares ---
bot.use(session({ initial: (): MySession => ({ state: 'START' }) }));
bot.use(conversations());


// Register it with a name
bot.use(createConversation(studentCrudConversation(studentRepo), 'createStudentConversation'));
bot.use(createConversation(teacherCrudConversation(teacherRepo), 'createTeacherConversation'));
bot.use(createConversation(createBrowseConversation(studentRepo, teacherRepo, true), 'browseStudentsConversation'));

// --- commands & handlers ---
bot.command('start', async (ctx) => {
	await ctx.reply('Welcome! /students or /teachers?');
	ctx.session.state = 'START';
});
bot.command('students', async (ctx) => {
	await ctx.conversation.enter('createStudentConversation');
})
bot.command('teachers', async (ctx) => {
	await ctx.conversation.enter('createTeacherConversation');
})
bot.command('browse', async (ctx) => {
	await ctx.conversation.enter('browseStudentsConversation');
})

bot.on('message:text', async (ctx) => {
	if (ctx.session.state === 'START') {
		if (ctx.message.text.includes('student')) {
			// conversation.enter is now typed properly
			await ctx.conversation.enter('createStudentConversation');
		} else if (ctx.message.text.includes('teacher')) {
			// conversation.enter is now typed properly
			await ctx.conversation.enter('createTeacherConversation');
		} else if (ctx.message.text.includes('browse')) {
			// conversation.enter is now typed properly
			await ctx.conversation.enter('browseStudentsConversation');
		} else {
			await ctx.reply("Sorry, I didn't understand.");
		}
	}
});


bot.catch(console.error);
bot.start();



