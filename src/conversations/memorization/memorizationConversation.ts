import { ConversationBuilder } from '../baseConversation';
import { studentSelectionNode } from '../students/studentSelectionNode';
import { StudentRepo, MemorizationRepo, Student } from '../../model/drizzle/repos';

export const memorizationConversation = (studentRepo: StudentRepo, memorizationRepo: MemorizationRepo) => {
    // Create the student selection handler
    const selectStudent = studentSelectionNode(studentRepo, (student: Student) =>
        new ConversationBuilder()
            .text('page', 'selected_student_enter_page', {
                promptParams: { name: `${student.first_name} ${student.last_name}` },
                validate: async (text) => {
                    const p = parseInt(text, 10);
                    return !isNaN(p) && p >= 0 && p <= 604;
                },
                error: 'invalid_page',
                action: async (text) => {
                    await memorizationRepo.create({
                        student_id: student.id,
                        page: parseInt(text, 10),
                    });
                }
            })
            .compile()
    );

    return new ConversationBuilder()
        .text('name_query', 'enter_student_name', {
            next: async (val) => await selectStudent(val)
        })
        .build(
            () => { },
            {
                successMessage: 'memorization_saved',
                failureMessage: 'memorization_failed'
            }
        );
};
