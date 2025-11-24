import { and, eq, gte, lte, desc } from 'drizzle-orm';
import Fuse from 'fuse.js';
import type { FuseResult } from 'fuse.js';
import { db } from './db';
import { attendance as attendanceTable, memorization as memorizationTable, students as studentsTable, teachers as teachersTable } from './schema';
import { logger } from '../../utils/logger.js';

// Domain types expected by conversations (snake_case fields)
export class Student {
	constructor(
		public id: number,
		public first_name: string,
		public last_name: string,
		public birth_year: number,
		public group: string,
		public phone: string | null,
		public father_phone: string | null,
		public mother_phone: string | null,
		public created_at: Date,
		public updated_at: Date,
	) { }
}

export class Teacher {
	constructor(
		public id: number,
		public first_name: string,
		public last_name: string,
		public phone_number: string,
		public group: string,
		public created_at: Date,
		public updated_at: Date,
	) { }
}

export class Attendance {
	constructor(
		public id: number,
		public student_id: number,
		public event: string,
		public created_at: Date,
		public updated_at: Date,
	) { }
}

export class Memorization {
	constructor(
		public id: number,
		public student_id: number,
		public page: number,
		public created_at: Date,
		public updated_at: Date,
	) { }
}

function toStudentDomain(row: typeof studentsTable.$inferSelect): Student {
	if (row.id == null || row.firstName == null || row.lastName == null || row.group == null || row.createdAt == null || row.updatedAt == null) {
		throw new Error('Invalid student row: missing required fields');
	}
	return new Student(
		row.id,
		row.firstName,
		row.lastName,
		row.birthYear ?? 0,
		row.group,
		row.phone ?? null,
		row.fatherPhone ?? null,
		row.motherPhone ?? null,
		new Date(row.createdAt),
		new Date(row.updatedAt),
	);
}

function toTeacherDomain(row: typeof teachersTable.$inferSelect): Teacher {
	if (row.id == null || row.firstName == null || row.lastName == null || row.phoneNumber == null || row.group == null || row.createdAt == null || row.updatedAt == null) {
		throw new Error('Invalid teacher row: missing required fields');
	}
	return new Teacher(
		row.id,
		row.firstName,
		row.lastName,
		row.phoneNumber,
		row.group,
		row.createdAt && !isNaN(new Date(row.createdAt).getTime()) ? new Date(row.createdAt) : new Date(),
		row.updatedAt && !isNaN(new Date(row.updatedAt).getTime()) ? new Date(row.updatedAt) : new Date(),
	);
}

function toAttendanceDomain(row: typeof attendanceTable.$inferSelect): Attendance {
	if (row.id == null || row.studentId == null || row.event == null || row.createdAt == null || row.updatedAt == null) {
		throw new Error('Invalid attendance row: missing required fields');
	}
	return new Attendance(
		row.id,
		row.studentId,
		row.event,
		row.createdAt && !isNaN(new Date(row.createdAt).getTime()) ? new Date(row.createdAt) : new Date(),
		row.updatedAt && !isNaN(new Date(row.updatedAt).getTime()) ? new Date(row.updatedAt) : new Date(),
	);
}

function toMemorizationDomain(row: typeof memorizationTable.$inferSelect): Memorization {
	if (row.id == null || row.studentId == null || row.page == null || row.createdAt == null || row.updatedAt == null) {
		throw new Error('Invalid memorization row: missing required fields');
	}
	return new Memorization(
		row.id,
		row.studentId,
		row.page,
		row.createdAt && !isNaN(new Date(row.createdAt).getTime()) ? new Date(row.createdAt) : new Date(),
		row.updatedAt && !isNaN(new Date(row.updatedAt).getTime()) ? new Date(row.updatedAt) : new Date(),
	);
}

export class StudentRepo {
	public async read(): Promise<Student[]> {
		const startTime = Date.now();
		try {
			logger.debug('StudentRepo.read: Starting read operation');
			const rows = await db.select().from(studentsTable);
			const students = rows.map(toStudentDomain);
			const duration = Date.now() - startTime;
			logger.info('StudentRepo.read: Successfully read students', { count: students.length, durationMs: duration });
			return students;
		} catch (error) {
			const duration = Date.now() - startTime;
			logger.error('StudentRepo.read: Failed to read students', { error, durationMs: duration });
			throw error;
		}
	}

