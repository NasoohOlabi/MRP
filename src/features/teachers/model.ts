// Teacher model, repository, and service
import { eq } from 'drizzle-orm';
import Fuse from 'fuse.js';
import type { FuseResult } from 'fuse.js';
import { db } from '../../db/index.js';
import { teachers as teachersTable } from '../../db/schema.js';

// Domain model
export interface Teacher {
	id: number;
	firstName: string;
	lastName: string;
	phoneNumber: string;
	group: string;
	createdAt: Date;
	updatedAt: Date;
}

// Convert database row to domain model
function toDomain(row: typeof teachersTable.$inferSelect): Teacher {
	if (!row.id || !row.firstName || !row.lastName || !row.phoneNumber || !row.group || !row.createdAt || !row.updatedAt) {
		throw new Error('Invalid teacher row: missing required fields');
	}
	return {
		id: row.id,
		firstName: row.firstName,
		lastName: row.lastName,
		phoneNumber: row.phoneNumber,
		group: row.group,
		createdAt: new Date(row.createdAt),
		updatedAt: new Date(row.updatedAt),
	};
}

// Repository for data access
export class TeacherRepo {
	async findAll(): Promise<Teacher[]> {
		const rows = await db.select().from(teachersTable);
		return rows.map(toDomain);
	}

	async findById(id: number): Promise<Teacher | null> {
		const rows = await db.select().from(teachersTable).where(eq(teachersTable.id, id));
		if (rows.length === 0) return null;
		return toDomain(rows[0]!);
	}

	async findByPhone(phoneNumber: string): Promise<Teacher | null> {
		const rows = await db.select().from(teachersTable).where(eq(teachersTable.phoneNumber, phoneNumber));
		if (rows.length === 0) return null;
		return toDomain(rows[0]!);
	}

	async create(data: {
		firstName: string;
		lastName: string;
		phoneNumber: string;
		group: string;
	}): Promise<Teacher> {
		const now = new Date();
		await db.insert(teachersTable).values({
			firstName: data.firstName,
			lastName: data.lastName,
			phoneNumber: data.phoneNumber,
			group: data.group,
			createdAt: now,
			updatedAt: now,
		});
		const rows = await db.select().from(teachersTable).orderBy(teachersTable.id);
		const created = rows[rows.length - 1];
		if (!created) throw new Error('Failed to create teacher');
		return toDomain(created);
	}

	async update(teacher: Teacher): Promise<Teacher> {
		const now = new Date();
		await db
			.update(teachersTable)
			.set({
				firstName: teacher.firstName,
				lastName: teacher.lastName,
				phoneNumber: teacher.phoneNumber,
				group: teacher.group,
				updatedAt: now,
			})
			.where(eq(teachersTable.id, teacher.id));
		const rows = await db.select().from(teachersTable).where(eq(teachersTable.id, teacher.id));
		if (rows.length === 0) throw new Error('Teacher not found');
		return toDomain(rows[0]!);
	}

	async delete(id: number): Promise<void> {
		await db.delete(teachersTable).where(eq(teachersTable.id, id));
	}

	async search(query: string): Promise<FuseResult<Teacher>[]> {
		const teachers = await this.findAll();
		const fuse = new Fuse(teachers, {
			keys: ['firstName', 'lastName', 'group'],
			threshold: 0.3,
		});
		return fuse.search(query);
	}
}

// Service layer for business logic
export class TeacherService {
	constructor(private repo: TeacherRepo = new TeacherRepo()) {}

	async getAll(): Promise<Teacher[]> {
		return this.repo.findAll();
	}

	async getById(id: number): Promise<Teacher | null> {
		return this.repo.findById(id);
	}

	async getByPhone(phoneNumber: string): Promise<Teacher | null> {
		return this.repo.findByPhone(phoneNumber);
	}

	async register(params: {
		firstName: string;
		lastName: string;
		phoneNumber: string;
		group: string;
	}): Promise<Teacher> {
		// Check if phone number already exists
		const existing = await this.repo.findByPhone(params.phoneNumber);
		if (existing) {
			throw new Error('Phone number already exists');
		}
		return this.repo.create(params);
	}

	async update(teacher: Teacher): Promise<Teacher> {
		return this.repo.update(teacher);
	}

	async remove(id: number): Promise<void> {
		return this.repo.delete(id);
	}

	async search(query: string): Promise<FuseResult<Teacher>[]> {
		return this.repo.search(query);
	}
}





