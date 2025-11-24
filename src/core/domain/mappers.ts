// Mappers between database rows and domain models
import type { attendance, memorization, students, teachers } from '../../infrastructure/db/schema.js';
import { Attendance } from './attendance.js';
import { Memorization } from './memorization.js';
import { Student } from './student.js';
import { Teacher } from './teacher.js';

type StudentRow = typeof students.$inferSelect;
type TeacherRow = typeof teachers.$inferSelect;
type AttendanceRow = typeof attendance.$inferSelect;
type MemorizationRow = typeof memorization.$inferSelect;

export function toStudentDomain(row: StudentRow): Student {
	if (!row.id || !row.firstName || !row.lastName || !row.group || !row.createdAt || !row.updatedAt) {
		throw new Error('Invalid student row: missing required fields');
	}
	return new Student(
		row.id,
		row.firstName,
		row.lastName,
		row.birthYear ?? 0,
		row.group,
		row.phone ?? null,
		row.fatherPhone ?? null,
		row.motherPhone ?? null,
		new Date(row.createdAt),
		new Date(row.updatedAt),
	);
}

export function toTeacherDomain(row: TeacherRow): Teacher {
	if (!row.id || !row.firstName || !row.lastName || !row.phoneNumber || !row.group || !row.createdAt || !row.updatedAt) {
		throw new Error('Invalid teacher row: missing required fields');
	}
	return new Teacher(
		row.id,
		row.firstName,
		row.lastName,
		row.phoneNumber,
		row.group,
		new Date(row.createdAt),
		new Date(row.updatedAt),
	);
}

export function toAttendanceDomain(row: AttendanceRow): Attendance {
	if (!row.id || row.studentId === null || !row.event || !row.createdAt || !row.updatedAt) {
		throw new Error('Invalid attendance row: missing required fields');
	}
	return new Attendance(
		row.id,
		row.studentId,
		row.event,
		new Date(row.createdAt),
		new Date(row.updatedAt),
	);
}

export function toMemorizationDomain(row: MemorizationRow): Memorization {
	if (!row.id || row.studentId === null || row.page === null || !row.createdAt || !row.updatedAt) {
		throw new Error('Invalid memorization row: missing required fields');
	}
	return new Memorization(
		row.id,
		row.studentId,
		row.page,
		new Date(row.createdAt),
		new Date(row.updatedAt),
	);
}

