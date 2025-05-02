// File: ./conversations.ts (or similar)

import type { Conversation, ConversationFlavor } from '@grammyjs/conversations';
import type { SessionFlavor } from 'grammy';
import type { Bot, Context } from 'grammy';

// Assuming your repo and types are in ./repo.ts
import { StudentRepo, Student } from '../../model/Student';

// Assuming your base context types are defined as in your example
type MySession = { state?: string };
type BaseContext = Context & SessionFlavor<MySession>;
type MyContext = BaseContext & ConversationFlavor<BaseContext>;


/**
 * Factory function that creates the conversation for creating a Student.
 * It takes the StudentRepo instance as a dependency.
 */
export function createStudentConversationFactory(repo: StudentRepo) {
	// This is the actual conversation function that will be registered
	return async (conv: Conversation<BaseContext, MyContext>, ctx: MyContext) => {
		try {
			await ctx.reply("Okay, let's create a new student entry.");

			// --- Prompt for First Name ---
			await ctx.reply("What is the student's first name?");
			const firstNameMsg = await conv.wait();
			const first_name = firstNameMsg.message?.text;
			if (!first_name || first_name.trim() === "") {
				await ctx.reply("Invalid input. Please provide a valid first name.");
				return; // Exit the conversation
			}

			// --- Prompt for Last Name ---
			await ctx.reply("What is the student's last name?");
			const lastNameMsg = await conv.wait();
			const last_name = lastNameMsg.message?.text;
			if (!last_name || last_name.trim() === "") {
				await ctx.reply("Invalid input. Please provide a valid last name.");
				return; // Exit the conversation
			}

			// --- Prompt for Birth Date ---
			// We'll ask for a specific format (YYYY-MM-DD)
			await ctx.reply("What is the student's birth date? (Please use YYYY-MM-DD format)");
			const birthDateMsg = await conv.wait();
			const birth_date_str = birthDateMsg.message?.text;

			// Basic validation for YYYY-MM-DD format
			const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
			if (!birth_date_str || !dateRegex.test(birth_date_str)) {
				await ctx.reply("Invalid date format. Please try again using YYYY-MM-DD.");
				return; // Exit the conversation
			}
			// Note: More robust date validation (e.g., valid month/day) could be added here if needed.


			await ctx.reply("Creating student...");


			// This prevents the bot from freezing while waiting for the SheetDB response.
			await conv.external(() => repo.create({
				first_name: first_name.trim(),
				last_name: last_name.trim(),
				birth_date: birth_date_str,
				group: 'gg'
			}));

			await ctx.reply("Student successfully created!");

		} catch (error) {
			console.error("Error during student creation conversation:", error);
			await ctx.reply("An error occurred while creating the student. Please try again later.");
		}
	};
}