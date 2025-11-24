import { TeacherRepo } from '../../model/drizzle/repos';
import type { AnswerKey, ButtonStep } from '../../types';
import { createTreeConversation } from '../baseConversation';
import { createStep } from './flows/create';
import { deleteStep } from './flows/delete';
import { updateStep } from './flows/update';

export const teacherCrudConversation = (repo: TeacherRepo) => createTreeConversation<string | null>({
	entry: {
		type: 'button',
		key: 'what_operation' as AnswerKey,
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
			// Note: cancel is handled by baseConversation before onSelect is called
			// Message is deleted automatically by baseConversation, no need to edit
		},
	} as ButtonStep,
	onSuccess: async (results) => {
		if (!results) {
			return null;
		}
		const op = results["what_operation" as keyof typeof results] as string | undefined;
		if (op === "create") {
			const newTeacherData = {
				first_name: results["enter_first_name" as keyof typeof results] as string,
				last_name: results["enter_last_name" as keyof typeof results] as string,
				phone_number: results["enter_phone" as keyof typeof results] as string,
				group: results["enter_group" as keyof typeof results] as string,
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
