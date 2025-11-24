// Attendance repository - pure data access layer
import { and, eq, gte, lte, desc } from 'drizzle-orm';
import { db } from '../db.js';
import { attendance as attendanceTable } from '../schema.js';
import { toAttendanceDomain } from '../../../core/domain/mappers.js';
import type { Attendance } from '../../../core/domain/attendance.js';

export class AttendanceRepository {
	constructor(private readonly database: typeof db = db) {}

	async findAll(): Promise<Attendance[]> {
		const rows = await this.database.select().from(attendanceTable);
		return rows.map(toAttendanceDomain);
	}

	async findById(id: number): Promise<Attendance | null> {
		const rows = await this.database.select().from(attendanceTable).where(eq(attendanceTable.id, id));
		if (rows.length === 0) return null;
		return toAttendanceDomain(rows[0]!);
	}

	async findByStudentId(studentId: number, options?: {
		fromDate?: Date;
		toDate?: Date;
		limit?: number;
		offset?: number;
	}): Promise<{ records: Attendance[]; total: number }> {
		const conditions = [eq(attendanceTable.studentId, studentId)];
		if (options?.fromDate) {
			conditions.push(gte(attendanceTable.createdAt, options.fromDate));
		}
		if (options?.toDate) {
			conditions.push(lte(attendanceTable.createdAt, options.toDate));
		}

		const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0]!;

		// Get total count
		const allRows = await this.database.select().from(attendanceTable).where(whereClause);
		const total = allRows.length;

		// Get paginated results
		let queryBuilder = this.database
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
		const records = rows.map(toAttendanceDomain);
		return { records, total };
	}

	async findByStudentIdAndDate(studentId: number, date: Date, event: string): Promise<Attendance | null> {
		const startOfDay = new Date(date);
		startOfDay.setHours(0, 0, 0, 0);
		const endOfDay = new Date(date);
		endOfDay.setHours(23, 59, 59, 999);

		const rows = await this.database
			.select()
			.from(attendanceTable)
			.where(
				and(
					eq(attendanceTable.studentId, studentId),
					eq(attendanceTable.event, event),
					gte(attendanceTable.createdAt, startOfDay),
					lte(attendanceTable.createdAt, endOfDay),
				),
			);
		if (rows.length === 0) return null;
		return toAttendanceDomain(rows[0]!);
	}

	async create(data: {
		studentId: number;
		event: string;
	}): Promise<Attendance> {
		const now = new Date();
		await this.database.insert(attendanceTable).values({
			studentId: data.studentId,
			event: data.event,
			createdAt: now,
			updatedAt: now,
		});
		const rows = await this.database.select().from(attendanceTable).orderBy(attendanceTable.id);
		const created = rows[rows.length - 1];
		if (!created) throw new Error('Failed to create attendance');
		return toAttendanceDomain(created);
	}

	async delete(id: number): Promise<void> {
		await this.database.delete(attendanceTable).where(eq(attendanceTable.id, id));
	}
}

