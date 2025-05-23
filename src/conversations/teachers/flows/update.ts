import type { Teacher, TeacherRepo } from "../../../model/Teacher";
import type { ButtonStep, Step, TextStep } from "../../../types";


async function updateTeacher(teacher: Teacher, repo: TeacherRepo) {
	const response = await repo.update(teacher);
	console.log(`Updated teacher info in ${JSON.stringify(response, null, 2)}`, response);
	return null;
}

export const updateStep: (repo: TeacherRepo) => ButtonStep['options'][number] = (repo: TeacherRepo) => ({
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
})