import { StudentRepo } from '../../model/drizzle/repos';
import type { AnswerKey } from '../../types';
import { createTreeConversation } from '../baseConversation';
import { createStep } from './flows/create';
import { deleteStep } from './flows/delete';
import { updateStep } from './flows/update';

export const studentCrudConversation = (repo: StudentRepo) => createTreeConversation({
	entry: {
		type: 'button',
		key: 'student_crud_entry' as AnswerKey,
		prompt: "what_operation",
		options: [
			createStep,
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
				return;
			} else {
				await res.editMessageText(`you_selected ${data.toUpperCase()}`);
			}
		},
	},
	onSuccess: async (results) => {
		const op = results["what_operation"];
		if (op === "create") {
			const phone = results["enter_phone"]?.trim() || null;
			const fatherPhone = results["enter_father_phone"]?.trim() || null;
			const motherPhone = results["enter_mother_phone"]?.trim() || null;

			return repo.create({
				first_name: results["enter_first_name"],
				last_name: results["enter_last_name"],
				birth_year: parseInt(results["enter_birth_year"]),
				group: results["enter_group"],
				phone: phone,
				father_phone: fatherPhone,
				mother_phone: motherPhone,
			});
		} else if (op === "delete") {
			// return repo.delete(results["Enter student ID to delete:"]);
			return JSON.stringify(op);
		} else {
			// log the results to the logs folder

		}
	},
	successMessage: "operation_completed",
	failureMessage: "operation_failed",
});


