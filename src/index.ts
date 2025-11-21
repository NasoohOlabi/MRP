import {
	conversations,
	createConversation
} from '@grammyjs/conversations';
import dotenv from 'dotenv';
import { Bot, session } from 'grammy';
import { createAttendanceTakingConversation } from './conversations/attendance/attendanceTaking.js';
import { createBrowseConversation } from './conversations/browse/browseConversation.js';
import { memorizationConversation } from './conversations/memorization/memorizationConversation.js';
import { studentCrudConversation } from './conversations/students/studentCrud.js';
import { createSummaryConversation } from './conversations/summaryConversation.js';
import { teacherCrudConversation } from './conversations/teachers/teacherCrud.js';
import { AttendanceRepo, MemorizationRepo, StudentRepo, TeacherRepo } from './model/drizzle/repos.js';
import { sendGreeting } from './utils/greeting.js';

import type { MyContext, MySession } from './types.js';

const env = dotenv.config().parsed! as {
	BOT_TOKEN: string,
	LOG_LEVEL: string,
};


// Remove SheetDB client wiring; use drizzle-backed repos
const studentRepo = new StudentRepo();
const teacherRepo = new TeacherRepo();
const memorizationRepo = new MemorizationRepo();
const attendanceRepo = new AttendanceRepo();


const bot = new Bot<MyContext>(process.env.BOT_TOKEN!);

// --- middlewares ---
bot.use(session({ initial: (): MySession => ({ state: 'START', language: 'en' }) }));
bot.use(conversations());


// Register it with a name
bot.use(createConversation(studentCrudConversation(studentRepo), 'createStudentConversation'));
bot.use(createConversation(teacherCrudConversation(teacherRepo), 'createTeacherConversation'));
bot.use(createConversation(createBrowseConversation(studentRepo, teacherRepo, true), 'browseStudentsConversation'));
bot.use(createConversation(memorizationConversation(studentRepo, memorizationRepo), 'createMemorizationConversation'));
bot.use(createConversation(createAttendanceTakingConversation(attendanceRepo, studentRepo), 'attendanceTakingConversation'));
bot.use(createConversation(createSummaryConversation(attendanceRepo, studentRepo, memorizationRepo), 'summaryConversation'));

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
bot.command('attendance', async (ctx) => {
	await ctx.conversation.enter('attendanceTakingConversation');
})
bot.command('summary', async (ctx) => {
	await ctx.conversation.enter('summaryConversation');
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
		} else if (ctx.message.text === '/attendance') {
			await ctx.conversation.enter('attendanceTakingConversation');
		} else if (ctx.message.text === '/summary') {
			await ctx.conversation.enter('summaryConversation');
		} else {
			await ctx.reply(
				"Sorry, I didn't understand. Please use one of the following commands:\n" +
				"• /student – to interact with student records\n" +
				"• /teacher – to interact with teacher records\n" +
				"• /browse – to browse records\n" +
				"• /memorize – to record student memorization\n" +
				"• /attendance – to take attendance\n" +
				"• /summary – to view attendance and memorization summaries"
			);
		}
	}
});


bot.catch(console.error);
bot.start();



