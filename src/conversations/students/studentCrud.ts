import { StudentRepo } from '../../model/drizzle/repos';
import { createTreeConversation } from '../baseConversation';
import { createStep } from './flows/create';
import { deleteStep } from './flows/delete';
import { updateStep } from './flows/update';

export const studentCrudConversation = (repo: StudentRepo) => createTreeConversation({
	entry: {
		type: 'button',
		prompt: "What operation would you like to perform?",
		options: [
			createStep,
			updateStep(repo),
			deleteStep(repo),
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
				group: results["Enter group:"],
			});
		} else if (op === "delete") {
			// return repo.delete(results["Enter student ID to delete:"]);
			return JSON.stringify(op);
		} else {
			// log the results to the logs folder

		}
	},
	successMessage: "Operation completed successfully.",
	failureMessage: "Something went wrong during the operation.",
});


