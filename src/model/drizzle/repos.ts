import { eq } from 'drizzle-orm';
import Fuse from 'fuse.js';
import type { FuseResult } from 'fuse.js';
import { db } from './db';
import { attendance as attendanceTable, students as studentsTable, teachers as teachersTable } from './schema';

// Domain types expected by conversations (snake_case fields)
export class Student {
	constructor(
		public id: number,
		public first_name: string,
		public last_name: string,
		public birth_date: string,
		public group: string,
		public created_at: Date,
		public updated_at: Date,
	) { }
}

export class Teacher {
	constructor(
		public id: number,
		public first_name: string,
		public last_name: string,
		public phone_number: string,
		public group: string,
		public created_at: Date,
		public updated_at: Date,
	) { }
}

export class Attendance {
	constructor(
		public id: number,
		public student_id: number,
		public event: string,
		public created_at: Date,
		public updated_at: Date,
	) { }
}

function toStudentDomain(row: typeof studentsTable.$inferSelect): Student {
	// Validate expected non-null fields to satisfy lint and runtime safety
	if (row.id == null || row.firstName == null || row.lastName == null || row.group == null || row.createdAt == null || row.updatedAt == null) {
		throw new Error('Invalid student row: missing required fields');
	}
	return new Student(
		row.id,
		row.firstName,
		row.lastName,
		// birthDate stored as Date -> YYYY-MM-DD string
		row.birthDate && !isNaN(new Date(row.birthDate).getTime()) ? new Date(row.birthDate).toISOString().slice(0, 10) : '',
		row.group,
		new Date(row.createdAt),
		new Date(row.updatedAt),
	);
}

function toTeacherDomain(row: typeof teachersTable.$inferSelect): Teacher {
	// Validate expected non-null fields to satisfy lint and runtime safety
	if (row.id == null || row.firstName == null || row.lastName == null || row.phoneNumber == null || row.group == null || row.createdAt == null || row.updatedAt == null) {
		throw new Error('Invalid teacher row: missing required fields');
	}
	return new Teacher(
		row.id,
		row.firstName,
		row.lastName,
		row.phoneNumber,
		row.group,
		row.createdAt && !isNaN(new Date(row.createdAt).getTime()) ? new Date(row.createdAt) : new Date(),
		row.updatedAt && !isNaN(new Date(row.updatedAt).getTime()) ? new Date(row.updatedAt) : new Date(),
	);
}

function toAttendanceDomain(row: typeof attendanceTable.$inferSelect): Attendance {
	// Validate expected non-null fields to satisfy lint and runtime safety
	if (row.id == null || row.studentId == null || row.event == null || row.createdAt == null || row.updatedAt == null) {
		throw new Error('Invalid attendance row: missing required fields');
	}
	return new Attendance(
		row.id,
		row.studentId,
		row.event,
		row.createdAt && !isNaN(new Date(row.createdAt).getTime()) ? new Date(row.createdAt) : new Date(),
		row.updatedAt && !isNaN(new Date(row.updatedAt).getTime()) ? new Date(row.updatedAt) : new Date(),
	);
}

export class StudentRepo {
	public async read(): Promise<Student[]> {
		const rows = await db.select().from(studentsTable);
		return rows.map(toStudentDomain);
	}

	public async create(params: Omit<Omit<Omit<Student, 'updated_at'>, 'created_at'>, 'id'>): Promise<Student> {
		const now = new Date();
		const insert = {
			firstName: params.first_name,
			lastName: params.last_name,
			birthDate: params.birth_date ? new Date(params.birth_date) : now,
			group: params.group,
			createdAt: now,
			updatedAt: now,
		};
		await db.insert(studentsTable).values(insert);
		// Fetch last inserted row (SQLite specific)
		const rows = await db.select().from(studentsTable).orderBy(studentsTable.id);
		const created = rows[rows.length - 1];
		return toStudentDomain(created);
	}

	public async update(student: Student): Promise<Student> {
		const now = new Date();
		await db
			.update(studentsTable)
			.set({
				firstName: student.first_name,
				lastName: student.last_name,
				birthDate: student.birth_date ? new Date(student.birth_date) : undefined,
				group: student.group,
				updatedAt: now,
			})
			.where(eq(studentsTable.id, student.id));
		// Return the updated domain object
		const [row] = await db.select().from(studentsTable).where(eq(studentsTable.id, student.id));
		return toStudentDomain(row);
	}

