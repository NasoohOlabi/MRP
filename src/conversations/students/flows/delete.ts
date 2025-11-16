import type { StudentRepo } from "../../../model/drizzle/repos"
import type { ButtonStep, Step } from "../../../types"


export const deleteStep: (repo: StudentRepo) => ButtonStep['options'][number] = (repo: StudentRepo) => ({
	text: "Delete",
	data: "delete",
	next: {
		type: 'text',
		prompt: "Which student to delete:",
		validate: (t) => !!t?.trim(),
		error: "Student is required.",
		next: async (response: string): Promise<Step | null> => {
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
					const response = await repo.delete(student);
					console.log(`Deleted Student ${JSON.stringify(response, null, 2)}`, response)
					return null
				},
			}
		},
	},
})