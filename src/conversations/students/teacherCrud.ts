import { Teacher, TeacherRepo } from '../../model/Teacher';
import type { ButtonStep, Step, TextStep } from '../../types';
import { createTreeConversation } from '../baseConversation';

export const teacherCrudConversation = (repo: TeacherRepo) => createTreeConversation<string | null>({
	entry: {
		type: 'button',
		prompt: "What operation would you like to perform?",
		options: [
			{
				text: "Hire",
				data: "create",
				next: {
					type: 'text',
					prompt: "Enter first name:",
					validate: (text) => !!text?.trim(),
					error: "First name is required.",
					next: async (firstName) => ({
						type: 'text',
						prompt: "Enter last name:",
						validate: (text) => !!text?.trim(),
						error: "Last name is required.",
						next: async (lastName) => ({
							type: 'text',
							prompt: "Enter phone number:",
							validate: (text) => /^\d{8,}$/.test(text ?? ""),
							error: "Invalid phone number format.",
							next: async (phoneNumber) => {
								const isDuplicate = await repo.teachersPhoneNumber(phoneNumber);
								if (isDuplicate) {
									return {
										type: 'text',
										prompt: "This phone number already exists. Please enter a unique phone number:",
										validate: async (newPhoneNumber) => !await repo.teachersPhoneNumber(newPhoneNumber!) && /^\d{8,}$/.test(newPhoneNumber ?? ""),
										error: "Phone number already exists or is invalid.",
										next: async (uniquePhoneNumber) => ({
											type: 'text',
											prompt: "Enter group:",
											validate: (text) => !!text?.trim(),
											error: "Group is required.",
											next: async (group) => null,
										}),
									};
								}
								return {
									type: 'text',
									prompt: "Enter group:",
									validate: (text) => !!text?.trim(),
									error: "Group is required.",
									next: async (group) => null,
								};
							},
						}),
					}),
				},
			},
			{
				text: "Update",
				data: "update",
				next: {
					type: 'text',
					prompt: "Which teacher to update:",
					validate: async (text) => !!text?.trim() && (await repo.lookFor(text)).length > 0,
					error: "Teacher name is required.",
					next: async (response: string): Promise<Step | null> => {
						const results = await repo.lookFor(response);
						return {
							type: 'text',
							prompt: "Tap on the teacher number:\n\n" + results.map((s, idx) => `/${idx} - ${s.item.first_name} ${s.item.last_name}`).join('\n'),
							validate: (text) => !!text && text.trim().startsWith('/') && !isNaN(+text.trim().slice(1)) && +text.trim().slice(1) < results.length,
							error: `Tap on one of the numbers between /0 and /${results.length - 1}.`,
							next: async (iStr) => {
								const i = Number(iStr.slice(1));
								const teacher = results[i].item;
								const op = ({ label, value }: { label: string, value: 'first_name' | 'last_name' | 'phone_number' | 'group' | 'cancel' }): TextStep => ({
									type: 'text',
									prompt: `Please enter the new ${label}:`,
									error: `${label} is required.`,
									validate: value === 'phone_number' ? (text) => /^\d{8,}$/.test(text ?? "") : (text) => !!text?.trim(),
									next: value === 'cancel' ? async () => null : async (newName: string) => {
										if (value === 'phone_number' && await repo.teachersPhoneNumber(newName)) {
											return {
												type: 'text',
												prompt: "This phone number already exists. Please enter a unique phone number:",
												validate: async (newPhoneNumber) => !await repo.teachersPhoneNumber(newPhoneNumber!) && /^\d{8,}$/.test(newPhoneNumber ?? ""),
												error: "Phone number already exists or is invalid.",
												next: async (finalNewName) => {
													teacher[value] = finalNewName;
													return updateTeacher(teacher, repo);
												},
											};
										}
										teacher[value] = newName;
										return updateTeacher(teacher, repo);
									}
								});
								return {
									type: 'button',
									prompt: `Do you want to update the info of \n\n ${teacher.first_name} ${teacher.last_name} \n\n ${teacher.phone_number} \n\n ${teacher.group}`,
									options: ([
										['First Name', 'first_name'],
										['Last Name', 'last_name'],
										['Phone Number', 'phone_number'],
										['Group', 'group'],
										['Cancel', 'cancel']
									] as const).map(([text, data]) => ({
										text: text,
										data: data,
										next: op({ label: text, value: data })
									})),
									onSelect: async (data, ctx, res) => {
										if (data === 'cancel') {
											await res.editMessageText("Operation cancelled.");
											throw new Error("User cancelled operation.");
										} else {
											await res.editMessageText(`You selected ${data.toUpperCase()}`);
										}
									},
								} as ButtonStep;
							},
						} as TextStep;
					},
				},
			},
			{
				text: "Dismiss",
				data: "delete",
				next: {
					type: 'text',
					prompt: "Which teacher to dismiss:",
					validate: async (text) => !!text?.trim() && (await repo.lookFor(text)).length > 0,
					error: "Teacher name is required.",
					next: async (response: string): Promise<Step | null> => {
						const results = await repo.lookFor(response);
						return {
							type: 'text',
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
						} as TextStep;
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

async function updateTeacher(teacher: Teacher, repo: TeacherRepo) {
	const response = await repo.update(teacher);
	console.log(`Updated teacher info in ${JSON.stringify(response, null, 2)}`, response);
	return null;
}