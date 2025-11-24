import type { TeacherRepo } from "../../../model/drizzle/repos";
import type { ButtonStep, Step, TextStep, AnswerKey } from "../../../types";



export const deleteStep: (repo: TeacherRepo) => ButtonStep['options'][number] = (repo: TeacherRepo) => ({
	text: "Dismiss",
	data: "delete",
	next: {
		type: 'text',
		key: 'which_teacher_to_dismiss' as AnswerKey,
		prompt: "Which teacher to dismiss:",
		validate: async (text) => !!text?.trim() && (await repo.lookFor(text)).length > 0,
		error: "Teacher name is required.",
		next: async (response: string): Promise<Step | null> => {
			const results = await repo.lookFor(response);
			return {
				type: 'text',
				key: 'select_teacher_number' as AnswerKey,
				prompt: "Tap on the teacher number:\n\n" + results.map((s, idx) => `/${idx} - ${s.item.first_name} ${s.item.last_name}`).join('\n'),
				validate: (text) => !!text && text.trim().startsWith('/') && !isNaN(+text.trim().slice(1)) && +text.trim().slice(1) < results.length,
				error: `Tap on one of the numbers between /0 and /${results.length - 1}.`,
				next: async (iStr) => {
					const i = Number(iStr.slice(1));
					const teacher = results[i].item;
					const response = await repo.delete(teacher);
					console.log(`Deleted Teacher ${JSON.stringify(response, null, 2)}`, response);
					return null;
				},
			};
		},
	},
})