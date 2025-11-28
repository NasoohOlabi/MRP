// Attendance model and repository
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { attendance as attendanceTable } from '../../db/schema.js';

// Domain model
export interface Attendance {
	id: number;
	studentId: number;
	date: string; // Format: YYYY-MM-DD
	status: 'present' | 'absent';
	teacherId: number | null;
	createdAt: Date;
	updatedAt: Date;
}

// Convert database row to domain model
function toDomain(row: typeof attendanceTable.$inferSelect): Attendance {
	if (!row.id || !row.studentId || !row.date || !row.status || !row.createdAt || !row.updatedAt) {
		throw new Error('Invalid attendance row: missing required fields');
	}
	return {
		id: row.id,
		studentId: row.studentId,
		date: String(row.date),
		status: row.status as 'present' | 'absent',
		teacherId: row.teacherId ?? null,
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
		date: string; // YYYY-MM-DD format
		status: 'present' | 'absent';
		teacherId?: number | null;
	}): Promise<Attendance | null> {
		// Check if attendance already exists for this student and date
		const existing = await this.findByStudentAndDate(data.studentId, data.date);
		if (existing) {
			return null; // Already has attendance record for this date
		}

		const now = new Date();
		await db.insert(attendanceTable).values({
			studentId: data.studentId,
			date: data.date,
			status: data.status,
			teacherId: data.teacherId ?? null,
			createdAt: now,
			updatedAt: now,
		});
		const rows = await db.select().from(attendanceTable).orderBy(attendanceTable.id);
		const created = rows[rows.length - 1];
		if (!created) throw new Error('Failed to create attendance');
		return toDomain(created);
	}

	async findByStudentAndDate(studentId: number, date: string): Promise<Attendance | null> {
		const rows = await db
			.select()
			.from(attendanceTable)
			.where(and(eq(attendanceTable.studentId, studentId), eq(attendanceTable.date, date)));
		if (rows.length === 0) return null;
		return toDomain(rows[0]!);
	}

	async hasAttended(studentId: number, date: string): Promise<boolean> {
		const attendance = await this.findByStudentAndDate(studentId, date);
		return attendance !== null && attendance.status === 'present';
	}

	async deleteByStudentAndDate(studentId: number, date: string): Promise<boolean> {
		const rows = await db
			.select()
			.from(attendanceTable)
			.where(and(eq(attendanceTable.studentId, studentId), eq(attendanceTable.date, date)));
		if (rows.length === 0) {
			return false;
		}
		await db.delete(attendanceTable).where(and(eq(attendanceTable.studentId, studentId), eq(attendanceTable.date, date)));
		return true;
	}

	async findByDate(
		date: string, // YYYY-MM-DD format
		options?: {
			status?: 'present' | 'absent';
			limit?: number;
			offset?: number;
		}
	): Promise<{ records: Attendance[]; total: number }> {
		const conditions = [eq(attendanceTable.date, date)];
		if (options?.status) {
			conditions.push(eq(attendanceTable.status, options.status));
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

	formatDate(date: Date): string {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	async markPresent(studentId: number, date: string, teacherId?: number | null): Promise<Attendance | null> {
		return this.repo.create({ studentId, date, status: 'present', teacherId });
	}

	async markAbsent(studentId: number, date: string, teacherId?: number | null): Promise<Attendance | null> {
		return this.repo.create({ studentId, date, status: 'absent', teacherId });
	}

	async hasAttendedOnDate(studentId: number, date: string): Promise<boolean> {
		return this.repo.hasAttended(studentId, date);
	}

	async hasRecordOnDate(studentId: number, date: string): Promise<boolean> {
		const record = await this.repo.findByStudentAndDate(studentId, date);
		return record !== null;
	}

	async hasAttendedToday(studentId: number): Promise<boolean> {
		const today = this.formatDate(new Date());
		return this.repo.hasAttended(studentId, today);
	}

	async undoByDate(studentId: number, date: string): Promise<boolean> {
		return this.repo.deleteByStudentAndDate(studentId, date);
	}

	async undoToday(studentId: number): Promise<boolean> {
		const today = this.formatDate(new Date());
		return this.repo.deleteByStudentAndDate(studentId, today);
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

	async getDateAttendance(
		date: string,
		options?: {
			status?: 'present' | 'absent';
			limit?: number;
			offset?: number;
		}
	): Promise<{ records: Attendance[]; total: number }> {
		return this.repo.findByDate(date, options);
	}
}

