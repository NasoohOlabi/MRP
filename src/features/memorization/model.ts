// Memorization model and repository
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { memorization as memorizationTable } from '../../db/schema.js';

// Domain model
export interface Memorization {
	id: number;
	studentId: number;
	page: number;
	createdAt: Date;
	updatedAt: Date;
}

// Convert database row to domain model
function toDomain(row: typeof memorizationTable.$inferSelect): Memorization {
	if (!row.id || !row.studentId || row.page == null || !row.createdAt || !row.updatedAt) {
		throw new Error('Invalid memorization row: missing required fields');
	}
	return {
		id: row.id,
		studentId: row.studentId,
		page: row.page,
		createdAt: new Date(row.createdAt),
		updatedAt: new Date(row.updatedAt),
	};
}

// Repository for data access
export class MemorizationRepo {
	async create(data: {
		studentId: number;
		page: number;
	}): Promise<Memorization> {
		const now = new Date();
		await db.insert(memorizationTable).values({
			studentId: data.studentId,
			page: data.page,
			createdAt: now,
			updatedAt: now,
		});
		const rows = await db.select().from(memorizationTable).orderBy(memorizationTable.id);
		const created = rows[rows.length - 1];
		if (!created) throw new Error('Failed to create memorization');
		return toDomain(created);
	}

	async findByStudentId(
		studentId: number,
		options?: {
			fromDate?: Date;
			toDate?: Date;
			limit?: number;
			offset?: number;
		}
	): Promise<{ records: Memorization[]; total: number }> {
		const conditions = [eq(memorizationTable.studentId, studentId)];
		if (options?.fromDate) {
			conditions.push(gte(memorizationTable.createdAt, options.fromDate));
		}
		if (options?.toDate) {
			conditions.push(lte(memorizationTable.createdAt, options.toDate));
		}

		const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

		// Get total count
		const allRows = await db.select().from(memorizationTable).where(whereClause);
		const total = allRows.length;

		// Get paginated results
		let queryBuilder = db
			.select()
			.from(memorizationTable)
			.where(whereClause)
			.orderBy(desc(memorizationTable.createdAt));

		if (options?.limit !== undefined && options?.offset !== undefined) {
			queryBuilder = queryBuilder.limit(options.limit).offset(options.offset) as typeof queryBuilder;
		} else if (options?.limit !== undefined) {
			queryBuilder = queryBuilder.limit(options.limit) as typeof queryBuilder;
		} else if (options?.offset !== undefined) {
			queryBuilder = queryBuilder.offset(options.offset) as typeof queryBuilder;
		}

		const rows = await queryBuilder;
		const records = rows.map(toDomain);

		return { records, total };
	}
}

// Service layer for business logic
export class MemorizationService {
	constructor(private repo: MemorizationRepo = new MemorizationRepo()) {}

	async record(studentId: number, page: number): Promise<Memorization> {
		if (page < 0 || page > 604) {
			throw new Error('Invalid page number. Must be between 0 and 604.');
		}
		return this.repo.create({ studentId, page });
	}

	async getStudentMemorizations(
		studentId: number,
		options?: {
			fromDate?: Date;
			toDate?: Date;
			limit?: number;
			offset?: number;
		}
	): Promise<{ records: Memorization[]; total: number }> {
		return this.repo.findByStudentId(studentId, options);
	}
}





