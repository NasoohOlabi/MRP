import type { Conversation, ConversationFlavor } from '@grammyjs/conversations';
import type { SessionFlavor } from 'grammy';
import { Context, InlineKeyboard } from 'grammy';
import { StudentRepo } from '../../model/Student';

type MySession = { state?: string };
type BaseContext = Context & SessionFlavor<MySession>;
type MyContext = BaseContext & ConversationFlavor<BaseContext>;

export function createStudentConversationFactory(repo: StudentRepo) {
	return async (conv: Conversation<BaseContext, MyContext>, ctx: MyContext) => {
		try {
			const inlineKeyboard = new InlineKeyboard()
				.text("Option A", "button_a_payload")
				.text("Option B", "button_b_payload")
				.row()
				.url("Visit Google", "https://google.com")
				.row()
				.text("Delete This Message", "delete_message");

			await ctx.reply("Choose an option or visit a link:", {
				reply_markup: inlineKeyboard,
			});

			const btnResponse = await conv.wait();

			if (btnResponse.callbackQuery?.data) {
				const data = btnResponse.callbackQuery.data;
				await btnResponse.answerCallbackQuery({
					text: `You chose ${data.replace('_payload', '').replace('_', ' ')}`,
				});

				switch (data) {
					case 'button_a_payload':
						await btnResponse.editMessageText('You selected Option A.');
						break;
					case 'button_b_payload':
						await btnResponse.editMessageText('You selected Option B.');
						break;
					case 'delete_message':
						await btnResponse.deleteMessage();
						return;
					default:
						await btnResponse.reply('Unknown option selected.');
				}
			} else {
				await btnResponse.reply('Please use the buttons.');
				return;
			}

			await ctx.reply("Okay, let's create a new student entry.");

			// --- Prompt for First Name ---
			await ctx.reply("What is the student's first name?");
			const firstNameMsg = await conv.wait();
			const first_name = firstNameMsg.message?.text;
			if (!first_name || first_name.trim() === "") {
				await ctx.reply("Invalid input. Please provide a valid first name.");
				return;
			}

			// --- Prompt for Last Name ---
			await ctx.reply("What is the student's last name?");
			const lastNameMsg = await conv.wait();
			const last_name = lastNameMsg.message?.text;
			if (!last_name || last_name.trim() === "") {
				await ctx.reply("Invalid input. Please provide a valid last name.");
				return;
			}

			// --- Prompt for Birth Date ---
			await ctx.reply("What is the student's birth date? (Please use YYYY-MM-DD format)");
			const birthDateMsg = await conv.wait();
			const birth_date_str = birthDateMsg.message?.text;
			const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
			if (!birth_date_str || !dateRegex.test(birth_date_str)) {
				await ctx.reply("Invalid date format. Please try again using YYYY-MM-DD.");
				return;
			}

			await ctx.reply("Creating student...");

			await conv.external(() =>
				repo.create({
					first_name: first_name.trim(),
					last_name: last_name.trim(),
					birth_date: birth_date_str,
					group: 'gg',
				})
			);

			await ctx.reply("Student successfully created!");
		} catch (error) {
			console.error("Error during student creation conversation:", error);
			await ctx.reply("An error occurred while creating the student. Please try again later.");
		}
	};
}
