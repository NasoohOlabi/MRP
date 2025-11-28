// Teacher model, repository, and service
import { eq } from 'drizzle-orm';
import Fuse from 'fuse.js';
import type { FuseResult } from 'fuse.js';
import { db } from '../../db/index.js';
import { teachers as teachersTable } from '../../db/schema.js';

// Domain model
export interface Teacher {
	id: number;
	name: string;
	createdAt: Date;
	updatedAt: Date;
}

// Convert database row to domain model
function toDomain(row: typeof teachersTable.$inferSelect): Teacher {
	if (!row.id || !row.name || !row.createdAt || !row.updatedAt) {
		throw new Error('Invalid teacher row: missing required fields');
	}
	return {
		id: row.id,
		name: row.name,
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

	async findByName(name: string): Promise<Teacher | null> {
		const rows = await db.select().from(teachersTable).where(eq(teachersTable.name, name));
		if (rows.length === 0) return null;
		return toDomain(rows[0]!);
	}

	async create(data: { name: string }): Promise<Teacher> {
		const now = new Date();
		await db.insert(teachersTable).values({
			name: data.name,
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
				name: teacher.name,
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
			keys: ['name'],
			threshold: 0.4,
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

	async register(params: { name: string }): Promise<Teacher> {
		const existing = await this.repo.findByName(params.name);
		if (existing) {
			throw new Error('Teacher already exists');
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






