import type { ButtonStep } from "../../../types";

export const createStep: ButtonStep['options'][number] = {
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
}