// Attendance model and repository
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { attendance as attendanceTable } from '../../db/schema.js';

// Domain model
export interface Attendance {
	id: number;
	studentId: number;
	event: string;
	createdAt: Date;
	updatedAt: Date;
}

// Convert database row to domain model
function toDomain(row: typeof attendanceTable.$inferSelect): Attendance {
	if (!row.id || !row.studentId || !row.event || !row.createdAt || !row.updatedAt) {
		throw new Error('Invalid attendance row: missing required fields');
	}
	return {
		id: row.id,
		studentId: row.studentId,
		event: row.event,
		createdAt: new Date(row.createdAt),
		updatedAt: new Date(row.updatedAt),
	};
}

// Repository for data access
export class AttendanceRepo {
	private isSameDay(date1: Date, date2: Date): boolean {
		return (
			date1.getFullYear() === date2.getFullYear() &&
			date1.getMonth() === date2.getMonth() &&
			date1.getDate() === date2.getDate()
		);
	}

	async findAll(): Promise<Attendance[]> {
		const rows = await db.select().from(attendanceTable);
		return rows.map(toDomain);
	}

	async findByStudentId(
		studentId: number,
		options?: {
			fromDate?: Date;
			toDate?: Date;
			limit?: number;
			offset?: number;
		}
	): Promise<{ records: Attendance[]; total: number }> {
		const conditions = [eq(attendanceTable.studentId, studentId)];
		if (options?.fromDate) {
			conditions.push(gte(attendanceTable.createdAt, options.fromDate));
		}
		if (options?.toDate) {
			conditions.push(lte(attendanceTable.createdAt, options.toDate));
		}

		const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

		// Get total count
		const allRows = await db.select().from(attendanceTable).where(whereClause);
		const total = allRows.length;

		// Get paginated results
		let queryBuilder = db
			.select()
			.from(attendanceTable)
			.where(whereClause)
			.orderBy(desc(attendanceTable.createdAt));

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

	async create(data: {
		studentId: number;
		event: string;
	}): Promise<Attendance | null> {
		const today = new Date();
		const hasAttended = await this.hasAttended(data.studentId, data.event, today);
		if (hasAttended) {
			return null; // Already attended today
		}

		const now = new Date();
		await db.insert(attendanceTable).values({
			studentId: data.studentId,
			event: data.event,
			createdAt: now,
			updatedAt: now,
		});
		const rows = await db.select().from(attendanceTable).orderBy(attendanceTable.id);
		const created = rows[rows.length - 1];
		if (!created) throw new Error('Failed to create attendance');
		return toDomain(created);
	}

	async hasAttended(studentId: number, eventName: string, date: Date): Promise<boolean> {
		const rows = await db.select().from(attendanceTable).where(eq(attendanceTable.studentId, studentId));
		return rows.some(
			(r) => r.createdAt != null && r.event === eventName && this.isSameDay(new Date(r.createdAt), date)
		);
	}

	async deleteToday(studentId: number, eventName: string): Promise<boolean> {
		const today = new Date();
		const rows = await db.select().from(attendanceTable).where(eq(attendanceTable.studentId, studentId));
		const target = rows.find(
			(r) => r.id != null && r.createdAt != null && r.event === eventName && this.isSameDay(new Date(r.createdAt), today)
		);
		if (!target || !target.id) {
			return false;
		}
		await db.delete(attendanceTable).where(eq(attendanceTable.id, target.id));
		return true;
	}

	async findByEvent(
		event: string,
		options?: {
			fromDate?: Date;
			toDate?: Date;
			limit?: number;
			offset?: number;
		}
	): Promise<{ records: Attendance[]; total: number }> {
		const conditions = [eq(attendanceTable.event, event)];
		if (options?.fromDate) {
			conditions.push(gte(attendanceTable.createdAt, options.fromDate));
		}
		if (options?.toDate) {
			conditions.push(lte(attendanceTable.createdAt, options.toDate));
		}

		const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

		// Get total count
		const allRows = await db.select().from(attendanceTable).where(whereClause);
		const total = allRows.length;

		// Get paginated results
		let queryBuilder = db
			.select()
			.from(attendanceTable)
			.where(whereClause)
			.orderBy(desc(attendanceTable.createdAt));

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
export class AttendanceService {
	constructor(private repo: AttendanceRepo = new AttendanceRepo()) {}

	async markPresent(studentId: number, event: string): Promise<Attendance | null> {
		return this.repo.create({ studentId, event });
	}

	async hasAttendedToday(studentId: number, event: string): Promise<boolean> {
		return this.repo.hasAttended(studentId, event, new Date());
	}

	async undoToday(studentId: number, event: string): Promise<boolean> {
		return this.repo.deleteToday(studentId, event);
	}

	async getStudentAttendance(
		studentId: number,
		options?: {
			fromDate?: Date;
			toDate?: Date;
			limit?: number;
			offset?: number;
		}
	): Promise<{ records: Attendance[]; total: number }> {
		return this.repo.findByStudentId(studentId, options);
	}

	async getEventAttendance(
		event: string,
		options?: {
			fromDate?: Date;
			toDate?: Date;
			limit?: number;
			offset?: number;
		}
	): Promise<{ records: Attendance[]; total: number }> {
		return this.repo.findByEvent(event, options);
	}
}

