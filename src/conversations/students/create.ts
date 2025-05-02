import { StudentRepo } from '../../model/Student';
import { createTreeConversation } from '../base';

export const studentController = (repo: StudentRepo) => createTreeConversation({
	entry: {
		type: 'button',
		prompt: "Choose an option:",
		options: [
			{
				text: "Start",
				data: "start",
				next: {
					type: 'text',
					prompt: "First name?",
					validate: (t) => !!t?.trim(),
					error: "First name is required.",
					next: (first) => ({
						type: 'text',
						prompt: "Last name?",
						validate: (t) => !!t?.trim(),
						error: "Last name is required.",
						next: (last) => ({
							type: 'text',
							prompt: "Birth date? (YYYY-MM-DD)",
							validate: (t) => /^\d{4}-\d{2}-\d{2}$/.test(t ?? ""),
							error: "Invalid date format.",
							next: () => null, // end
						}),
					}),
				},
			},
			{
				text: "Cancel",
				data: "cancel",
				next: null,
			},
		],
		onSelect: async (data, ctx) => {
			if (data === 'cancel') {
				await ctx.editMessageText("Operation cancelled.");
				throw new Error("Cancelled by user");
			}
		},
	},
	onSuccess: (results) =>
		repo.create({
			first_name: results["First name?"],
			last_name: results["Last name?"],
			birth_date: results["Birth date? (YYYY-MM-DD)"],
			group: "gg",
		}),
	successMessage: "Student created successfully!",
	failureMessage: "Failed to create student.",
});
