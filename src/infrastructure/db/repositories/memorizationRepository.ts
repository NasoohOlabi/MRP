// Memorization repository - pure data access layer
import { and, eq, gte, lte, desc } from 'drizzle-orm';
import { db } from '../db.js';
import { memorization as memorizationTable } from '../schema.js';
import { toMemorizationDomain } from '../../../core/domain/mappers.js';
import type { Memorization } from '../../../core/domain/memorization.js';

export class MemorizationRepository {
	constructor(private readonly database: typeof db = db) {}

	async findAll(): Promise<Memorization[]> {
		const rows = await this.database.select().from(memorizationTable);
		return rows.map(toMemorizationDomain);
	}

	async findById(id: number): Promise<Memorization | null> {
		const rows = await this.database.select().from(memorizationTable).where(eq(memorizationTable.id, id));
		if (rows.length === 0) return null;
		return toMemorizationDomain(rows[0]!);
	}

	async findByStudentId(studentId: number, options?: {
		fromDate?: Date;
		toDate?: Date;
		limit?: number;
		offset?: number;
	}): Promise<{ records: Memorization[]; total: number }> {
		const conditions = [eq(memorizationTable.studentId, studentId)];
		if (options?.fromDate) {
			conditions.push(gte(memorizationTable.createdAt, options.fromDate));
		}
		if (options?.toDate) {
			conditions.push(lte(memorizationTable.createdAt, options.toDate));
		}

		const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0]!;

		// Get total count
		const allRows = await this.database.select().from(memorizationTable).where(whereClause);
		const total = allRows.length;

		// Get paginated results
		let queryBuilder = this.database
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
		const records = rows.map(toMemorizationDomain);
		return { records, total };
	}

	async create(data: {
		studentId: number;
		page: number;
	}): Promise<Memorization> {
		const now = new Date();
		await this.database.insert(memorizationTable).values({
			studentId: data.studentId,
			page: data.page,
			createdAt: now,
			updatedAt: now,
		});
		const rows = await this.database.select().from(memorizationTable).orderBy(memorizationTable.id);
		const created = rows[rows.length - 1];
		if (!created) throw new Error('Failed to create memorization');
		return toMemorizationDomain(created);
	}

	async delete(id: number): Promise<void> {
		await this.database.delete(memorizationTable).where(eq(memorizationTable.id, id));
	}
}