	public async create(params: Omit<Omit<Omit<Student, 'updated_at'>, 'created_at'>, 'id'>): Promise<Student> {
		const startTime = Date.now();
		try {
			logger.debug('StudentRepo.create: Starting create operation', { 
				firstName: params.first_name, 
				lastName: params.last_name, 
				group: params.group 
			});
			const now = new Date();
			const insert = {
				firstName: params.first_name,
				lastName: params.last_name,
				birthYear: params.birth_year,
				group: params.group,
				phone: params.phone,
				fatherPhone: params.father_phone,
				motherPhone: params.mother_phone,
				createdAt: now,
				updatedAt: now,
			};
			await db.insert(studentsTable).values(insert);
			const rows = await db.select().from(studentsTable).orderBy(studentsTable.id);
			const created = rows[rows.length - 1];
			const student = toStudentDomain(created);
			const duration = Date.now() - startTime;
			logger.info('StudentRepo.create: Successfully created student', { 
				studentId: student.id, 
				firstName: student.first_name, 
				lastName: student.last_name,
				durationMs: duration 
			});
			return student;
		} catch (error) {
			const duration = Date.now() - startTime;
			logger.error('StudentRepo.create: Failed to create student', { 
				error, 
				params: { firstName: params.first_name, lastName: params.last_name },
				durationMs: duration 
			});
			throw error;
		}
	}

	public async update(student: Student): Promise<Student> {
		const startTime = Date.now();
		try {
			logger.debug('StudentRepo.update: Starting update operation', { studentId: student.id });
			const now = new Date();
			await db
				.update(studentsTable)
				.set({
					firstName: student.first_name,
					lastName: student.last_name,
					birthYear: student.birth_year,
					group: student.group,
					phone: student.phone,
					fatherPhone: student.father_phone,
					motherPhone: student.mother_phone,
					updatedAt: now,
				})
				.where(eq(studentsTable.id, student.id));
			const [row] = await db.select().from(studentsTable).where(eq(studentsTable.id, student.id));
			const updated = toStudentDomain(row);
			const duration = Date.now() - startTime;
			logger.info('StudentRepo.update: Successfully updated student', { 
				studentId: student.id,
				durationMs: duration 
			});
			return updated;
		} catch (error) {
			const duration = Date.now() - startTime;
			logger.error('StudentRepo.update: Failed to update student', { 
				error, 
				studentId: student.id,
				durationMs: duration 
			});
			throw error;
		}
	}

	public async delete(student: Student): Promise<{ success: boolean }> {
		const startTime = Date.now();
		try {
			logger.debug('StudentRepo.delete: Starting delete operation', { studentId: student.id });
			await db.delete(studentsTable).where(eq(studentsTable.id, student.id));
			const duration = Date.now() - startTime;
			logger.info('StudentRepo.delete: Successfully deleted student', { 
				studentId: student.id,
				durationMs: duration 
			});
			return { success: true };
		} catch (error) {
			const duration = Date.now() - startTime;
			logger.error('StudentRepo.delete: Failed to delete student', { 
				error, 
				studentId: student.id,
				durationMs: duration 
			});
			throw error;
		}
	}

	public async lookFor(response: string): Promise<FuseResult<Student>[]> {
		const startTime = Date.now();
		try {
			logger.debug('StudentRepo.lookFor: Starting search', { query: response });
			const students = await this.read();
			const fuse = new Fuse(students, { keys: ['first_name', 'last_name', 'group'] });
			const results = fuse.search(response);
			const duration = Date.now() - startTime;
			logger.info('StudentRepo.lookFor: Search completed', { 
				query: response, 
				resultCount: results.length,
				durationMs: duration 
			});
			return results;
		} catch (error) {
			const duration = Date.now() - startTime;
			logger.error('StudentRepo.lookFor: Search failed', { error, query: response, durationMs: duration });
			throw error;
		}
	}
}

