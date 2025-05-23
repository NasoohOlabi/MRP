import { Student, StudentRepo } from '../../../model/Student';
import type { ButtonStep, TextStep } from "../../../types";
import { studentSelectionNode } from '../studentSelectionNode';


export const updateStep: (repo: StudentRepo) => ButtonStep['options'][number] = (repo: StudentRepo) => ({
	text: "Update",
	data: "update",
	next: {
		type: 'text',
		prompt: "Which student to update:",
		validate: (t) => !!t?.trim(),
		error: "Student is required.",
		next: studentSelectionNode(repo, (student: Student) => {
			const op = ({ label, value }: { label: string, value: 'first_name' | 'last_name' | 'group' | 'birth_date' | 'cancel' }): TextStep => ({
				type: 'text',
				prompt: `Please enter the new ${label}:`,
				error: `${label} is required.`,
				validate: t => !!t?.trim(),
				next: value === 'cancel' ? () => null : async (newName: string) => {
					student[value] = newName;
					const response = await repo.update(student)
					console.log(`Updated ${value} in ${JSON.stringify(response, null, 2)}`, response)
					return null
				}
			})
			return {
				type: 'button',
				prompt: `Do you want to update the info of \n\n ${student.first_name} ${student.last_name} \n\n ${student.birth_date} \n\n ${student.group}`,
				options: ([
					{ label: 'First Name', value: 'first_name' },
					{ label: 'Last Name', value: 'last_name' },
					{ label: 'Group', value: 'group' },
					{ label: 'Birth Date', value: 'birth_date' },
					{ label: 'Cancel', value: 'cancel' }
				] as const).map(x => ({
					text: x.label,
					data: x.value,
					next: op(x)
				})),
				onSelect: async (data, ctx, res) => {
					if (data === 'cancel') {
						await res.editMessageText("Operation cancelled.");
						throw new Error("User cancelled operation.");
					} else {
						await res.editMessageText(`You selected ${data.toUpperCase()}`);
					}
				},
			}

		}),
	},
})