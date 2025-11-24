// Student repository - pure data access layer
import { eq } from 'drizzle-orm';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import { db } from '../db.js';
import { students as studentsTable } from '../schema.js';
import { toStudentDomain } from '../../../core/domain/mappers.js';
import type { Student } from '../../../core/domain/student.js';

export class StudentRepository {
	constructor(private readonly database: typeof db = db) {}

	async findAll(): Promise<Student[]> {
		const rows = await this.database.select().from(studentsTable);
		return rows.map(toStudentDomain);
	}

	async findById(id: number): Promise<Student | null> {
		const rows = await this.database.select().from(studentsTable).where(eq(studentsTable.id, id));
		if (rows.length === 0) return null;
		return toStudentDomain(rows[0]!);
	}

	async create(data: {
		firstName: string;
		lastName: string;
		birthYear: number;
		group: string;
		phone: string | null;
		fatherPhone: string | null;
		motherPhone: string | null;
	}): Promise<Student> {
		const now = new Date();
		await this.database.insert(studentsTable).values({
			firstName: data.firstName,
			lastName: data.lastName,
			birthYear: data.birthYear,
			group: data.group,
			phone: data.phone,
			fatherPhone: data.fatherPhone,
			motherPhone: data.motherPhone,
			createdAt: now,
			updatedAt: now,
		});
		const rows = await this.database.select().from(studentsTable).orderBy(studentsTable.id);
		const created = rows[rows.length - 1];
		if (!created) throw new Error('Failed to create student');
		return toStudentDomain(created);
	}

	async update(student: Student): Promise<Student> {
		const now = new Date();
		await this.database
			.update(studentsTable)
			.set({
				firstName: student.firstName,
				lastName: student.lastName,
				birthYear: student.birthYear,
				group: student.group,
				phone: student.phone,
				fatherPhone: student.fatherPhone,
				motherPhone: student.motherPhone,
				updatedAt: now,
			})
			.where(eq(studentsTable.id, student.id));
		const rows = await this.database.select().from(studentsTable).where(eq(studentsTable.id, student.id));
		if (rows.length === 0) throw new Error('Student not found');
		return toStudentDomain(rows[0]!);
	}

	async delete(id: number): Promise<void> {
		await this.database.delete(studentsTable).where(eq(studentsTable.id, id));
	}
}