export class TeacherRepo {
	public async read(): Promise<Teacher[]> {
		const startTime = Date.now();
		try {
			logger.debug('TeacherRepo.read: Starting read operation');
			const rows = await db.select().from(teachersTable);
			const teachers = rows.map(toTeacherDomain);
			const duration = Date.now() - startTime;
			logger.info('TeacherRepo.read: Successfully read teachers', { count: teachers.length, durationMs: duration });
			return teachers;
		} catch (error) {
			const duration = Date.now() - startTime;
			logger.error('TeacherRepo.read: Failed to read teachers', { error, durationMs: duration });
			throw error;
		}
	}

	public async create(params: Omit<Omit<Omit<Teacher, 'updated_at'>, 'created_at'>, 'id'>): Promise<Teacher> {
		const startTime = Date.now();
		try {
			logger.debug('TeacherRepo.create: Starting create operation', { 
				firstName: params.first_name, 
				lastName: params.last_name, 
				group: params.group 
			});
			const now = new Date();
			const insert = {
				firstName: params.first_name,
				lastName: params.last_name,
				phoneNumber: params.phone_number,
				group: params.group,
				createdAt: now,
				updatedAt: now,
			};
			await db.insert(teachersTable).values(insert);
			const rows = await db.select().from(teachersTable).orderBy(teachersTable.id);
			const created = rows[rows.length - 1];
			const teacher = toTeacherDomain(created);
			const duration = Date.now() - startTime;
			logger.info('TeacherRepo.create: Successfully created teacher', { 
				teacherId: teacher.id, 
				firstName: teacher.first_name, 
				lastName: teacher.last_name,
				durationMs: duration 
			});
			return teacher;
		} catch (error) {
			const duration = Date.now() - startTime;
			logger.error('TeacherRepo.create: Failed to create teacher', { 
				error, 
				params: { firstName: params.first_name, lastName: params.last_name },
				durationMs: duration 
			});
			throw error;
		}
	}

	public async update(teacher: Teacher): Promise<Teacher> {
		const startTime = Date.now();
		try {
			logger.debug('TeacherRepo.update: Starting update operation', { teacherId: teacher.id });
			const now = new Date();
			await db
				.update(teachersTable)
				.set({
					firstName: teacher.first_name,
					lastName: teacher.last_name,
					phoneNumber: teacher.phone_number,
					group: teacher.group,
					updatedAt: now,
				})
				.where(eq(teachersTable.id, teacher.id));
			const [row] = await db.select().from(teachersTable).where(eq(teachersTable.id, teacher.id));
			const updated = toTeacherDomain(row);
			const duration = Date.now() - startTime;
			logger.info('TeacherRepo.update: Successfully updated teacher', { 
				teacherId: teacher.id,
				durationMs: duration 
			});
			return updated;
		} catch (error) {
			const duration = Date.now() - startTime;
			logger.error('TeacherRepo.update: Failed to update teacher', { 
				error, 
				teacherId: teacher.id,
				durationMs: duration 
			});
			throw error;
		}
	}

	public async delete(teacher: Teacher): Promise<{ success: boolean }> {
		const startTime = Date.now();
		try {
			logger.debug('TeacherRepo.delete: Starting delete operation', { teacherId: teacher.id });
			await db.delete(teachersTable).where(eq(teachersTable.id, teacher.id));
			const duration = Date.now() - startTime;
			logger.info('TeacherRepo.delete: Successfully deleted teacher', { 
				teacherId: teacher.id,
				durationMs: duration 
			});
			return { success: true };
		} catch (error) {
			const duration = Date.now() - startTime;
			logger.error('TeacherRepo.delete: Failed to delete teacher', { 
				error, 
				teacherId: teacher.id,
				durationMs: duration 
			});
			throw error;
		}
	}

	public async lookFor(response: string): Promise<FuseResult<Teacher>[]> {
		const startTime = Date.now();
		try {
			logger.debug('TeacherRepo.lookFor: Starting search', { query: response });
			const teachers = await this.read();
			const fuse = new Fuse(teachers, { keys: ['first_name', 'last_name', 'group'] });
			const results = fuse.search(response);
			const duration = Date.now() - startTime;
			logger.info('TeacherRepo.lookFor: Search completed', { 
				query: response, 
				resultCount: results.length,
				durationMs: duration 
			});
			return results;
		} catch (error) {
			const duration = Date.now() - startTime;
			logger.error('TeacherRepo.lookFor: Search failed', { error, query: response, durationMs: duration });
			throw error;
		}
	}

