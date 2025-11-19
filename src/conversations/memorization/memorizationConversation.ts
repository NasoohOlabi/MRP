import { createTreeConversation } from '../baseConversation';
import { studentSelectionNode } from '../students/studentSelectionNode';
import { StudentRepo, MemorizationRepo, Student } from '../../model/drizzle/repos';
import type { AnswerKey, Step } from '../../types';

export const memorizationConversation = (studentRepo: StudentRepo, memorizationRepo: MemorizationRepo) => {
    return createTreeConversation({
        entry: {
            type: 'text',
            prompt: 'enter_student_name',
            key: 'name_query' as AnswerKey,
            next: studentSelectionNode(studentRepo, (student: Student) => ({
                type: 'text',
                prompt: 'selected_student_enter_page',
                promptParams: { name: `${student.first_name} ${student.last_name}` },
                key: 'page' as AnswerKey,
                validate: async (text) => {
                    const p = parseInt(text, 10);
                    return !isNaN(p) && p >= 0 && p <= 604;
                },
                error: 'invalid_page',
                next: async (text) => {
                    await memorizationRepo.create({
                        student_id: student.id,
                        page: parseInt(text, 10),
                    });
                    return null;
                }
            }))
        },
        onSuccess: () => { },
        successMessage: 'memorization_saved',
        failureMessage: 'memorization_failed'
    });
};
