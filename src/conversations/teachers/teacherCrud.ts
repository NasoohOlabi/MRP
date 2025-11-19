import { TeacherRepo } from '../../model/drizzle/repos';
import type { ButtonStep } from '../../types';
import { createTreeConversation } from '../baseConversation';
import { createStep } from './flows/create';
import { deleteStep } from './flows/delete';
import { updateStep } from './flows/update';

export const teacherCrudConversation = (repo: TeacherRepo) => createTreeConversation<string | null>({
	entry: {
		type: 'button',
		prompt: "what_operation",
		options: [
			createStep(repo),
			updateStep(repo),
			deleteStep(repo),
			{
				text: "cancel",
				data: "cancel",
				next: null,
			},
		],
		onSelect: async (data, ctx, res) => {
			if (data === 'cancel') {
				await res.editMessageText("operation_cancelled");
				throw new Error("User cancelled operation.");
			} else {
				await res.editMessageText(`you_selected ${data.toUpperCase()}`);
			}
		},
	} as ButtonStep,
	onSuccess: async (results) => {
		const op = results["what_operation"];
		if (op === "create") {
			const newTeacherData = {
				first_name: results["enter_first_name"],
				last_name: results["enter_last_name"],
				phone_number: results["enter_phone"],
				group: results["enter_group"],
			};
			const response = await repo.create(newTeacherData);
			return JSON.stringify(response);
		} else if (op === "delete") {
			return JSON.stringify(op);
		} else {
			return null;
		}
	},
	successMessage: "operation_completed",
	failureMessage: "operation_failed",
});
