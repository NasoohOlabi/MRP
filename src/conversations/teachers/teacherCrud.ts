import { TeacherRepo } from '../../model/Teacher';
import type { ButtonStep } from '../../types';
import { createTreeConversation } from '../baseConversation';
import { createStep } from './flows/create';
import { deleteStep } from './flows/delete';
import { updateStep } from './flows/update';

export const teacherCrudConversation = (repo: TeacherRepo) => createTreeConversation<string | null>({
	entry: {
		type: 'button',
		prompt: "What operation would you like to perform?",
		options: [
			createStep(repo),
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
	} as ButtonStep,
	onSuccess: async (results) => {
		const op = results["What operation would you like to perform?"];
		if (op === "create") {
			const newTeacherData = {
				first_name: results["Enter first name:"],
				last_name: results["Enter last name:"],
				phone_number: results["Enter phone number:"],
				group: results["Enter group:"],
			};
			const response = await repo.create(newTeacherData);
			return JSON.stringify(response);
		} else if (op === "delete") {
			return JSON.stringify(op);
		} else {
			return null;
		}
	},
	successMessage: "Operation completed successfully.",
	failureMessage: "Something went wrong during the operation.",
});