	public async teachersPhoneNumber(phone_number: string): Promise<boolean> {
		const startTime = Date.now();
		try {
			logger.debug('TeacherRepo.teachersPhoneNumber: Checking phone number', { phoneNumber: phone_number });
			const rows = await db.select().from(teachersTable).where(eq(teachersTable.phoneNumber, phone_number));
			const exists = rows.length > 0;
			const duration = Date.now() - startTime;
			logger.debug('TeacherRepo.teachersPhoneNumber: Check completed', { 
				phoneNumber: phone_number, 
				exists,
				durationMs: duration 
			});
			return exists;
		} catch (error) {
			const duration = Date.now() - startTime;
			logger.error('TeacherRepo.teachersPhoneNumber: Check failed', { error, phoneNumber: phone_number, durationMs: duration });
			throw error;
		}
	}

	public async findByPhone(phone_number: string): Promise<Teacher | null> {
		const startTime = Date.now();
		try {
			logger.debug('TeacherRepo.findByPhone: Finding teacher by phone', { phoneNumber: phone_number });
			const rows = await db.select().from(teachersTable).where(eq(teachersTable.phoneNumber, phone_number));
			const duration = Date.now() - startTime;
			if (!rows.length) {
				logger.debug('TeacherRepo.findByPhone: Teacher not found', { phoneNumber: phone_number, durationMs: duration });
				return null;
			}
			const teacher = toTeacherDomain(rows[0]);
			logger.info('TeacherRepo.findByPhone: Teacher found', { 
				phoneNumber: phone_number, 
				teacherId: teacher.id,
				durationMs: duration 
			});
			return teacher;
		} catch (error) {
			const duration = Date.now() - startTime;
			logger.error('TeacherRepo.findByPhone: Find failed', { error, phoneNumber: phone_number, durationMs: duration });
			throw error;
		}
	}
}

export class AttendanceRepo {
	private isSameDay(date1: Date, date2: Date): boolean {
		return date1.getFullYear() === date2.getFullYear() &&
			date1.getMonth() === date2.getMonth() &&
			date1.getDate() === date2.getDate();
	}

	public async read(): Promise<Attendance[]> {
		const startTime = Date.now();
		try {
			logger.debug('AttendanceRepo.read: Starting read operation');
			const rows = await db.select().from(attendanceTable);
			const attendance = rows.map(toAttendanceDomain);
			const duration = Date.now() - startTime;
			logger.info('AttendanceRepo.read: Successfully read attendance records', { count: attendance.length, durationMs: duration });
			return attendance;
		} catch (error) {
			const duration = Date.now() - startTime;
			logger.error('AttendanceRepo.read: Failed to read attendance records', { error, durationMs: duration });
			throw error;
		}
	}

	public async create(params: Omit<Omit<Omit<Attendance, 'updated_at'>, 'created_at'>, 'id'>): Promise<Attendance | null> {
		const startTime = Date.now();
		try {
			logger.debug('AttendanceRepo.create: Starting create operation', { 
				studentId: params.student_id, 
				event: params.event 
			});
			const today = new Date();
			const has = await this.hasAttended(params.student_id, params.event, today);
			if (has) {
				const duration = Date.now() - startTime;
				logger.warn('AttendanceRepo.create: Student already attended today', { 
					studentId: params.student_id, 
					event: params.event,
					durationMs: duration 
				});
				return null;
			}
			const now = new Date();
			await db.insert(attendanceTable).values({
				studentId: params.student_id,
				event: params.event,
				createdAt: now,
				updatedAt: now,
			});
			const rows = await db.select().from(attendanceTable).orderBy(attendanceTable.id);
			const created = rows[rows.length - 1];
			const attendance = toAttendanceDomain(created);
			const duration = Date.now() - startTime;
			logger.info('AttendanceRepo.create: Successfully created attendance record', { 
				attendanceId: attendance.id,
				studentId: params.student_id, 
				event: params.event,
				durationMs: duration 
			});
			return attendance;
		} catch (error) {
			const duration = Date.now() - startTime;
			logger.error('AttendanceRepo.create: Failed to create attendance record', { 
				error, 
				studentId: params.student_id,
				event: params.event,
				durationMs: duration 
			});
			throw error;
		}
	}

