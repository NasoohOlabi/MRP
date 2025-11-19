import type { ButtonStep, AnswerKey } from "../../../types";

export const createStep: ButtonStep['options'][number] = {
	text: "Enroll",
	data: "create",
	next: {
		type: 'text',
		key: 'enter_first_name' as AnswerKey,
		prompt: "enter_first_name",
		validate: (t) => !!t?.trim(),
		error: "First name is required.",
		next: (_) => ({
			type: 'text',
			key: 'enter_last_name' as AnswerKey,
			prompt: "enter_last_name",
			validate: (t) => !!t?.trim(),
			error: "Last name is required.",
			next: (_) => ({
				type: 'text',
				key: 'enter_birth_year' as AnswerKey,
				prompt: "enter_birth_year",
				validate: (t) => /^\d{4}$/.test(t ?? ""),
				error: "Invalid year format.",
				next: (_) => ({
					type: 'text',
					key: 'enter_group' as AnswerKey,
					prompt: "enter_group",
					validate: (t) => !!t?.trim(),
					error: "Group is required.",
					next: (_) => ({
						type: 'text',
						key: 'enter_phone' as AnswerKey,
						prompt: "enter_phone_optional",
						validate: (t) => !t || t.trim() === '' || /^[\d\s\-\+\(\)]+$/.test(t),
						error: "Invalid phone format.",
						next: (_) => ({
							type: 'text',
							key: 'enter_father_phone' as AnswerKey,
							prompt: "enter_father_phone_optional",
							validate: (t) => !t || t.trim() === '' || /^[\d\s\-\+\(\)]+$/.test(t),
							error: "Invalid phone format.",
							next: (_) => ({
								type: 'text',
								key: 'enter_mother_phone' as AnswerKey,
								prompt: "enter_mother_phone_optional",
								validate: (t) => !t || t.trim() === '' || /^[\d\s\-\+\(\)]+$/.test(t),
								error: "Invalid phone format.",
								next: (_) => null,
							}),
						}),
					}),
				}),
			}),
		}),
	},
}