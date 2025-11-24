// Attendance service - use case layer
import type { Attendance } from '../domain/attendance.js';
import { AttendanceRepository } from '../../infrastructure/db/repositories/attendanceRepository.js';
import { unitOfWork } from '../../infrastructure/db/unitOfWork.js';

export interface RecordAttendanceParams {
	studentId: number;
	event: string;
	date?: Date;
}

export interface GetAttendanceParams {
	studentId: number;
	fromDate?: Date;
	toDate?: Date;
	limit?: number;
	offset?: number;
}

export class AttendanceService {
	constructor(private readonly repository: AttendanceRepository = new AttendanceRepository()) {}

	async recordAttendance(params: RecordAttendanceParams): Promise<Attendance> {
		return unitOfWork.execute(async () => {
			const date = params.date ?? new Date();
			const existing = await this.repository.findByStudentIdAndDate(params.studentId, date, params.event);
			if (existing) {
				throw new Error('Student already has attendance recorded for this event on this date');
			}
			return this.repository.create({
				studentId: params.studentId,
				event: params.event,
			});
		});
	}

	async getAttendanceByStudent(params: GetAttendanceParams): Promise<{ records: Attendance[]; total: number }> {
		return this.repository.findByStudentId(params.studentId, {
			fromDate: params.fromDate,
			toDate: params.toDate,
			limit: params.limit,
			offset: params.offset,
		});
	}

	async hasAttended(studentId: number, event: string, date: Date): Promise<boolean> {
		const attendance = await this.repository.findByStudentIdAndDate(studentId, date, event);
		return attendance !== null;
	}

	async removeAttendance(id: number): Promise<void> {
		return unitOfWork.execute(async () => {
			await this.repository.delete(id);
		});
	}

	async removeTodayAttendance(studentId: number, event: string): Promise<void> {
		return unitOfWork.execute(async () => {
			const today = new Date();
			const attendance = await this.repository.findByStudentIdAndDate(studentId, today, event);
			if (attendance) {
				await this.repository.delete(attendance.id);
			}
		});
	}
}

