// Student model, repository, and service
import { eq } from 'drizzle-orm';
import type { FuseResult } from 'fuse.js';
import Fuse from 'fuse.js';
import { db } from '../../db/index.js';
import { students as studentsTable } from '../../db/schema.js';

// Domain model
export interface Student {
	id: number;
	firstName: string;
	lastName: string;
	birthYear: number;
	group: string;
	phone: string | null;
	fatherPhone: string | null;
	motherPhone: string | null;
	createdAt: Date;
	updatedAt: Date;
}

// Convert database row to domain model
function toDomain(row: typeof studentsTable.$inferSelect): Student {
	// Validate required fields
	if (row.id == null) {
		throw new Error('Invalid student row: missing id');
	}
	const missingFields: string[] = [];
	if (!row.firstName) missingFields.push('firstName');
	if (!row.lastName) missingFields.push('lastName');
	if (missingFields.length > 0) {
		throw new Error(`Invalid student row: missing required fields (id: ${row.id}): ${missingFields.join(', ')}`);
	}

	// Handle timestamps - use current date if missing
	const createdAt = row.createdAt ? new Date(row.createdAt) : new Date();
	const updatedAt = row.updatedAt ? new Date(row.updatedAt) : new Date();

	return {
		id: row.id,
		firstName: String(row.firstName),
		lastName: String(row.lastName),
		birthYear: row.birthYear ?? 0,
		group: row.group ? String(row.group) : null,
		phone: row.phone ?? null,
		fatherPhone: row.fatherPhone ?? null,
		motherPhone: row.motherPhone ?? null,
		createdAt,
		updatedAt,
	};
}

// Repository for data access
export class StudentRepo {
	async findAll(): Promise<Student[]> {
		const rows = await db.select().from(studentsTable);
		const students: Student[] = [];
		for (const row of rows) {
			try {
				students.push(toDomain(row));
			} catch (err) {
				// Log but don't crash on invalid rows
				console.warn('Skipping invalid student row:', err instanceof Error ? err.message : String(err), 'Row ID:', row.id);
			}
		}
		return students;
	}

	async findById(id: number): Promise<Student | null> {
		const rows = await db.select().from(studentsTable).where(eq(studentsTable.id, id));
		if (rows.length === 0) return null;
		return toDomain(rows[0]!);
	}

	async create(data: {
		firstName: string;
		lastName: string;
		birthYear: number;
		group?: string | null;
		phone?: string | null;
		fatherPhone?: string | null;
		motherPhone?: string | null;
	}): Promise<Student> {
		const now = new Date();
		await db.insert(studentsTable).values({
			firstName: data.firstName,
			lastName: data.lastName,
			birthYear: data.birthYear,
			group: data.group,
			phone: data.phone ?? null,
			fatherPhone: data.fatherPhone ?? null,
			motherPhone: data.motherPhone ?? null,
			createdAt: now,
			updatedAt: now,
		});
		const rows = await db.select().from(studentsTable).orderBy(studentsTable.id);
		const created = rows[rows.length - 1];
		if (!created) throw new Error('Failed to create student');
		return toDomain(created);
	}

	async update(student: Student): Promise<Student> {
		const now = new Date();
		await db
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
		const rows = await db.select().from(studentsTable).where(eq(studentsTable.id, student.id));
		if (rows.length === 0) throw new Error('Student not found');
		return toDomain(rows[0]!);
	}

	async delete(id: number): Promise<void> {
		await db.delete(studentsTable).where(eq(studentsTable.id, id));
	}

	async search(query: string): Promise<FuseResult<Student>[]> {
		const students = await this.findAll();
		const fuse = new Fuse(students, {
			keys: ['firstName', 'lastName', 'group'],
			threshold: 0.3,
		});
		return fuse.search(query);
	}
}

// Service layer for business logic
export class StudentService {
	constructor(private repo: StudentRepo = new StudentRepo()) { }

	async getAll(): Promise<Student[]> {
		return this.repo.findAll();
	}

	async getById(id: number): Promise<Student | null> {
		return this.repo.findById(id);
	}

	async register(params: {
		firstName: string;
		lastName: string;
		birthYear: number;
		group: string;
		phone?: string | null;
		fatherPhone?: string | null;
		motherPhone?: string | null;
	}): Promise<Student> {
		return this.repo.create(params);
	}

	async update(student: Student): Promise<Student> {
		return this.repo.update(student);
	}

	async remove(id: number): Promise<void> {
		return this.repo.delete(id);
	}

	async search(query: string): Promise<FuseResult<Student>[]> {
		return this.repo.search(query);
	}
}

