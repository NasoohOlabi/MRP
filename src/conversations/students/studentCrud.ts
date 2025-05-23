import { Student, StudentRepo } from '../../model/Student';
import type { Step, TextStep } from '../../types';
import { createTreeConversation } from '../baseConversation';
import { studentSelectionNode } from './studentSelectionNode';

export const studentCrudConversation = (repo: StudentRepo) => createTreeConversation({
	entry: {
		type: 'button',
		prompt: "What operation would you like to perform?",
		options: [
			{
				text: "Enroll",
				data: "create",
				next: {
					type: 'text',
					prompt: "Enter first name:",
					validate: (t) => !!t?.trim(),
					error: "First name is required.",
					next: (_) => ({
						type: 'text',
						prompt: "Enter last name:",
						validate: (t) => !!t?.trim(),
						error: "Last name is required.",
						next: (_) => ({
							type: 'text',
							prompt: "Enter birth date (YYYY-MM-DD):",
							validate: (t) => /^\d{4}-\d{2}-\d{2}$/.test(t ?? ""),
							error: "Invalid date format.",
							next: (_) => ({
								type: 'text',
								prompt: "Enter group:",
								validate: (t) => !!t?.trim(),
								error: "Group is required.",
								next: (_) => null,
							}),
						}),
					}),
				},
			},
			{
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
			},
			{
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
			},
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


