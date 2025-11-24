import { AttendanceRepo, MemorizationRepo, StudentRepo } from '../../model/drizzle/repos';
import type { AnswerKey } from '../../types';
import { logger } from '../../utils/logger.js';
import { createTreeConversation } from '../baseConversation';
import { createStep } from './flows/create';
import { deleteStep } from './flows/delete';
import { updateStep } from './flows/update';

export const studentCrudConversation = (repo: StudentRepo, memorizationRepo: MemorizationRepo, attendanceRepo: AttendanceRepo) => createTreeConversation({
	entry: {
		type: 'button',
		key: 'what_operation' as AnswerKey,
		prompt: "what_operation",
		options: [
			createStep,
			updateStep(repo),
			deleteStep(repo),
			{
				text: "view_info",
				data: "view_info",
				next: null,
			},
			{
				text: "cancel",
				data: "cancel",
				next: null,
			},
		],
		onSelect: async (data, ctx, res) => {
			// Note: cancel is handled by baseConversation before onSelect is called
			// Message is deleted automatically by baseConversation, no need to edit
			if (data === "view_info") {
				logger.info('studentCrudConversation: view_info button selected', {
					userId: ctx.from?.id,
					chatId: ctx.chat?.id
				});
				// Store a flag to exit and enter view conversation in onSuccess
				// We'll handle the transition there
				return;
			}
		},
	},
	onSuccess: async (results) => {
		logger.info('studentCrudConversation onSuccess called', {
			operation: results["what_operation"],
			resultsKeys: Object.keys(results),
			resultsData: results
		});
		const op = results["what_operation"];
		if (op === "view_info") {
			logger.info('studentCrudConversation: Detected view_info operation, transitioning to viewStudentInfoConversation', {
				resultsKeys: Object.keys(results),
				resultsData: results
			});
			// Return special object to trigger exit and enter view conversation
			return { exitAndEnter: 'viewStudentInfoConversation' };
		}
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


