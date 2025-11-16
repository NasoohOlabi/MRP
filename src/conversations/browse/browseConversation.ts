import type { Conversation } from '@grammyjs/conversations';
import { InlineKeyboard } from 'grammy';
import { Student, StudentRepo } from '../../model/drizzle/repos';
import { TeacherRepo } from '../../model/drizzle/repos';
import type { BaseContext, MyContext } from '../../types';

const PAGE_SIZE = 2;

export const createBrowseConversation = (studentRepo: StudentRepo, teacherRepo: TeacherRepo, isTeacher: boolean) => async (conv: Conversation<BaseContext, MyContext>, ctx: MyContext) => {
	// send button message with the text `What do you want to browse?` and two buttons `Students` and `Teachers` and `Cancel`
	const keyboard = new InlineKeyboard();
	keyboard.text('Students', 'students').text('Teachers', 'teachers').text('Cancel', 'cancel');

	await ctx.reply(`What do you want to browse?`, { reply_markup: keyboard });

	let btnResponse = await conv.wait();
	const clickedBtnData = btnResponse.callbackQuery?.data;

	if (!clickedBtnData) {
		await btnResponse.reply("Please select an option.");
		return;
	}

	if (clickedBtnData === 'cancel') {
		await btnResponse.reply("Cancelled.");
		return;
	}


	const list = clickedBtnData === 'students' ? await studentRepo.read() : await teacherRepo.read();
	// edit the button message with the text `Students\n ${list of 5 students}` with a button to view next 5 students
	let command = null;
	let page = 0;
	do {
		const keyboard = new InlineKeyboard();
		if (page === 0) {
			keyboard.text('Cancel', 'cancel').text('Next', 'next');
		} else if (page < Math.ceil(list.length / PAGE_SIZE) - 1) {
			keyboard
				.text('Previous', 'previous')
				.text('Cancel', 'cancel')
				.text('Next', 'next');
		} else {
			keyboard.text('Previous', 'previous').text('Cancel', 'cancel');
		}
		// sort by group alphabetically then by last name alphabetically and then by first name alphabetically
		list.sort((a, b) => {
			if (a.group < b.group) return -1;
			if (a.group > b.group) return 1;
			if (a.last_name < b.last_name) return -1;
			if (a.last_name > b.last_name) return 1;
			if (a.first_name < b.first_name) return -1;
			if (a.first_name > b.first_name) return 1;
			return 0;
		})
		const listView = list.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
			.map((s) => `${s.group} / ${s.first_name} ${s.last_name}` + (clickedBtnData === 'students' ? ` (${(s as Student).birth_date})` : '')).join('\n');
		await btnResponse.editMessageText((clickedBtnData === 'students' ? 'Students' : 'Teachers') + `\n ${listView}`, { reply_markup: keyboard });
		btnResponse = await conv.wait();
		command = await btnResponse.callbackQuery?.data;
		if (!command) {
			await btnResponse.editMessageText("Please select an option.");
			return;
		}
		if (command === 'cancel') {
			await btnResponse.editMessageText("Cancelled.");
			return;
		}
		if (command === 'next') {
			page++;
		} else if (command === 'previous') {
			page--;
		}

	} while (command);




};