	public async delete(student: Student): Promise<{ success: boolean }> {
		await db.delete(studentsTable).where(eq(studentsTable.id, student.id));
		return { success: true };
	}

	public async lookFor(response: string): Promise<FuseResult<Student>[]> {
		const students = await this.read();
		const fuse = new Fuse(students, { keys: ['first_name', 'last_name', 'group'] });
		return fuse.search(response);
	}
}

export class TeacherRepo {
	public async read(): Promise<Teacher[]> {
		const rows = await db.select().from(teachersTable);
		return rows.map(toTeacherDomain);
	}

	public async create(params: Omit<Omit<Omit<Teacher, 'updated_at'>, 'created_at'>, 'id'>): Promise<Teacher> {
		const now = new Date();
		const insert = {
			firstName: params.first_name,
			lastName: params.last_name,
			phoneNumber: params.phone_number,
			group: params.group,
			createdAt: now,
			updatedAt: now,
		};
		await db.insert(teachersTable).values(insert);
		const rows = await db.select().from(teachersTable).orderBy(teachersTable.id);
		const created = rows[rows.length - 1];
		return toTeacherDomain(created);
	}

	public async update(teacher: Teacher): Promise<Teacher> {
		const now = new Date();
		await db
			.update(teachersTable)
			.set({
				firstName: teacher.first_name,
				lastName: teacher.last_name,
				phoneNumber: teacher.phone_number,
				group: teacher.group,
				updatedAt: now,
			})
			.where(eq(teachersTable.id, teacher.id));
		const [row] = await db.select().from(teachersTable).where(eq(teachersTable.id, teacher.id));
		return toTeacherDomain(row);
	}

	public async delete(teacher: Teacher): Promise<{ success: boolean }> {
		await db.delete(teachersTable).where(eq(teachersTable.id, teacher.id));
		return { success: true };
	}

	public async lookFor(response: string): Promise<FuseResult<Teacher>[]> {
		const teachers = await this.read();
		const fuse = new Fuse(teachers, { keys: ['first_name', 'last_name', 'group'] });
		return fuse.search(response);
	}

	public async teachersPhoneNumber(phone_number: string): Promise<boolean> {
		const rows = await db.select().from(teachersTable).where(eq(teachersTable.phoneNumber, phone_number));
		return rows.length > 0;
	}
}

export class AttendanceRepo {
	private isSameDay(date1: Date, date2: Date): boolean {
		return date1.getFullYear() === date2.getFullYear() &&
			date1.getMonth() === date2.getMonth() &&
			date1.getDate() === date2.getDate();
	}

	public async read(): Promise<Attendance[]> {
		const rows = await db.select().from(attendanceTable);
		return rows.map(toAttendanceDomain);
	}

	public async create(params: Omit<Omit<Omit<Attendance, 'updated_at'>, 'created_at'>, 'id'>): Promise<Attendance | null> {
		const today = new Date();
		const has = await this.hasAttended(params.student_id, params.event, today);
		if (has) return null;
		const now = new Date();
		await db.insert(attendanceTable).values({
			studentId: params.student_id,
			event: params.event,
			createdAt: now,
			updatedAt: now,
		});
		const rows = await db.select().from(attendanceTable).orderBy(attendanceTable.id);
		const created = rows[rows.length - 1];
		return toAttendanceDomain(created);
	}

	public async update(att: Attendance): Promise<Attendance> {
		const now = new Date();
		await db.update(attendanceTable).set({
			studentId: att.student_id,
			event: att.event,
			updatedAt: now,
		}).where(eq(attendanceTable.id, att.id));
		const [row] = await db.select().from(attendanceTable).where(eq(attendanceTable.id, att.id));
		return toAttendanceDomain(row);
	}

	public async delete(att: Attendance): Promise<{ success: boolean }> {
		await db.delete(attendanceTable).where(eq(attendanceTable.id, att.id));
		return { success: true };
	}

	public async hasAttended(studentId: number, eventName: string, date: Date): Promise<boolean> {
		const rows = await db.select().from(attendanceTable).where(eq(attendanceTable.studentId, studentId));
		return rows.some(r => r.createdAt != null && r.event === eventName && this.isSameDay(new Date(r.createdAt), date));
	}
}