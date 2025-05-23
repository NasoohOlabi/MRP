import { Student, StudentRepo } from '../../model/Student';
import type { Step } from '../../types';


export const studentSelectionNode = (repo: StudentRepo, callback: ((student: Student) => Step | null)) => (async (response: string): Promise<Step | null> => {
	const results = await repo.lookFor(response)
	console.log(`results for ${response}`, results)
	return {
		type: 'text',
		prompt: "Tap on the student number:\n\n" + results.map((s, idx) => `/${idx} - ${s.item.first_name} ${s.item.last_name}`).join('\n'),
		validate: (t) => !!t && t.trim().startsWith('/') && !isNaN(+t.trim().slice(1)),
		error: "tap on one of the numbers.",
		next: async (iStr) => {
			const i = Number(iStr.slice(1))
			const student = results[i].item
			return callback(student)
		},
	}
})