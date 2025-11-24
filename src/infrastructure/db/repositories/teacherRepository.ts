// Teacher repository - pure data access layer
import { eq } from 'drizzle-orm';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import { db } from '../db.js';
import { teachers as teachersTable } from '../schema.js';
import { toTeacherDomain } from '../../../core/domain/mappers.js';
import type { Teacher } from '../../../core/domain/teacher.js';

export class TeacherRepository {
	constructor(private readonly database: typeof db = db) {}

	async findAll(): Promise<Teacher[]> {
		const rows = await this.database.select().from(teachersTable);
		return rows.map(toTeacherDomain);
	}

	async findById(id: number): Promise<Teacher | null> {
		const rows = await this.database.select().from(teachersTable).where(eq(teachersTable.id, id));
		if (rows.length === 0) return null;
		return toTeacherDomain(rows[0]!);
	}

	async findByPhone(phoneNumber: string): Promise<Teacher | null> {
		const rows = await this.database.select().from(teachersTable).where(eq(teachersTable.phoneNumber, phoneNumber));
		if (rows.length === 0) return null;
		return toTeacherDomain(rows[0]!);
	}

	async phoneExists(phoneNumber: string): Promise<boolean> {
		const rows = await this.database.select().from(teachersTable).where(eq(teachersTable.phoneNumber, phoneNumber));
		return rows.length > 0;
	}

	async create(data: {
		firstName: string;
		lastName: string;
		phoneNumber: string;
		group: string;
	}): Promise<Teacher> {
		const now = new Date();
		await this.database.insert(teachersTable).values({
			firstName: data.firstName,
			lastName: data.lastName,
			phoneNumber: data.phoneNumber,
			group: data.group,
			createdAt: now,
			updatedAt: now,
		});
		const rows = await this.database.select().from(teachersTable).orderBy(teachersTable.id);
		const created = rows[rows.length - 1];
		if (!created) throw new Error('Failed to create teacher');
		return toTeacherDomain(created);
	}

	async update(teacher: Teacher): Promise<Teacher> {
		const now = new Date();
		await this.database
			.update(teachersTable)
			.set({
				firstName: teacher.firstName,
				lastName: teacher.lastName,
				phoneNumber: teacher.phoneNumber,
				group: teacher.group,
				updatedAt: now,
			})
			.where(eq(teachersTable.id, teacher.id));
		const rows = await this.database.select().from(teachersTable).where(eq(teachersTable.id, teacher.id));
		if (rows.length === 0) throw new Error('Teacher not found');
		return toTeacherDomain(rows[0]!);
	}

	async delete(id: number): Promise<void> {
		await this.database.delete(teachersTable).where(eq(teachersTable.id, id));
	}
}