	public async update(att: Attendance): Promise<Attendance> {
		const startTime = Date.now();
		try {
			logger.debug('AttendanceRepo.update: Starting update operation', { attendanceId: att.id });
			const now = new Date();
			await db.update(attendanceTable).set({
				studentId: att.student_id,
				event: att.event,
				updatedAt: now,
			}).where(eq(attendanceTable.id, att.id));
			const [row] = await db.select().from(attendanceTable).where(eq(attendanceTable.id, att.id));
			const updated = toAttendanceDomain(row);
			const duration = Date.now() - startTime;
			logger.info('AttendanceRepo.update: Successfully updated attendance record', { 
				attendanceId: att.id,
				durationMs: duration 
			});
			return updated;
		} catch (error) {
			const duration = Date.now() - startTime;
			logger.error('AttendanceRepo.update: Failed to update attendance record', { 
				error, 
				attendanceId: att.id,
				durationMs: duration 
			});
			throw error;
		}
	}

	public async delete(att: Attendance): Promise<{ success: boolean }> {
		const startTime = Date.now();
		try {
			logger.debug('AttendanceRepo.delete: Starting delete operation', { attendanceId: att.id });
			await db.delete(attendanceTable).where(eq(attendanceTable.id, att.id));
			const duration = Date.now() - startTime;
			logger.info('AttendanceRepo.delete: Successfully deleted attendance record', { 
				attendanceId: att.id,
				durationMs: duration 
			});
			return { success: true };
		} catch (error) {
			const duration = Date.now() - startTime;
			logger.error('AttendanceRepo.delete: Failed to delete attendance record', { 
				error, 
				attendanceId: att.id,
				durationMs: duration 
			});
			throw error;
		}
	}

	public async hasAttended(studentId: number, eventName: string, date: Date): Promise<boolean> {
		const startTime = Date.now();
		try {
			logger.debug('AttendanceRepo.hasAttended: Checking attendance', { studentId, event: eventName });
			const rows = await db.select().from(attendanceTable).where(eq(attendanceTable.studentId, studentId));
			const hasAttended = rows.some(r => r.createdAt != null && r.event === eventName && this.isSameDay(new Date(r.createdAt), date));
			const duration = Date.now() - startTime;
			logger.debug('AttendanceRepo.hasAttended: Check completed', { 
				studentId, 
				event: eventName, 
				hasAttended,
				durationMs: duration 
			});
			return hasAttended;
		} catch (error) {
			const duration = Date.now() - startTime;
			logger.error('AttendanceRepo.hasAttended: Check failed', { error, studentId, event: eventName, durationMs: duration });
			throw error;
		}
	}

	public async deleteToday(studentId: number, eventName: string): Promise<{ success: boolean }> {
		const startTime = Date.now();
		try {
			logger.debug('AttendanceRepo.deleteToday: Deleting today\'s attendance', { studentId, event: eventName });
			const today = new Date();
			const rows = await db.select().from(attendanceTable).where(eq(attendanceTable.studentId, studentId));
			const target = rows.find(r => r.id != null && r.createdAt != null && r.event === eventName && this.isSameDay(new Date(r.createdAt), today));
			if (!target) {
				const duration = Date.now() - startTime;
				logger.warn('AttendanceRepo.deleteToday: No attendance record found for today', { 
					studentId, 
					event: eventName,
					durationMs: duration 
				});
				return { success: false };
			}
			await db.delete(attendanceTable).where(eq(attendanceTable.id, target.id!));
			const duration = Date.now() - startTime;
			logger.info('AttendanceRepo.deleteToday: Successfully deleted today\'s attendance', { 
				studentId, 
				event: eventName,
				attendanceId: target.id,
				durationMs: duration 
			});
			return { success: true };
		} catch (error) {
			const duration = Date.now() - startTime;
			logger.error('AttendanceRepo.deleteToday: Failed to delete today\'s attendance', { 
				error, 
				studentId, 
				event: eventName,
				durationMs: duration 
			});
			throw error;
		}
	}

