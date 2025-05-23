import type { TeacherRepo } from "../../../model/Teacher";
import type { ButtonStep } from "../../../types";


export const createStep: (repo: TeacherRepo) => ButtonStep['options'][number] = (repo: TeacherRepo) => ({
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
})