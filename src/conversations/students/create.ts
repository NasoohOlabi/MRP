import { StudentRepo } from '../../model/Student';
import { createTreeConversation } from '../base';

export const studentCrudConversation = (repo: StudentRepo) => createTreeConversation({
	entry: {
		type: 'button',
		prompt: "What operation would you like to perform?",
		options: [
			{
				text: "Create",
				data: "create",
				next: {
					type: 'text',
					prompt: "Enter first name:",
					validate: (t) => !!t?.trim(),
					error: "First name is required.",
					next: (first) => ({
						type: 'text',
						prompt: "Enter last name:",
						validate: (t) => !!t?.trim(),
						error: "Last name is required.",
						next: (last) => ({
							type: 'text',
							prompt: "Enter birth date (YYYY-MM-DD):",
							validate: (t) => /^\d{4}-\d{2}-\d{2}$/.test(t ?? ""),
							error: "Invalid date format.",
							next: () => null,
						}),
					}),
				},
			},
			{
				text: "Update",
				data: "update",
				next: {
					type: 'text',
					prompt: "Enter student ID to update:",
					validate: (t) => !!t?.trim(),
					error: "Student ID is required.",
					next: (id) => ({
						type: 'text',
						prompt: "Enter new last name:",
						validate: (t) => !!t?.trim(),
						error: "Last name is required.",
						next: () => null,
					}),
				},
			},
			{
				text: "Delete",
				data: "delete",
				next: {
					type: 'text',
					prompt: "Enter student ID to delete:",
					validate: (t) => !!t?.trim(),
					error: "Student ID is required.",
					next: () => null,
				},
			},
			{
				text: "Cancel",
				data: "cancel",
				next: null,
			},
		],
		onSelect: async (data, ctx, res) => {
			if (data === 'cancel') {
				await res.editMessageText("Operation cancelled.");
				throw new Error("User cancelled operation.");
			} else {
				await res.editMessageText(`You selected ${data.toUpperCase()}`);
			}
		},
	},
	onSuccess: async (results) => {
		const op = results["What operation would you like to perform?"];
		if (op === "create") {
			return repo.create({
				first_name: results["Enter first name:"],
				last_name: results["Enter last name:"],
				birth_date: results["Enter birth date (YYYY-MM-DD):"],
				group: "gg",
			});
		} else if (op === "update") {
			// return repo.update(results["Enter student ID to update:"], {
			// 	last_name: results["Enter new last name:"],
			// });
			return JSON.stringify(op)
		} else if (op === "delete") {
			// return repo.delete(results["Enter student ID to delete:"]);
			return JSON.stringify(op);
		}
	},
	successMessage: "Operation completed successfully.",
	failureMessage: "Something went wrong during the operation.",
});

