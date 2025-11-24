import type { TeacherRepo } from "../../../model/drizzle/repos";
import type { ButtonStep, AnswerKey } from "../../../types";


export const createStep: (repo: TeacherRepo) => ButtonStep['options'][number] = (repo: TeacherRepo) => ({
	text: "Hire",
	data: "create",
	next: {
		type: 'text',
		key: 'enter_first_name' as AnswerKey,
		prompt: "Enter first name:",
		validate: (text) => !!text?.trim(),
		error: "First name is required.",
		next: async (firstName) => ({
			type: 'text',
			key: 'enter_last_name' as AnswerKey,
			prompt: "Enter last name:",
			validate: (text) => !!text?.trim(),
			error: "Last name is required.",
			next: async (lastName) => ({
				type: 'text',
				key: 'enter_phone' as AnswerKey,
				prompt: "Enter phone number:",
				validate: (text) => /^\d{8,}$/.test(text ?? ""),
				error: "Invalid phone number format.",
				next: async (phoneNumber) => {
					const isDuplicate = await repo.teachersPhoneNumber(phoneNumber);
					if (isDuplicate) {
						return {
							type: 'text',
							key: 'enter_unique_phone' as AnswerKey,
							prompt: "This phone number already exists. Please enter a unique phone number:",
							validate: async (newPhoneNumber) => !await repo.teachersPhoneNumber(newPhoneNumber!),
							error: "Phone number already exists or is invalid.",
							next: async (uniquePhoneNumber) => ({
								type: 'text',
								key: 'enter_group' as AnswerKey,
								prompt: "Enter group:",
								validate: (text) => !!text?.trim(),
								error: "Group is required.",
								next: async (group) => null,
							}),
						};
					}
					return {
						type: 'text',
						key: 'enter_group' as AnswerKey,
						prompt: "Enter group:",
						validate: (text) => !!text?.trim(),
						error: "Group is required.",
						next: async (group) => null,
					};
				},
			}),
		}),
	},
})