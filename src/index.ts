import {
	conversations,
	createConversation
} from '@grammyjs/conversations';
import dotenv from 'dotenv';
import { Bot, session } from 'grammy';
import { sendGreeting } from './utils/greeting.js';
import { createBrowseConversation } from './conversations/browse/browseConversation.js';
import { studentCrudConversation } from './conversations/students/studentCrud.js';
import { teacherCrudConversation } from './conversations/teachers/teacherCrud.js';
import { memorizationConversation } from './conversations/memorization/memorizationConversation.js';
import { StudentRepo, TeacherRepo, MemorizationRepo } from './model/drizzle/repos.js';

import type { MyContext, MySession } from './types.js';

const env = dotenv.config().parsed! as {
	BOT_TOKEN: string,
	LOG_LEVEL: string,
};


// Remove SheetDB client wiring; use drizzle-backed repos
const studentRepo = new StudentRepo();
const teacherRepo = new TeacherRepo();
const memorizationRepo = new MemorizationRepo();


const bot = new Bot<MyContext>(process.env.BOT_TOKEN!);

// --- middlewares ---
bot.use(session({ initial: (): MySession => ({ state: 'START', language: 'en' }) }));
bot.use(conversations());


// Register it with a name
bot.use(createConversation(studentCrudConversation(studentRepo), 'createStudentConversation'));
bot.use(createConversation(teacherCrudConversation(teacherRepo), 'createTeacherConversation'));
bot.use(createConversation(createBrowseConversation(studentRepo, teacherRepo, true), 'browseStudentsConversation'));
bot.use(createConversation(memorizationConversation(studentRepo, memorizationRepo), 'createMemorizationConversation'));

// --- commands & handlers ---
bot.command('start', async (ctx) => {
	await sendGreeting(ctx);
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
bot.command('memorize', async (ctx) => {
	await ctx.conversation.enter('createMemorizationConversation');
})

bot.on('message:text', async (ctx) => {
	if (ctx.session.state === 'START') {
		if (ctx.message.text === '/student') {
			// conversation.enter is now typed properly
			await ctx.conversation.enter('createStudentConversation');
		} else if (ctx.message.text === '/teacher') {
			// conversation.enter is now typed properly
			await ctx.conversation.enter('createTeacherConversation');
		} else if (ctx.message.text === '/browse') {
			// conversation.enter is now typed properly
			await ctx.conversation.enter('browseStudentsConversation');
		} else if (ctx.message.text === '/memorize') {
			await ctx.conversation.enter('createMemorizationConversation');
		} else {
			await ctx.reply(
				"Sorry, I didn’t understand. Please use one of the following commands:\n" +
				"• /student – to interact with student records\n" +
				"• /teacher – to interact with teacher records\n" +
				"• /browse – to browse records\n" +
				"• /memorize – to record student memorization"
			);
		}
	}
});


bot.catch(console.error);
bot.start();



