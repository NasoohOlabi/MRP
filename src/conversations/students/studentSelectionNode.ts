import { Student, StudentRepo } from '../../model/drizzle/repos';
import type { AnswerKey, ButtonStep, Step } from '../../types';

const PAGE_SIZE = 4;

export const studentSelectionNode = (repo: StudentRepo, callback: ((student: Student) => Step | null)) => (async (response: string, page: number = 0): Promise<Step | null> => {
	const results = await repo.lookFor(response);
	console.log(`results for ${response}`, results);

	const totalPages = Math.ceil(results.length / PAGE_SIZE);
	const startIndex = page * PAGE_SIZE;
	const endIndex = startIndex + PAGE_SIZE;
	const studentsOnPage = results.slice(startIndex, endIndex);

	// Build a 2x2 grid (up to 4 names), then pagination row, then cancel row
	const options: ButtonStep['options'] = [];

	// First row (up to 2 students)
	for (const [idx, s] of studentsOnPage.slice(0, 2).entries()) {
		options.push({
			text: `${s.item.first_name} ${s.item.last_name}`,
			data: `select_${startIndex + idx}`,
			next: callback(results[startIndex + idx].item),
		});
	}
	options.push({ text: '', data: '__row__', next: null });

	// Second row (next up to 2 students)
	for (const [idx, s] of studentsOnPage.slice(2, 4).entries()) {
		options.push({
			text: `${s.item.first_name} ${s.item.last_name}`,
			data: `select_${startIndex + 2 + idx}`,
			next: callback(results[startIndex + 2 + idx].item),
		});
	}
	options.push({ text: '', data: '__row__', next: null });

	// Pagination row: Previous | Next (lazy next computation)
	if (page > 0) {
		options.push({
			text: 'Previous',
			data: `page_${page - 1}`,
			next: () => studentSelectionNode(repo, callback)(response, page - 1),
		});
	}
	if (page < totalPages - 1) {
		options.push({
			text: 'Next',
			data: `page_${page + 1}`,
			next: () => studentSelectionNode(repo, callback)(response, page + 1),
		});
	}
	options.push({ text: '', data: '__row__', next: null });

	// Cancel row
	options.push({ text: 'Cancel', data: 'cancel', next: null });

	return {
		type: 'button',
		key: 'Select a student' as AnswerKey,
		inPlace: true,
		prompt: `Select a student (page ${page + 1}/${totalPages || 1}):`,
		options,
	};
});