	public async readByStudentId(studentId: number, options?: { 
		fromDate?: Date; 
		toDate?: Date; 
		limit?: number; 
		offset?: number;
	}): Promise<{ records: Attendance[]; total: number }> {
		const startTime = Date.now();
		try {
			logger.debug('AttendanceRepo.readByStudentId: Starting read operation', { 
				studentId, 
				fromDate: options?.fromDate, 
				toDate: options?.toDate,
				limit: options?.limit,
				offset: options?.offset
			});
			
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
			let queryBuilder = db.select()
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
			
			const duration = Date.now() - startTime;
			logger.info('AttendanceRepo.readByStudentId: Successfully read attendance records', { 
				studentId, 
				count: records.length,
				total,
				durationMs: duration 
			});
			return { records, total };
		} catch (error) {
			const duration = Date.now() - startTime;
			logger.error('AttendanceRepo.readByStudentId: Failed to read attendance records', { 
				error, 
				studentId,
				durationMs: duration 
			});
			throw error;
		}
	}
}

export class MemorizationRepo {
	public async create(params: Omit<Omit<Omit<Memorization, 'updated_at'>, 'created_at'>, 'id'>): Promise<Memorization> {
		const startTime = Date.now();
		try {
			logger.debug('MemorizationRepo.create: Starting create operation', { 
				studentId: params.student_id, 
				page: params.page 
			});
			const now = new Date();
			await db.insert(memorizationTable).values({
				studentId: params.student_id,
				page: params.page,
				createdAt: now,
				updatedAt: now,
			});
			const rows = await db.select().from(memorizationTable).orderBy(memorizationTable.id);
			const created = rows[rows.length - 1];
			const memorization = toMemorizationDomain(created);
			const duration = Date.now() - startTime;
			logger.info('MemorizationRepo.create: Successfully created memorization record', { 
				memorizationId: memorization.id,
				studentId: params.student_id, 
				page: params.page,
				durationMs: duration 
			});
			return memorization;
		} catch (error) {
			const duration = Date.now() - startTime;
			logger.error('MemorizationRepo.create: Failed to create memorization record', { 
				error, 
				studentId: params.student_id,
				page: params.page,
				durationMs: duration 
			});
			throw error;
		}
	}

	public async readByStudentId(studentId: number): Promise<Memorization[]> {
		const startTime = Date.now();
		try {
			logger.debug('MemorizationRepo.readByStudentId: Starting read operation', { studentId });
			const rows = await db.select().from(memorizationTable).where(eq(memorizationTable.studentId, studentId));
			const memorizations = rows.map(toMemorizationDomain);
			const duration = Date.now() - startTime;
			logger.info('MemorizationRepo.readByStudentId: Successfully read memorization records', { 
				studentId, 
				count: memorizations.length,
				durationMs: duration 
			});
			return memorizations;
		} catch (error) {
			const duration = Date.now() - startTime;
			logger.error('MemorizationRepo.readByStudentId: Failed to read memorization records', { 
				error, 
				studentId,
				durationMs: duration 
			});
			throw error;
		}
	}

	public async readByStudentIdPaginated(studentId: number, options?: { 
		fromDate?: Date; 
		toDate?: Date; 
		limit?: number; 
		offset?: number;
	}): Promise<{ records: Memorization[]; total: number }> {
		const startTime = Date.now();
		try {
			logger.debug('MemorizationRepo.readByStudentIdPaginated: Starting read operation', { 
				studentId, 
				fromDate: options?.fromDate, 
				toDate: options?.toDate,
				limit: options?.limit,
				offset: options?.offset
			});
			
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
			let queryBuilder = db.select()
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
			
			const duration = Date.now() - startTime;
			logger.info('MemorizationRepo.readByStudentIdPaginated: Successfully read memorization records', { 
				studentId, 
				count: records.length,
				total,
				durationMs: duration 
			});
			return { records, total };
		} catch (error) {
			const duration = Date.now() - startTime;
			logger.error('MemorizationRepo.readByStudentIdPaginated: Failed to read memorization records', { 
				error, 
				studentId,
				durationMs: duration 
			});
			throw error;
		}
	}
}